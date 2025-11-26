import { Markup, Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import type { Message } from 'telegraf/typings/core/types/typegram';
import type {
  BotPlatform,
  BotContext,
  BotUser,
  BotMessage,
  ReplyOptions,
  KeyboardButton,
  InlineKeyboardButton,
} from './bot-platform.interface.js';
import { logger } from '../logger.js';

/**
 * Адаптер для Telegram бота
 * Реализует интерфейс BotPlatform для работы с Telegram через Telegraf
 */
export class TelegramBotAdapter implements BotPlatform {
  private readonly bot: Telegraf;
  private callbackQueryHandlers: Map<string, (ctx: BotContext, data: string) => Promise<void> | void> = new Map();

  constructor(token: string) {
    this.bot = new Telegraf(token);
  }

  async launch(): Promise<void> {
    await this.bot.launch();
  }

  stop(reason: string): void {
    this.bot.stop(reason);
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: ReplyOptions,
  ): Promise<BotMessage> {
    const extra: any = {};

    if (options?.parseMode) {
      extra.parse_mode = options.parseMode === 'Markdown' ? 'Markdown' : options.parseMode;
    }

    if (options?.keyboard) {
      extra.reply_markup = Markup.keyboard(
        options.keyboard.map((row) => row.map((btn) => btn.text)),
      )
        .resize()
        .persistent().reply_markup;
    }

    if (options?.inlineKeyboard) {
      extra.reply_markup = Markup.inlineKeyboard(
        options.inlineKeyboard.map((row) =>
          row.map((btn) => Markup.button.callback(btn.text, btn.callbackData)),
        ),
      ).reply_markup;
    }

    const message = await this.bot.telegram.sendMessage(chatId, text, extra);
    return this.toBotMessage(message);
  }

  async editMessage(
    chatId: string | number,
    messageId: string | number,
    text: string,
    options?: ReplyOptions,
  ): Promise<void> {
    const extra: any = {};

    if (options?.parseMode) {
      extra.parse_mode = options.parseMode === 'Markdown' ? 'Markdown' : options.parseMode;
    }

    if (options?.inlineKeyboard) {
      extra.reply_markup = Markup.inlineKeyboard(
        options.inlineKeyboard.map((row) =>
          row.map((btn) => Markup.button.callback(btn.text, btn.callbackData)),
        ),
      ).reply_markup;
    }

    await this.bot.telegram.editMessageText(chatId, messageId, undefined, text, extra);
  }

  async deleteMessage(chatId: string | number, messageId: string | number): Promise<void> {
    await this.bot.telegram.deleteMessage(chatId, messageId);
  }

  onStart(handler: (ctx: BotContext) => Promise<void> | void): void {
    this.bot.start(async (ctx) => {
      const botCtx = this.toBotContext(ctx);
      await handler(botCtx);
    });
  }

  onCommand(command: string, handler: (ctx: BotContext) => Promise<void> | void): void {
    this.bot.command(command, async (ctx) => {
      const botCtx = this.toBotContext(ctx);
      await handler(botCtx);
    });
  }

  onText(text: string, handler: (ctx: BotContext) => Promise<void> | void): void {
    this.bot.hears(text, async (ctx) => {
      const botCtx = this.toBotContext(ctx);
      await handler(botCtx);
    });
  }

  onCallbackQuery(handler: (ctx: BotContext, data: string) => Promise<void> | void): void {
    this.bot.on('callback_query', async (ctx) => {
      if (!ctx.from || !('data' in ctx.callbackQuery)) return;

      const botCtx = this.toBotContext(ctx);
      const data = ctx.callbackQuery.data as string;

      try {
        await handler(botCtx, data);
      } catch (error) {
        logger.error(error, 'Ошибка в обработчике callback query');
      } finally {
        // Автоматически отвечаем на callback query, если еще не ответили
        try {
          await ctx.answerCbQuery().catch(() => {
            // Игнорируем ошибки, если уже ответили
          });
        } catch {
          // Игнорируем ошибки ответа
        }
      }
    });
  }

  onAnyText(handler: (ctx: BotContext) => Promise<void> | void): void {
    this.bot.on('text', async (ctx) => {
      const botCtx = this.toBotContext(ctx);
      await handler(botCtx);
    });
  }

  async answerCallbackQuery(callbackQueryId: string | number, text?: string): Promise<void> {
    // В Telegram это обрабатывается автоматически в onCallbackQuery
    // Но можно вызвать напрямую через bot.telegram.answerCbQuery
    await this.bot.telegram.answerCbQuery(String(callbackQueryId), text);
  }

  /**
   * Обработка обновления от Telegram (для webhook)
   */
  async handleUpdate(update: any): Promise<void> {
    await this.bot.handleUpdate(update);
  }

  private toBotContext(ctx: Context): BotContext {
    if (!ctx.from) {
      throw new Error('Context without user');
    }

    // Для callback query message может быть в callbackQuery.message
    let message = ctx.message && 'text' in ctx.message ? ctx.message : undefined;
    let chat = ctx.chat;

    // Если это callback query, пытаемся получить message из callbackQuery
    if (!message && 'callback_query' in ctx && ctx.callbackQuery && 'message' in ctx.callbackQuery) {
      const callbackMessage = ctx.callbackQuery.message;
      if (callbackMessage && 'text' in callbackMessage) {
        message = callbackMessage;
        chat = callbackMessage.chat;
      }
    }

    // Если все еще нет message, пытаемся создать минимальный контекст
    if (!message || !chat) {
      // Для callback query создаем минимальный контекст
      if ('callback_query' in ctx && ctx.callbackQuery) {
        const callbackMessage = ctx.callbackQuery.message;
        if (callbackMessage) {
          return {
            user: {
              id: ctx.from.id,
              firstName: ctx.from.first_name,
              username: ctx.from.username,
              platformId: String(ctx.from.id),
            },
            message: {
              text: 'text' in callbackMessage ? callbackMessage.text : '',
              messageId: callbackMessage.message_id,
              chatId: callbackMessage.chat.id,
            },
            chatId: callbackMessage.chat.id,
          };
        }
      }
      throw new Error('Invalid context: no message or chat');
    }

    return {
      user: {
        id: ctx.from.id,
        firstName: ctx.from.first_name,
        username: ctx.from.username,
        platformId: String(ctx.from.id),
      },
      message: {
        text: message.text,
        messageId: message.message_id,
        chatId: chat.id,
      },
      chatId: chat.id,
    };
  }

  private toBotMessage(message: Message.TextMessage | Message.CommonMessage): BotMessage {
    return {
      text: 'text' in message ? message.text : undefined,
      messageId: message.message_id,
      chatId: message.chat.id,
    };
  }
}

