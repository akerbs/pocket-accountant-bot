# Обновление .env файла

## Правильная строка для Connection Pooling

Обновите файл `.env` и замените строку `DATABASE_URL`:

**Было:**
```env
DATABASE_URL="postgresql://postgres:i66y*sKc4j7BpF2@db.wzloizeuxiffdquumphc.supabase.co:5432/postgres?sslmode=require"
```

**Должно быть:**
```env
DATABASE_URL="postgresql://postgres.wzloizeuxiffdquumphc:i66y*sKc4j7BpF2@aws-1-eu-north-1.pooler.supabase.com:5432/postgres?sslmode=require"
```

## Что изменилось:

1. ✅ Пользователь: `postgres.wzloizeuxiffdquumphc` (с точкой и ID проекта)
2. ✅ Хост: `aws-1-eu-north-1.pooler.supabase.com` (Connection Pooling)
3. ✅ Пароль: `i66y*sKc4j7BpF2` (ваш пароль)
4. ✅ Порт: `5432`
5. ✅ База данных: `postgres`
6. ✅ SSL: `?sslmode=require`

## После обновления:

Выполните проверку подключения:

```bash
npm run db:test
```

Или выполните миграции:

```bash
npm run db:setup:migrate
```

