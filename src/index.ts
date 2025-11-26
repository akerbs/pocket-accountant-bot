import "dotenv/config";
import { env } from "./config/env.js";
import { TelegramBotAdapter } from "./platforms/telegram-bot.adapter.js";
import { BotHandler } from "./handlers/bot-handler.js";
import { logger } from "./logger.js";

async function bootstrap() {
  logger.info("Инициализация бота...");

  const platform = new TelegramBotAdapter(env.BOT_TOKEN);
  const handler = new BotHandler(platform);
  handler.registerHandlers();

  logger.info("Экземпляр бота создан, запускаю подключение...");

  try {
    await platform.launch();
    logger.info("✅ Карманный бухгалтер запущен и готов к работе!");
  } catch (error) {
    logger.error(error, "Ошибка при запуске бота");
    throw error;
  }

  process.once("SIGINT", () => {
    logger.info("Получен SIGINT, останавливаю бота...");
    platform.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    logger.info("Получен SIGTERM, останавливаю бота...");
    platform.stop("SIGTERM");
  });
}

bootstrap().catch((error) => {
  logger.error(error, "Критическая ошибка при запуске бота");
  process.exit(1);
});
