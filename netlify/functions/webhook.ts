import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions';
import { env } from '../../dist/config/env.js';
import { TelegramBotAdapter } from '../../dist/platforms/telegram-bot.adapter.js';
import { BotHandler } from '../../dist/handlers/bot-handler.js';
import { logger } from '../../dist/logger.js';

// Инициализация бота (singleton для переиспользования между вызовами)
let botAdapter: TelegramBotAdapter | null = null;
let botHandler: BotHandler | null = null;

function initializeBot() {
  if (botAdapter && botHandler) {
    return { botAdapter, botHandler };
  }

  botAdapter = new TelegramBotAdapter(env.BOT_TOKEN);
  botHandler = new BotHandler(botAdapter);
  botHandler.registerHandlers();

  return { botAdapter, botHandler };
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext,
): Promise<{ statusCode: number; body: string }> => {
  // Netlify Functions имеют ограничение по времени выполнения
  // Устанавливаем таймаут для завершения обработки
  context.callbackWaitsForEmptyEventLoop = false;

  try {
    // Проверяем метод запроса
    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: 'Method not allowed' }),
      };
    }

    // Парсим тело запроса
    const update = JSON.parse(event.body || '{}');

    // Инициализируем бота
    const { botAdapter } = initializeBot();

    // Обрабатываем обновление
    await botAdapter.handleUpdate(update);

    // Возвращаем успешный ответ
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch (error) {
    logger.error(error, 'Ошибка при обработке webhook');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

