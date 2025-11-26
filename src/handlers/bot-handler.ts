import type { BotPlatform, BotContext, ReplyOptions } from '../platforms/bot-platform.interface.js';
import { UserService } from '../services/user.service.js';
import { CategoryService } from '../services/category.service.js';
import { PurchaseService } from '../services/purchase.service.js';
import { StatsService } from '../services/stats.service.js';
import { WidgetService } from '../services/widget.service.js';
import { RecommendationService } from '../services/recommendation.service.js';
import { LimitService } from '../services/limit.service.js';
import { PendingIntentStore } from '../state/pending-intent.store.js';
import { parsePurchaseInput, parseLimitInput } from '../utils/text.js';
import { logger } from '../logger.js';
import { prisma } from '../services/prisma.service.js';

/**
 * Общий обработчик бизнес-логики бота
 * Работает с любой платформой через интерфейс BotPlatform
 */
export class BotHandler {
  private readonly userService = new UserService();
  private readonly categoryService = new CategoryService();
  private readonly purchaseService = new PurchaseService();
  private readonly statsService = new StatsService();
  private readonly widgetService = new WidgetService();
  private readonly recommendationService = new RecommendationService();
  private readonly limitService = new LimitService();
  private readonly pendingStore = new PendingIntentStore();

  constructor(
    private readonly platform: BotPlatform,
  ) {}

  /**
   * Регистрация всех обработчиков
   */
  registerHandlers() {
    this.platform.onStart((ctx) => this.safeExecute(ctx, () => this.handleStart(ctx)));
    this.platform.onCommand('stats', (ctx) => this.safeExecute(ctx, () => this.sendStats(ctx)));
    this.platform.onCommand('limit', (ctx) => this.safeExecute(ctx, () => this.promptLimit(ctx)));
    this.platform.onCommand('advice', (ctx) =>
      this.safeExecute(ctx, () => this.sendRecommendations(ctx)),
    );

    this.platform.onText('🔄 Рестарт', (ctx) =>
      this.safeExecute(ctx, () => this.handleRestart(ctx)),
    );
    this.platform.onText('➕ Добавить расход', (ctx) =>
      this.safeExecute(ctx, () => this.promptPurchase(ctx)),
    );
    this.platform.onText('📊 Статистика', (ctx) =>
      this.safeExecute(ctx, () => this.sendStats(ctx)),
    );
    this.platform.onText('🎯 Лимиты', (ctx) =>
      this.safeExecute(ctx, () => this.promptLimit(ctx)),
    );
    this.platform.onText('🧠 Советы', (ctx) =>
      this.safeExecute(ctx, () => this.sendRecommendations(ctx)),
    );
    this.platform.onText('🗑️ Сброс статистики', (ctx) =>
      this.safeExecute(ctx, () => this.promptResetStats(ctx)),
    );

    this.platform.onCallbackQuery((ctx, data) =>
      this.safeExecute(ctx, () => this.handleCallbackQuery(ctx, data)),
    );
    this.platform.onAnyText((ctx) => this.safeExecute(ctx, () => this.handleText(ctx)));
  }

  private async handleStart(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    await this.categoryService.ensureDefaults(user.id);
    this.pendingStore.clear(this.getUserId(ctx));

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
      this.buildReplyOptions({ parseMode: 'Markdown' }),
    );
  }

  private async handleRestart(ctx: BotContext) {
    this.pendingStore.clear(this.getUserId(ctx));
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
        '💡 Статистика сохранена.',
      ].join('\n'),
      this.buildReplyOptions({ parseMode: 'Markdown' }),
    );
  }

  private async promptResetStats(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    const stats = await this.statsService.buildSnapshot({
      userId: user.id,
      currency: user.currency,
    });

    const totalPurchases = stats.categories.reduce((sum, cat) => sum + cat.total, 0);

    if (totalPurchases === 0) {
      await this.reply(ctx, 'У тебя пока нет записей для сброса.', this.buildReplyOptions());
      return;
    }

    const keyboard = [
      [{ text: '✅ Да, сбросить', callbackData: 'reset_stats_confirm' }],
      [{ text: '❌ Отмена', callbackData: 'reset_stats_cancel' }],
    ];

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
        parseMode: 'Markdown',
        inlineKeyboard: keyboard,
      },
    );
  }

  private async resetStats(ctx: BotContext) {
    try {
      const user = await this.ensureUser(ctx);
      const deleted = await this.purchaseService.deleteAllPurchases(user.id);
      this.pendingStore.clear(this.getUserId(ctx));

      await this.reply(
        ctx,
        `✅ Статистика сброшена. Удалено записей: ${deleted}`,
        this.buildReplyOptions(),
      );
    } catch (error) {
      logger.error(error, 'Ошибка при сбросе статистики');
      this.pendingStore.clear(this.getUserId(ctx));
      await this.reply(
        ctx,
        'Не удалось сбросить статистику. Попробуй позже.',
        this.buildReplyOptions(),
      );
    }
  }

  private async promptPurchase(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(this.getUserId(ctx));
    const categories = await this.categoryService.listAll(user.id);

    if (categories.length === 0) {
      await this.reply(
        ctx,
        'У тебя пока нет категорий. Отправь покупку в формате `650; Продукты; Утренний рынок` (разделители `; , |`).',
        this.buildReplyOptions({ parseMode: 'Markdown' }),
      );
      this.pendingStore.set(this.getUserId(ctx), { type: 'add_purchase' });
      return;
    }

    const buttons = categories.map((cat) => ({
      text: `${cat.emoji ?? '🧾'} ${cat.name}`,
      callbackData: `select_category:${cat.id}`,
    }));

    const keyboard = this.chunkArray(buttons, 2).map((row) => row);

    await this.reply(
      ctx,
      'Выбери категорию для расхода:',
      {
        inlineKeyboard: keyboard,
      },
    );
  }

  private async promptLimit(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(this.getUserId(ctx));
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
        this.buildReplyOptions({ parseMode: 'Markdown' }),
      );
      return;
    }

    const buttons = categories.map((cat) => ({
      text: `${cat.emoji ?? '🎯'} ${cat.name}`,
      callbackData: `select_limit_category:${cat.id}`,
    }));

    const keyboard = this.chunkArray(buttons, 2).map((row) => row);

    await this.reply(
      ctx,
      [
        '*🎯 Лимиты*',
        limitLines,
        '',
        'Выбери категорию для установки месячного лимита:',
      ].join('\n'),
      {
        parseMode: 'Markdown',
        inlineKeyboard: keyboard,
      },
    );
  }

  private async sendStats(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(this.getUserId(ctx));
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

    await this.reply(ctx, message, this.buildReplyOptions({ parseMode: 'Markdown' }));
  }

  private async sendRecommendations(ctx: BotContext) {
    const user = await this.ensureUser(ctx);
    this.pendingStore.clear(this.getUserId(ctx));
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
      this.buildReplyOptions({ parseMode: 'Markdown' }),
    );
  }

  private async handleCallbackQuery(ctx: BotContext, data: string) {
    if (data.startsWith('select_category:')) {
      const categoryId = data.replace('select_category:', '');
      this.pendingStore.set(this.getUserId(ctx), { type: 'add_purchase_note', categoryId });
      await this.reply(ctx, 'Введи название покупки:', this.buildReplyOptions());
      return;
    }

    if (data.startsWith('select_limit_category:')) {
      const categoryId = data.replace('select_limit_category:', '');
      this.pendingStore.set(this.getUserId(ctx), { type: 'set_limit_amount', categoryId });
      await this.reply(
        ctx,
        'Введи сумму месячного лимита (только число, например: 5000):',
        this.buildReplyOptions(),
      );
      return;
    }

    if (data === 'reset_stats_confirm') {
      await this.resetStats(ctx);
      return;
    }

    if (data === 'reset_stats_cancel') {
      try {
        await this.platform.editMessage(
          ctx.chatId,
          ctx.message.messageId,
          '❌ Сброс статистики отменён.',
        );
      } catch {
        await this.reply(ctx, '❌ Сброс статистики отменён.', this.buildReplyOptions());
      }
      return;
    }
  }

  private async handleText(ctx: BotContext) {
    if (!ctx.message.text) return;
    const intent = this.pendingStore.get(this.getUserId(ctx));

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

  private async processPurchase(ctx: BotContext, text: string) {
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
      this.pendingStore.clear(this.getUserId(ctx));
    }
  }

  private async processPurchaseNote(ctx: BotContext, text: string, categoryId: string) {
    const note = text.trim();

    if (!note || note.length === 0) {
      await this.reply(
        ctx,
        'Название не может быть пустым. Введи название покупки:',
        this.buildReplyOptions(),
      );
      return;
    }

    this.pendingStore.set(this.getUserId(ctx), { type: 'add_purchase_amount', categoryId, note });
    await this.reply(
      ctx,
      'Введи сумму расхода (только число, например: 650 или 1250.50):',
      this.buildReplyOptions(),
    );
  }

  private async processPurchaseAmount(
    ctx: BotContext,
    text: string,
    categoryId: string,
    note: string,
  ) {
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
    ctx: BotContext,
    userId: string,
    categoryId: string,
    amount: number,
    note?: string,
  ) {
    try {
      const user = await this.ensureUser(ctx);
      const category = await prisma.category.findUnique({
        where: { id: categoryId },
      });

      if (!category) {
        await this.reply(ctx, 'Категория не найдена.', this.buildReplyOptions());
        this.pendingStore.clear(this.getUserId(ctx));
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
          await this.reply(ctx, message, this.buildReplyOptions({ parseMode: 'Markdown' }));
        },
      });
    } catch (error) {
      logger.error(error, 'Ошибка при сохранении покупки');
      await this.reply(ctx, 'Не удалось сохранить расход.', this.buildReplyOptions());
    } finally {
      this.pendingStore.clear(this.getUserId(ctx));
    }
  }

  private async processLimit(ctx: BotContext, text: string) {
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
        this.buildReplyOptions({ parseMode: 'Markdown' }),
      );
    } catch (error) {
      await this.reply(
        ctx,
        error instanceof Error ? `Не удалось обновить лимит: ${error.message}` : 'Ошибка лимита.',
        this.buildReplyOptions(),
      );
      return;
    } finally {
      this.pendingStore.clear(this.getUserId(ctx));
    }
  }

  private async processLimitAmount(ctx: BotContext, text: string, categoryId: string) {
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
        this.pendingStore.clear(this.getUserId(ctx));
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
        this.buildReplyOptions({ parseMode: 'Markdown' }),
      );
    } catch (error) {
      logger.error(error, 'Ошибка при установке лимита');
      await this.reply(
        ctx,
        'Не удалось установить лимит. Попробуй позже.',
        this.buildReplyOptions(),
      );
    } finally {
      this.pendingStore.clear(this.getUserId(ctx));
    }
  }

  private async ensureUser(ctx: BotContext) {
    return await this.userService.ensureUser({
      telegramId: ctx.user.platformId,
      firstName: ctx.user.firstName,
      username: ctx.user.username,
    });
  }

  private async safeExecute(ctx: BotContext, handler: () => Promise<void> | void) {
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

  private buildReplyOptions(extra?: Partial<ReplyOptions>): ReplyOptions {
    const mainKeyboard = [
      [{ text: '🔄 Рестарт' }],
      [{ text: '➕ Добавить расход' }, { text: '📊 Статистика' }],
      [{ text: '🎯 Лимиты' }, { text: '🧠 Советы' }],
      [{ text: '🗑️ Сброс статистики' }],
    ];

    return {
      ...(extra ?? {}),
      keyboard: extra?.keyboard ?? mainKeyboard,
    };
  }

  private async reply(ctx: BotContext, text: string, options?: ReplyOptions) {
    return await this.platform.sendMessage(ctx.chatId, text, options);
  }

  private getUserId(ctx: BotContext): string {
    return ctx.user.platformId;
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

