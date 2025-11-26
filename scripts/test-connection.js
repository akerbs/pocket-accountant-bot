#!/usr/bin/env node

/**
 * Скрипт для тестирования подключения к базе данных
 */

import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  const colorValue = colors[color] || colors.reset;
  console.log(`${colorValue}${message}${colors.reset}`);
}

function error(message) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function success(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function info(message) {
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function warning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

// Чтение DATABASE_URL из .env
function getDatabaseUrl() {
  try {
    const envPath = join(rootDir, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    const match = envContent.match(/DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/);
    if (!match) {
      error('DATABASE_URL не найден в .env');
      return null;
    }
    return match[1].trim();
  } catch (err) {
    error(`Ошибка чтения .env: ${err.message}`);
    return null;
  }
}

// Тестирование подключения
async function testConnection() {
  console.log('\n' + '='.repeat(60));
  log('Тестирование подключения к базе данных', 'cyan');
  console.log('='.repeat(60) + '\n');

  const dbUrl = getDatabaseUrl();
  if (!dbUrl) {
    process.exit(1);
  }

  // Показываем часть URL (без пароля)
  const safeUrl = dbUrl.replace(/:[^:@]+@/, ':****@');
  info(`Попытка подключения: ${safeUrl.substring(0, 60)}...`);
  console.log();

  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    info('Подключение к базе данных...');
    await prisma.$connect();
    success('Подключение успешно!');
    console.log();

    // Пробуем выполнить простой запрос
    info('Выполнение тестового запроса...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    success('Тестовый запрос выполнен успешно!');
    console.log();

    // Проверяем наличие таблиц
    info('Проверка структуры базы данных...');
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;

    if (Array.isArray(tables) && tables.length > 0) {
      success(`Найдено таблиц: ${tables.length}`);
      tables.forEach((table) => {
        info(`  - ${table.table_name}`);
      });
    } else {
      warning('Таблицы не найдены. Возможно, нужно выполнить миграции.');
      info('Выполните: npm run db:setup:migrate');
    }

    console.log();
    success('Все проверки пройдены успешно!');
    console.log();
    info('База данных готова к использованию!');
  } catch (err) {
    error(`Ошибка подключения: ${err.message}`);
    console.log();

    // Детальная диагностика
    if (err.message.includes("Can't reach database server")) {
      warning('Не удается достичь сервера базы данных.');
      console.log();
      info('Возможные причины:');
      info('  1. База данных приостановлена (проверьте Supabase Dashboard)');
      info('  2. Неправильный хост или порт');
      info('  3. Проблемы с сетью/файрволом');
      console.log();
      info('Решения:');
      info('  1. Откройте проект в Supabase Dashboard - это "разбудит" базу данных');
      info('  2. Попробуйте использовать Connection Pooling (порт 6543)');
      info('  3. Проверьте настройки безопасности в Supabase');
      console.log();
      info('Подробная инструкция: см. TROUBLESHOOTING_DATABASE.md');
    } else if (err.message.includes('password authentication failed')) {
      error('Неверный пароль или имя пользователя');
      info('Проверьте пароль в Supabase Dashboard: Settings → Database');
    } else if (err.message.includes('does not exist')) {
      error('База данных не существует');
      info('Проверьте имя базы данных в строке подключения');
    } else {
      error('Неизвестная ошибка');
      console.log();
      info('Детали ошибки:');
      console.error(err);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection().catch((err) => {
  error(`Критическая ошибка: ${err.message}`);
  console.error(err);
  process.exit(1);
});

