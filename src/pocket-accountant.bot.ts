import { Markup, Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';
import { env } from './config/env.js';
import { UserService } from './services/user.service.js';
import { CategoryService } from './services/category.service.js';
import { PurchaseService } from './services/purchase.service.js';
import { StatsService } from './services/stats.service.js';
import { WidgetService } from './services/widget.service.js';
import { RecommendationService } from './services/recommendation.service.js';
import { LimitService } from './services/limit.service.js';
import { PendingIntentStore } from './state/pending-intent.store.js';
import { parsePurchaseInput, parseLimitInput } from './utils/text.js';
import { logger } from './logger.js';
import { prisma } from './services/prisma.service.js';
import { MessageTracker } from './state/message-tracker.js';

export class PocketAccountantBot {
  private readonly bot = new Telegraf(env.BOT_TOKEN);
  private readonly userService = new UserService();
  private readonly categoryService = new CategoryService();
  private readonly purchaseService = new PurchaseService();
  private readonly statsService = new StatsService();
  private readonly widgetService = new WidgetService();
  private readonly recommendationService = new RecommendationService();
  private readonly limitService = new LimitService();
  private readonly pendingStore = new PendingIntentStore();
  private readonly messageTracker = new MessageTracker();

  private readonly mainKeyboard = Markup.keyboard([
    ['🔄 Рестарт'],
    ['➕ Добавить расход', '📊 Статистика'],
    ['🎯 Лимиты', '🧠 Советы'],
    ['🗑️ Сброс статистики'],
  ])
    .resize()
    .persistent();

  constructor() {
    this.registerHandlers();
  }

  async launch() {
    await this.bot.launch();
  }

  stop(reason: string) {
    this.bot.stop(reason);
  }

  private registerHandlers() {
    this.bot.start((ctx) => this.safeExecute(ctx, () => this.handleStart(ctx)));
    this.bot.command('stats', (ctx) => this.safeExecute(ctx, () => this.sendStats(ctx)));
    this.bot.command('limit', (ctx) => this.safeExecute(ctx, () => this.promptLimit(ctx)));
    this.bot.command('advice', (ctx) =>
      this.safeExecute(ctx, () => this.sendRecommendations(ctx)),
    );

    this.bot.hears('🔄 Рестарт', (ctx) =>
      this.safeExecute(ctx, () => this.handleRestart(ctx)),
    );
    this.bot.hears('➕ Добавить расход', (ctx) =>
      this.safeExecute(ctx, () => this.promptPurchase(ctx)),
    );
    this.bot.hears('📊 Статистика', (ctx) =>
      this.safeExecute(ctx, () => this.sendStats(ctx)),
    );
    this.bot.hears('🎯 Лимиты', (ctx) =>
      this.safeExecute(ctx, () => this.promptLimit(ctx)),
    );
    this.bot.hears('🧠 Советы', (ctx) =>
      this.safeExecute(ctx, () => this.sendRecommendations(ctx)),
    );
    this.bot.hears('🗑️ Сброс статистики', (ctx) =>
      this.safeExecute(ctx, () => this.promptResetStats(ctx)),
    );

    this.bot.on('callback_query', (ctx) =>
      this.safeExecute(ctx, () => this.handleCallbackQuery(ctx)),
    );
    this.bot.on('text', (ctx) => this.safeExecute(ctx, () => this.handleText(ctx)));
  }

  private async handleStart(ctx: Context) {
    if (!ctx.from) return;
    const user = await this.ensureUser(ctx);
    await this.categoryService.ensureDefaults(user.id);
    await this.clearTrackedMessages(ctx);
    this.pendingStore.clear(ctx.from.id);

    await this.reply(
      ctx,
      [
        '👋 Привет! Я Карманный бухгалтер.',
        '',
        'Используй кнопку "➕ Добавить расход" для быстрого добавления трат.',
        'Также можно отправить в формате `сумма; категория; комментарий` (разделители `; , |`).',
        '',
        '💡 Используй кнопку "🔄 Рестарт" для очистки чата и начала заново.',
      ].join('\n'),
      this.buildReplyOptions({ parse_mode: 'Markdown' }),
    );
  }

  private async handleRestart(ctx: Context) {
    if (!ctx.from) return;
    // Очищаем состояние
    this.pendingStore.clear(ctx.from.id);
    // Удаляем все сообщения бота
    await this.clearTrackedMessages(ctx);
    // Небольшая задержка для завершения удаления
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Показываем начальное приветственное сообщение
    const user = await this.ensureUser(ctx);
    await this.categoryService.ensureDefaults(user.id);

    await this.reply(
      ctx,
      [
        '🔄 *Рестарт выполнен*',
        '',
        '👋 Привет! Я Карманный бухгалтер.',
        '',
        'Используй кнопку "➕ Добавить расход" для быстрого добавления трат.',
        'Также можно отправить в формате `сумма; категория; комментарий` (разделители `; , |`).',
        '',
        '💡 Все сообщения бота удалены. Статистика сохранена.',
        '',
        '_Примечание: твои сообщения (кнопки) остались в чате, так как бот не может их удалить._',
      ].join('\n'),
      this.buildReplyOptions({ parse_mode: 'Markdown' }),
    );
  }

  private async promptResetStats(ctx: Context) {
    if (!ctx.from) return;
    const user = await this.ensureUser(ctx);
    const stats = await this.statsService.buildSnapshot({
      userId: user.id,
      currency: user.currency,
    });

    const totalPurchases = stats.categories.reduce((sum, cat) => sum + cat.total, 0);

    if (totalPurchases === 0) {
      await this.reply(
        ctx,
        'У тебя пока нет записей для сброса.',
        this.buildReplyOptions(),
      );
      return;
    }

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('✅ Да, сбросить', 'reset_stats_confirm')],
      [Markup.button.callback('❌ Отмена', 'reset_stats_cancel')],
    ]);

    await this.reply(
      ctx,
      [
        '⚠️ *Внимание!*',
        '',
        `Ты собираешься удалить все ${stats.categories.length} записи о расходах.`,
        `Общая сумма: ${totalPurchases.toFixed(0)} ${user.currency}`,
        '',
        'Это действие нельзя отменить. Продолжить?',
      ].join('\n'),
      {
        ...keyboard,
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      },
    );
  }

  private async resetStats(ctx: Context) {
    if (!ctx.from) return;
    try {
      const user = await this.ensureUser(ctx);
      const deleted = await this.purchaseService.deleteAllPurchases(user.id);
      this.pendingStore.clear(ctx.from.id);

      await this.reply(
        ctx,
        `✅ Статистика сброшена. Удалено записей: ${deleted}`,
        this.buildReplyOptions(),
      );
    } catch (error) {
      logger.error(error, 'Ошибка при сбросе статистики');
      this.pendingStore.clear(ctx.from.id);
      await this.reply(
        ctx,
        'Не удалось сбросить статистику. Попробуй позже.',
        this.buildReplyOptions(),
      );
    }
  }

  private async promptPurchase(ctx: Context) {
    if (!ctx.from) return;
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(ctx.from.id);
    const categories = await this.categoryService.listAll(user.id);

    if (categories.length === 0) {
      await this.reply(
        ctx,
        'У тебя пока нет категорий. Отправь покупку в формате `650; Продукты; Утренний рынок` (разделители `; , |`).',
        this.buildReplyOptions({ parse_mode: 'Markdown' }),
      );
      this.pendingStore.set(ctx.from.id, { type: 'add_purchase' });
      return;
    }

    const buttons = categories.map((cat) =>
      Markup.button.callback(
        `${cat.emoji ?? '🧾'} ${cat.name}`,
        `select_category:${cat.id}`,
      ),
    );

    const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });

    await this.reply(
      ctx,
      'Выбери категорию для расхода:',
      {
        ...keyboard,
        reply_markup: keyboard.reply_markup,
      },
    );
  }

  private async promptLimit(ctx: Context) {
    if (!ctx.from) return;
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(ctx.from.id);
    const limits = await this.limitService.listActive(user.id);

    const limitLines =
      limits.length === 0
        ? 'Лимиты ещё не заданы.'
        : (
            await Promise.all(
              limits.map(async (limit) => {
                const status = await this.limitService.resolveLimitStatus({
                  userId: user.id,
                  categoryId: limit.categoryId,
                });

                if (status.type === 'none') {
                  return `${limit.category.emoji ?? '🎯'} ${limit.category.name}: ${
                    limit.amount
                  } ${user.currency}`;
                }

                const badge = status.isExceeded
                  ? '🚨'
                  : status.coverage >= status.threshold
                    ? '⚠️'
                    : '🎯';

                const bar = this.widgetService.progressBar(status.coverage);

                return `${badge} ${status.emoji ?? '🎯'} ${status.categoryName}: ${status.spent.toFixed(
                  0,
                )} / ${status.amount.toFixed(0)} ${user.currency}\n${bar}`;
              }),
            )
          ).join('\n\n');

    const categories = await this.categoryService.listAll(user.id);

    if (categories.length === 0) {
      await this.reply(
        ctx,
        [
          '*🎯 Лимиты*',
          limitLines,
          '',
          'У тебя пока нет категорий. Сначала добавь расход, чтобы создать категорию.',
        ].join('\n'),
        this.buildReplyOptions({ parse_mode: 'Markdown' }),
      );
      return;
    }

    const buttons = categories.map((cat) =>
      Markup.button.callback(
        `${cat.emoji ?? '🎯'} ${cat.name}`,
        `select_limit_category:${cat.id}`,
      ),
    );

    const keyboard = Markup.inlineKeyboard(buttons, { columns: 2 });

    await this.reply(
      ctx,
      [
        '*🎯 Лимиты*',
        limitLines,
        '',
        'Выбери категорию для установки месячного лимита:',
      ].join('\n'),
      {
        ...keyboard,
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup,
      },
    );
  }

  private async sendStats(ctx: Context) {
    if (!ctx.from) return;
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(ctx.from.id);
    const stats = await this.statsService.buildSnapshot({
      userId: user.id,
      currency: user.currency,
    });

    const message = [
      this.widgetService.renderSummary(stats),
      '',
      this.widgetService.renderCategories(stats),
      '',
      this.widgetService.renderRecent(stats),
    ].join('\n');

    await this.reply(ctx, message, this.buildReplyOptions({ parse_mode: 'Markdown' }));
  }

  private async sendRecommendations(ctx: Context) {
    if (!ctx.from) return;
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(ctx.from.id);
    const stats = await this.statsService.buildSnapshot({
      userId: user.id,
      currency: user.currency,
    });
    const tips = this.recommendationService.build({
      stats,
      lastPurchaseDate: stats.recent[0]?.spentAt,
    });

    await this.reply(
      ctx,
      ['*🧠 Персональные советы*', ...tips.map((tip) => `• ${tip}`)].join('\n'),
      this.buildReplyOptions({ parse_mode: 'Markdown' }),
    );
  }

  private async handleCallbackQuery(ctx: Context) {
    if (!ctx.from || !('data' in ctx.callbackQuery)) return;

    const data = ctx.callbackQuery.data;

    if (data.startsWith('select_category:')) {
      const categoryId = data.replace('select_category:', '');
      this.pendingStore.set(ctx.from.id, { type: 'add_purchase_note', categoryId });
      await ctx.answerCbQuery();
      await this.reply(
        ctx,
        'Введи название покупки:',
        this.buildReplyOptions(),
      );
      return;
    }

    if (data.startsWith('select_limit_category:')) {
      const categoryId = data.replace('select_limit_category:', '');
      this.pendingStore.set(ctx.from.id, { type: 'set_limit_amount', categoryId });
      await ctx.answerCbQuery();
      await this.reply(
        ctx,
        'Введи сумму месячного лимита (только число, например: 5000):',
        this.buildReplyOptions(),
      );
      return;
    }

    if (data === 'reset_stats_confirm') {
      await ctx.answerCbQuery();
      await this.resetStats(ctx);
      return;
    }

    if (data === 'reset_stats_cancel') {
      await ctx.answerCbQuery('Отменено');
      try {
        await ctx.editMessageText('❌ Сброс статистики отменён.');
      } catch {
        await this.reply(ctx, '❌ Сброс статистики отменён.', this.buildReplyOptions());
      }
      return;
    }
  }

  private async handleText(ctx: Context) {
    if (!ctx.from || !('text' in ctx.message)) return;
    const intent = this.pendingStore.get(ctx.from.id);

    if (intent?.type === 'add_purchase') {
      await this.processPurchase(ctx, ctx.message.text);
      return;
    }

    if (intent?.type === 'add_purchase_note') {
      await this.processPurchaseNote(ctx, ctx.message.text, intent.categoryId);
      return;
    }

    if (intent?.type === 'add_purchase_amount') {
      await this.processPurchaseAmount(ctx, ctx.message.text, intent.categoryId, intent.note);
      return;
    }

    if (intent?.type === 'set_limit') {
      await this.processLimit(ctx, ctx.message.text);
      return;
    }

    if (intent?.type === 'set_limit_amount') {
      await this.processLimitAmount(ctx, ctx.message.text, intent.categoryId);
      return;
    }

    await this.reply(
      ctx,
      'Используй кнопки ниже, чтобы добавить покупку или получить статистику.',
      this.buildReplyOptions(),
    );
  }

  private async processPurchase(ctx: Context, text: string) {
    if (!ctx.from) return;
    try {
      const input = parsePurchaseInput(text);
      const user = await this.ensureUser(ctx);
      const category = await this.categoryService.findOrCreate(user.id, input.category);
      await this.finishPurchase(ctx, user.id, category.id, input.amount, input.note);
    } catch (error) {
      await this.reply(
        ctx,
        error instanceof Error ? `Не удалось распознать: ${error.message}` : 'Что-то пошло не так.',
        this.buildReplyOptions(),
      );
      this.pendingStore.clear(ctx.from.id);
    }
  }

  private async processPurchaseNote(ctx: Context, text: string, categoryId: string) {
    if (!ctx.from) return;
    const note = text.trim();

    if (!note || note.length === 0) {
      await this.reply(
        ctx,
        'Название не может быть пустым. Введи название покупки:',
        this.buildReplyOptions(),
      );
      return;
    }

    this.pendingStore.set(ctx.from.id, { type: 'add_purchase_amount', categoryId, note });
    await this.reply(
      ctx,
      'Введи сумму расхода (только число, например: 650 или 1250.50):',
      this.buildReplyOptions(),
    );
  }

  private async processPurchaseAmount(
    ctx: Context,
    text: string,
    categoryId: string,
    note: string,
  ) {
    if (!ctx.from) return;
    const amountText = text.trim().replace(/[^\d.,]/g, '').replace(',', '.');
    const amount = parseFloat(amountText);

    if (isNaN(amount) || amount <= 0) {
      await this.reply(
        ctx,
        'Неверный формат суммы. Введи число (например: 650 или 1250.50):',
        this.buildReplyOptions(),
      );
      return;
    }

    const user = await this.ensureUser(ctx);
    await this.finishPurchase(ctx, user.id, categoryId, amount, note);
  }

  private async finishPurchase(
    ctx: Context,
    userId: string,
    categoryId: string,
    amount: number,
    note?: string,
  ) {
    if (!ctx.from) return;
    try {
      const user = await this.ensureUser(ctx);
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        await this.reply(ctx, 'Категория не найдена.', this.buildReplyOptions());
        this.pendingStore.clear(ctx.from.id);
        return;
      }

      await this.purchaseService.addPurchase({
        userId,
        categoryId,
        amount,
        note,
      });

      await this.reply(
        ctx,
        [
          '✅ Записал расход.',
          `${category.emoji ?? '•'} ${category.name} — ${amount.toFixed(0)} ${user.currency}`,
          note ? `Комментарий: ${note}` : undefined,
        ]
          .filter(Boolean)
          .join('\n'),
        this.buildReplyOptions(),
      );

      await this.limitService.notifyIfNeeded({
        userId,
        categoryId,
        onWarning: async ({ message }) => {
          await this.reply(ctx, message, this.buildReplyOptions({ parse_mode: 'Markdown' }));
        },
      });
    } catch (error) {
      logger.error(error, 'Ошибка при сохранении покупки');
      await this.reply(ctx, 'Не удалось сохранить расход.', this.buildReplyOptions());
    } finally {
      this.pendingStore.clear(ctx.from.id);
    }
  }

  private async processLimit(ctx: Context, text: string) {
    if (!ctx.from) return;
    try {
      const input = parseLimitInput(text);
      const user = await this.ensureUser(ctx);
      const category = await this.categoryService.findOrCreate(user.id, input.category);
      const limit = await this.limitService.upsertLimit({
        userId: user.id,
        categoryId: category.id,
        amount: input.amount,
      });

      await this.reply(
        ctx,
        `🎯 Лимит для *${category.name}* обновлён: ${limit.amount.toFixed(0)} ${user.currency}`,
        this.buildReplyOptions({ parse_mode: 'Markdown' }),
      );
    } catch (error) {
      await this.reply(
        ctx,
        error instanceof Error ? `Не удалось обновить лимит: ${error.message}` : 'Ошибка лимита.',
        this.buildReplyOptions(),
      );
      return;
    } finally {
      this.pendingStore.clear(ctx.from.id);
    }
  }

  private async processLimitAmount(ctx: Context, text: string, categoryId: string) {
    if (!ctx.from) return;
    const amountText = text.trim().replace(/[^\d.,]/g, '').replace(',', '.');
    const amount = parseFloat(amountText);

    if (isNaN(amount) || amount <= 0) {
      await this.reply(
        ctx,
        'Неверный формат суммы. Введи число (например: 5000 или 10000.50):',
        this.buildReplyOptions(),
      );
      return;
    }

    try {
      const user = await this.ensureUser(ctx);
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        await this.reply(ctx, 'Категория не найдена.', this.buildReplyOptions());
        this.pendingStore.clear(ctx.from.id);
        return;
      }

      const limit = await this.limitService.upsertLimit({
        userId: user.id,
        categoryId: category.id,
        amount,
      });

      await this.reply(
        ctx,
        `✅ Лимит для *${category.name}* установлен: ${limit.amount.toFixed(0)} ${user.currency} в месяц`,
        this.buildReplyOptions({ parse_mode: 'Markdown' }),
      );
    } catch (error) {
      logger.error(error, 'Ошибка при установке лимита');
      await this.reply(
        ctx,
        'Не удалось установить лимит. Попробуй позже.',
        this.buildReplyOptions(),
      );
    } finally {
      this.pendingStore.clear(ctx.from.id);
    }
  }

  private async ensureUser(ctx: Context) {
    if (!ctx.from) {
      throw new Error('Неизвестный пользователь');
    }
    const user = await this.userService.ensureUser({
      telegramId: String(ctx.from.id),
      firstName: ctx.from.first_name,
      username: ctx.from.username,
    });
    return user;
  }

  private async safeExecute(ctx: Context, handler: () => Promise<void> | void) {
    try {
      await handler();
    } catch (error) {
      logger.error(error, 'Ошибка обработчика');
      await this.reply(
        ctx,
        'Упс, что-то пошло не так. Попробуй ещё раз позже.',
        this.buildReplyOptions(),
      );
    }
  }

  private buildReplyOptions(extra?: Record<string, unknown>) {
    return {
      ...(extra ?? {}),
      reply_markup: this.mainKeyboard.reply_markup,
    };
  }

  private async reply(
    ctx: Context,
    text: string,
    extra?: Parameters<Context['reply']>[1],
  ) {
    const message = await ctx.reply(text, extra as never);
    this.trackMessage(ctx, message);
    return message;
  }

  private trackMessage(ctx: Context, message: Message.TextMessage | Message.CommonMessage) {
    if (!ctx.chat) {
      return;
    }
    this.messageTracker.track(ctx.chat.id, message.message_id);
  }

  private async clearTrackedMessages(ctx: Context) {
    if (!ctx.chat) return;
    const chatId = ctx.chat.id;
    const ids = this.messageTracker.pull(chatId);
    await Promise.all(
      ids.map((id) =>
        ctx.telegram.deleteMessage(chatId, id).catch(() => {
          /* ignore */
        }),
      ),
    );
  }
}

