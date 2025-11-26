/**
 * Интерфейс для абстракции различных платформ ботов
 * Позволяет использовать одну бизнес-логику для разных мессенджеров
 */
export interface BotUser {
  id: string | number;
  firstName?: string | null;
  username?: string | null;
  platformId: string; // Уникальный идентификатор пользователя на платформе
}

export interface BotMessage {
  text?: string;
  messageId: string | number;
  chatId: string | number;
}

export interface BotContext {
  user: BotUser;
  message: BotMessage;
  chatId: string | number;
}

export interface ReplyOptions {
  parseMode?: 'Markdown' | 'HTML' | 'Plain';
  keyboard?: KeyboardButton[][];
  inlineKeyboard?: InlineKeyboardButton[][];
}

export interface KeyboardButton {
  text: string;
}

export interface InlineKeyboardButton {
  text: string;
  callbackData: string;
}

export interface BotPlatform {
  /**
   * Запуск бота
   */
  launch(): Promise<void>;

  /**
   * Остановка бота
   */
  stop(reason: string): void;

  /**
   * Отправка сообщения пользователю
   */
  sendMessage(chatId: string | number, text: string, options?: ReplyOptions): Promise<BotMessage>;

  /**
   * Редактирование сообщения
   */
  editMessage(chatId: string | number, messageId: string | number, text: string, options?: ReplyOptions): Promise<void>;

  /**
   * Удаление сообщения
   */
  deleteMessage(chatId: string | number, messageId: string | number): Promise<void>;

  /**
   * Регистрация обработчика команды /start
   */
  onStart(handler: (ctx: BotContext) => Promise<void> | void): void;

  /**
   * Регистрация обработчика команды
   */
  onCommand(command: string, handler: (ctx: BotContext) => Promise<void> | void): void;

  /**
   * Регистрация обработчика текстового сообщения
   */
  onText(text: string, handler: (ctx: BotContext) => Promise<void> | void): void;

  /**
   * Регистрация обработчика callback query (inline кнопки)
   */
  onCallbackQuery(handler: (ctx: BotContext, data: string) => Promise<void> | void): void;

  /**
   * Регистрация обработчика любого текстового сообщения
   */
  onAnyText(handler: (ctx: BotContext) => Promise<void> | void): void;

  /**
   * Ответ на callback query (для inline кнопок)
   */
  answerCallbackQuery(callbackQueryId: string | number, text?: string): Promise<void>;
}

