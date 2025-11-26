# Быстрая настройка базы данных

## 🚀 Самый быстрый способ (Supabase)

### 1. Создайте проект на Supabase

1. Перейдите на [https://supabase.com/](https://supabase.com/)
2. Войдите через GitHub
3. Нажмите **"New Project"**
4. Заполните:
   - **Name**: `pocket-accountant-bot`
   - **Database Password**: придумайте пароль (сохраните!)
   - **Region**: выберите ближайший
5. Нажмите **"Create new project"** и подождите 1-2 минуты

### 2. Получите DATABASE_URL

1. В проекте: **Settings** → **Database**
2. Прокрутите до **"Connection string"** → вкладка **"URI"**
3. Скопируйте строку (пример):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
4. Замените `[YOUR-PASSWORD]` на ваш пароль
5. Добавьте в конец: `?sslmode=require`
6. Итоговая строка:
   ```
   postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres?sslmode=require
   ```

### 3. Настройте локально

```bash
# 1. Создайте .env файл
cp env.example .env

# 2. Откройте .env и вставьте ваш DATABASE_URL
# DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres?sslmode=require"

# 3. Запустите автоматическую настройку
npm run db:setup:migrate
```

### 4. Настройте в Netlify

1. Netlify Dashboard → ваш сайт → **Site settings** → **Environment variables**
2. Добавьте:
   - **Key**: `DATABASE_URL`
   - **Value**: та же строка, что в `.env`
3. Нажмите **Save**

## ✅ Готово!

Теперь база данных настроена. Переходите к следующему шагу в [NETLIFY_SETUP.md](./NETLIFY_SETUP.md).

---

## 📚 Другие варианты

- **Railway**: [DATABASE_SETUP.md](./DATABASE_SETUP.md#вариант-2-railway-альтернатива)
- **Render**: [DATABASE_SETUP.md](./DATABASE_SETUP.md#вариант-3-render-альтернатива)

## 🆘 Проблемы?

См. раздел "Устранение неполадок" в [DATABASE_SETUP.md](./DATABASE_SETUP.md#устранение-неполадок)

