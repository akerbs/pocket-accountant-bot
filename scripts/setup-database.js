#!/usr/bin/env node

/**
 * Скрипт для автоматической настройки базы данных
 * Помогает проверить подключение и выполнить миграции
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Цвета для консоли
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
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

// Проверка наличия .env файла
function checkEnvFile() {
  try {
    const envPath = join(rootDir, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    
    if (!envContent.includes('DATABASE_URL')) {
      error('DATABASE_URL не найден в .env файле');
      info('Создайте .env файл с DATABASE_URL');
      process.exit(1);
    }
    
    success('Файл .env найден');
    return true;
  } catch (err) {
    error('Файл .env не найден');
    info('Создайте .env файл в корне проекта');
    info('Пример содержимого:');
    console.log(`
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
BOT_TOKEN="your-bot-token"
DEFAULT_CURRENCY="RUB"
    `);
    process.exit(1);
  }
}

// Проверка подключения к базе данных
async function checkConnection() {
  info('Проверка подключения к базе данных...');
  
  try {
    const prisma = new PrismaClient();
    await prisma.$connect();
    success('Подключение к базе данных успешно!');
    await prisma.$disconnect();
    return true;
  } catch (err) {
    error(`Ошибка подключения: ${err.message}`);
    info('Проверьте:');
    info('  1. Правильность DATABASE_URL в .env');
    info('  2. Доступность базы данных из интернета');
    info('  3. Правильность пароля и имени пользователя');
    return false;
  }
}

// Генерация Prisma Client
function generatePrismaClient() {
  info('Генерация Prisma Client...');
  
  try {
    execSync('npx prisma generate', {
      cwd: rootDir,
      stdio: 'inherit',
    });
    success('Prisma Client сгенерирован');
    return true;
  } catch (err) {
    error('Ошибка генерации Prisma Client');
    return false;
  }
}

// Выполнение миграций
function runMigrations() {
  info('Выполнение миграций базы данных...');
  
  try {
    execSync('npx prisma migrate deploy', {
      cwd: rootDir,
      stdio: 'inherit',
    });
    success('Миграции выполнены успешно');
    return true;
  } catch (err) {
    warning('Ошибка выполнения миграций');
    info('Попробуйте выполнить вручную:');
    info('  npx prisma migrate deploy');
    return false;
  }
}

// Проверка структуры базы данных
async function checkDatabaseStructure() {
  info('Проверка структуры базы данных...');
  
  try {
    const prisma = new PrismaClient();
    
    // Проверяем наличие таблиц
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    
    if (Array.isArray(tables) && tables.length > 0) {
      success(`Найдено таблиц: ${tables.length}`);
      tables.forEach((table) => {
        info(`  - ${table.table_name}`);
      });
    } else {
      warning('Таблицы не найдены. Выполните миграции.');
    }
    
    await prisma.$disconnect();
    return true;
  } catch (err) {
    error(`Ошибка проверки структуры: ${err.message}`);
    return false;
  }
}

// Основная функция
async function main() {
  console.log('\n' + '='.repeat(50));
  log('Настройка базы данных для Pocket Accountant Bot', 'cyan');
  console.log('='.repeat(50) + '\n');
  
  // Шаг 1: Проверка .env
  if (!checkEnvFile()) {
    process.exit(1);
  }
  
  // Шаг 2: Генерация Prisma Client
  if (!generatePrismaClient()) {
    process.exit(1);
  }
  
  // Шаг 3: Проверка подключения
  if (!(await checkConnection())) {
    process.exit(1);
  }
  
  // Шаг 4: Выполнение миграций
  const migrate = process.argv.includes('--migrate') || process.argv.includes('-m');
  if (migrate) {
    if (!runMigrations()) {
      process.exit(1);
    }
  } else {
    info('Пропуск миграций (используйте --migrate для выполнения)');
  }
  
  // Шаг 5: Проверка структуры
  await checkDatabaseStructure();
  
  console.log('\n' + '='.repeat(50));
  success('Настройка завершена!');
  console.log('='.repeat(50) + '\n');
  
  info('Следующие шаги:');
  info('  1. Убедитесь, что DATABASE_URL добавлен в Netlify');
  info('  2. Разверните проект на Netlify');
  info('  3. Настройте webhook в Telegram');
  console.log();
}

main().catch((err) => {
  error(`Критическая ошибка: ${err.message}`);
  console.error(err);
  process.exit(1);
});

