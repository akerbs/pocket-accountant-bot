#!/usr/bin/env node

/**
 * Скрипт для проверки правильности формата DATABASE_URL
 */

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

// Чтение .env файла
function readEnvFile() {
  try {
    const envPath = join(rootDir, '.env');
    const envContent = readFileSync(envPath, 'utf-8');
    return envContent;
  } catch (err) {
    error('Файл .env не найден');
    return null;
  }
}

// Парсинг DATABASE_URL
function parseDatabaseUrl(url) {
  try {
    const urlObj = new URL(url);
    return {
      protocol: urlObj.protocol,
      username: urlObj.username,
      password: urlObj.password,
      hostname: urlObj.hostname,
      port: urlObj.port,
      pathname: urlObj.pathname,
      search: urlObj.search,
      isValid: true,
    };
  } catch (err) {
    return { isValid: false, error: err.message };
  }
}

// Валидация DATABASE_URL
function validateDatabaseUrl(url) {
  const issues = [];
  
  // Проверка формата
  if (!url.startsWith('postgresql://')) {
    issues.push('URL должен начинаться с postgresql://');
  }
  
  // Парсинг
  const parsed = parseDatabaseUrl(url);
  if (!parsed.isValid) {
    issues.push(`Ошибка парсинга: ${parsed.error}`);
    return { valid: false, issues, parsed: null };
  }
  
  // Проверка компонентов
  if (!parsed.username || parsed.username === '') {
    issues.push('Отсутствует имя пользователя (обычно должно быть "postgres")');
  }
  
  if (!parsed.password || parsed.password === '') {
    issues.push('Отсутствует пароль');
  } else if (parsed.password.startsWith('http://') || parsed.password.startsWith('https://')) {
    issues.push('⚠️  Пароль не должен быть URL! Пароль - это тот, который вы указали при создании проекта в Supabase.');
  } else if (parsed.password.length < 8) {
    issues.push('⚠️  Пароль слишком короткий (обычно пароли Supabase длиннее)');
  }
  
  if (!parsed.hostname || parsed.hostname === '') {
    issues.push('Отсутствует хост');
  } else if (!parsed.hostname.includes('supabase.co') && !parsed.hostname.includes('railway.app') && !parsed.hostname.includes('render.com')) {
    warning('Хост не похож на стандартный хост Supabase/Railway/Render');
  }
  
  if (!parsed.port || parsed.port === '') {
    issues.push('Отсутствует порт (обычно 5432 или 6543)');
  }
  
  if (!parsed.pathname || parsed.pathname === '/' || parsed.pathname === '') {
    issues.push('Отсутствует имя базы данных (обычно должно быть "/postgres")');
  }
  
  if (!parsed.search || !parsed.search.includes('sslmode=require')) {
    issues.push('⚠️  Рекомендуется добавить ?sslmode=require для безопасного подключения');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    parsed,
  };
}

// Основная функция
function main() {
  console.log('\n' + '='.repeat(60));
  log('Проверка формата DATABASE_URL', 'cyan');
  console.log('='.repeat(60) + '\n');
  
  const envContent = readEnvFile();
  if (!envContent) {
    process.exit(1);
  }
  
  // Извлечение DATABASE_URL
  const dbUrlMatch = envContent.match(/DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/);
  if (!dbUrlMatch) {
    error('DATABASE_URL не найден в .env файле');
    process.exit(1);
  }
  
  const databaseUrl = dbUrlMatch[1].trim();
  info(`Найден DATABASE_URL: ${databaseUrl.substring(0, 30)}...`);
  console.log();
  
  // Валидация
  const validation = validateDatabaseUrl(databaseUrl);
  
  if (validation.valid) {
    success('Формат DATABASE_URL правильный!');
    console.log();
    info('Детали подключения:');
    console.log(`  Протокол: ${validation.parsed.protocol}`);
    console.log(`  Пользователь: ${validation.parsed.username}`);
    console.log(`  Пароль: ${'*'.repeat(Math.min(validation.parsed.password.length, 20))} (${validation.parsed.password.length} символов)`);
    console.log(`  Хост: ${validation.parsed.hostname}`);
    console.log(`  Порт: ${validation.parsed.port || 'по умолчанию'}`);
    console.log(`  База данных: ${validation.parsed.pathname}`);
    console.log();
    success('Можно продолжать настройку!');
  } else {
    error('Обнаружены проблемы в формате DATABASE_URL:');
    console.log();
    validation.issues.forEach((issue, index) => {
      if (issue.startsWith('⚠️')) {
        warning(`  ${index + 1}. ${issue}`);
      } else {
        error(`  ${index + 1}. ${issue}`);
      }
    });
    console.log();
    info('Как исправить:');
    console.log('  1. Откройте Supabase Dashboard');
    console.log('  2. Settings → Database → Connection string → URI');
    console.log('  3. Скопируйте строку подключения');
    console.log('  4. Замените [YOUR-PASSWORD] на ваш реальный пароль');
    console.log('  5. Добавьте ?sslmode=require в конец');
    console.log('  6. Обновите .env файл');
    console.log();
    info('Подробная инструкция: см. FIX_DATABASE_URL.md');
    process.exit(1);
  }
  
  console.log();
}

main();

