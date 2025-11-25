import "dotenv/config";
import { PocketAccountantBot } from "./pocket-accountant.bot.js";
import { logger } from "./logger.js";

async function bootstrap() {
  logger.info("Инициализация бота...");

  const bot = new PocketAccountantBot();
  logger.info("Экземпляр бота создан, запускаю подключение...");

  try {
    await bot.launch();
    logger.info("✅ Карманный бухгалтер запущен и готов к работе!");
  } catch (error) {
    logger.error(error, "Ошибка при запуске бота");
    throw error;
  }

  process.once("SIGINT", () => {
    logger.info("Получен SIGINT, останавливаю бота...");
    bot.stop("SIGINT");
  });
  process.once("SIGTERM", () => {
    logger.info("Получен SIGTERM, останавливаю бота...");
    bot.stop("SIGTERM");
  });
}

bootstrap().catch((error) => {
  logger.error(error, "Критическая ошибка при запуске бота");
  process.exit(1);
});
