# Исправление DATABASE_URL

## Проблема

В вашем `.env` файле `DATABASE_URL` указан неправильно:
```
DATABASE_URL="https://wzloizeuxiffdquumphc.supabase.co"
```

Это просто домен, а нужна полная строка подключения PostgreSQL.

## Решение

### Шаг 1: Получите правильный DATABASE_URL из Supabase

1. Откройте ваш проект в [Supabase Dashboard](https://app.supabase.com/)
2. Перейдите в **Settings** (шестеренка внизу слева)
3. Выберите **Database** в меню слева
4. Прокрутите вниз до раздела **"Connection string"**
5. Выберите вкладку **"URI"** (не "Connection pooling"!)
6. Вы увидите строку вида:
   ```
   postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
   
   **ИЛИ** (в зависимости от версии Supabase):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
   ```

7. **Важно:** Замените `[YOUR-PASSWORD]` на пароль, который вы указали при создании проекта
8. Добавьте в конец строки `?sslmode=require`

### Шаг 2: Обновите .env файл

Замените строку в `.env`:

**Было:**
```env
DATABASE_URL="https://wzloizeuxiffdquumphc.supabase.co"
```

**Должно быть:**
```env
DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@db.wzloizeuxiffdquumphc.supabase.co:5432/postgres?sslmode=require"
```

**Пример правильного формата:**
```env
DATABASE_URL="postgresql://postgres:MySecurePassword123@db.wzloizeuxiffdquumphc.supabase.co:5432/postgres?sslmode=require"
```

### Шаг 3: Проверьте подключение

После обновления `.env` выполните:

```bash
npm run db:setup:migrate
```

Если все правильно, вы увидите:
```
✅ Подключение к базе данных успешно!
✅ Миграции выполнены успешно
```

## Если забыли пароль базы данных

Если вы забыли пароль базы данных:

1. В Supabase Dashboard: **Settings** → **Database**
2. Найдите раздел **"Database password"**
3. Нажмите **"Reset database password"**
4. Установите новый пароль
5. Обновите `DATABASE_URL` в `.env` с новым паролем

## Формат DATABASE_URL

Правильный формат для PostgreSQL:
```
postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE]?sslmode=require
```

Где:
- `[USER]` - обычно `postgres`
- `[PASSWORD]` - ваш пароль базы данных
- `[HOST]` - хост базы данных (например, `db.xxxxx.supabase.co`)
- `[PORT]` - обычно `5432` для прямого подключения или `6543` для connection pooling
- `[DATABASE]` - обычно `postgres`
- `?sslmode=require` - обязательно для безопасного подключения

## Альтернативный способ (Connection Pooling)

Если вы используете Connection Pooling (рекомендуется для production):

1. В Supabase: **Settings** → **Database** → **Connection string**
2. Выберите вкладку **"Connection pooling"**
3. Скопируйте строку (она будет с портом `6543`)
4. Добавьте `?sslmode=require`

Пример:
```
postgresql://postgres.wzloizeuxiffdquumphc:ВАШ_ПАРОЛЬ@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
```

