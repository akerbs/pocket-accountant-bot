# Настройка базы данных PostgreSQL

Это руководство поможет вам настроить базу данных PostgreSQL для бота Pocket Accountant.

## Вариант 1: Supabase (Рекомендуется - бесплатный тариф)

Supabase предоставляет бесплатный PostgreSQL с 500 МБ хранилища, что более чем достаточно для бота.

### Шаг 1: Создание проекта в Supabase

1. Перейдите на [https://supabase.com/](https://supabase.com/)
2. Нажмите **"Start your project"** или **"Sign in"**
3. Войдите через GitHub (или создайте аккаунт)
4. Нажмите **"New Project"**
5. Заполните форму:
   - **Name**: `pocket-accountant-bot` (или любое другое имя)
   - **Database Password**: придумайте надежный пароль (сохраните его!)
   - **Region**: выберите ближайший регион (например, `West EU (Ireland)`)
   - Нажмите **"Create new project"**

6. Подождите 1-2 минуты, пока проект создается

### Шаг 2: Получение DATABASE_URL

1. В проекте Supabase перейдите в **Settings** (шестеренка внизу слева)
2. Выберите **Database** в меню слева
3. Прокрутите вниз до раздела **"Connection string"**
4. Выберите вкладку **"URI"**
5. Скопируйте строку подключения (она выглядит так):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
6. Замените `[YOUR-PASSWORD]` на пароль, который вы указали при создании проекта
7. Добавьте в конец строки `?sslmode=require`:
   ```
   postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres?sslmode=require
   ```

### Шаг 3: Настройка локально

1. Создайте файл `.env` в корне проекта (если его еще нет):
   ```bash
   cd cursor/pocket-accountant-bot
   cp .env.example .env  # если есть .env.example
   ```

2. Добавьте в `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:your-password@db.xxxxx.supabase.co:5432/postgres?sslmode=require"
   BOT_TOKEN="your-bot-token"
   DEFAULT_CURRENCY="RUB"
   ```

3. Обновите schema.prisma для PostgreSQL (если еще не обновлен):
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. Выполните миграции:
   ```bash
   npm run prisma:generate
   npx prisma migrate deploy
   ```

### Шаг 4: Настройка в Netlify

1. В Netlify Dashboard перейдите в ваш сайт
2. Откройте **Site settings** → **Environment variables**
3. Добавьте переменную:
   - **Key**: `DATABASE_URL`
   - **Value**: ваша строка подключения (та же, что в `.env`)
4. Нажмите **Save**

---

## Вариант 2: Railway (Альтернатива)

Railway также предоставляет бесплатный PostgreSQL.

### Шаг 1: Создание проекта

1. Перейдите на [https://railway.app/](https://railway.app/)
2. Войдите через GitHub
3. Нажмите **"New Project"**
4. Выберите **"Provision PostgreSQL"**
5. Дождитесь создания базы данных

### Шаг 2: Получение DATABASE_URL

1. Откройте созданную базу данных PostgreSQL
2. Перейдите на вкладку **"Variables"**
3. Найдите переменную `DATABASE_URL`
4. Скопируйте значение (оно уже в правильном формате)

### Шаг 3: Настройка

Следуйте шагам 3-4 из варианта с Supabase.

---

## Вариант 3: Render (Альтернатива)

### Шаг 1: Создание базы данных

1. Перейдите на [https://render.com/](https://render.com/)
2. Войдите через GitHub
3. Нажмите **"New +"** → **"PostgreSQL"**
4. Заполните форму:
   - **Name**: `pocket-accountant-db`
   - **Database**: `pocket_accountant`
   - **User**: `pocket_accountant_user`
   - **Region**: выберите ближайший
   - **PostgreSQL Version**: `15` (или последняя)
   - **Plan**: `Free` (для начала)
5. Нажмите **"Create Database"**

### Шаг 2: Получение DATABASE_URL

1. После создания базы данных откройте её
2. Найдите раздел **"Connections"**
3. Скопируйте **"Internal Database URL"** или **"External Database URL"**
4. Формат будет таким:
   ```
   postgresql://user:password@host:port/database
   ```

### Шаг 3: Настройка

Следуйте шагам 3-4 из варианта с Supabase.

---

## Автоматическая настройка (скрипт)

Для упрощения настройки используйте скрипт `setup-database.js`:

```bash
node scripts/setup-database.js
```

Скрипт поможет:
- Проверить подключение к базе данных
- Выполнить миграции
- Создать тестовые данные (опционально)

---

## Проверка подключения

После настройки проверьте подключение:

```bash
# Локально
npx prisma studio
```

Если Prisma Studio открылся - подключение работает!

Или через Node.js:

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => console.log('✅ Подключение успешно!')).catch(e => console.error('❌ Ошибка:', e)).finally(() => prisma.\$disconnect())"
```

---

## Миграция с SQLite на PostgreSQL

Если у вас уже есть данные в SQLite:

1. Экспортируйте данные из SQLite:
   ```bash
   npx prisma db pull
   ```

2. Обновите `schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Выполните миграции:
   ```bash
   npx prisma migrate dev --name migrate_to_postgresql
   ```

4. Импортируйте данные (если нужно):
   ```bash
   # Используйте инструменты для миграции данных
   # Например: pgloader или ручной скрипт
   ```

---

## Устранение неполадок

### Ошибка подключения

- Проверьте, что `DATABASE_URL` правильный
- Убедитесь, что база данных доступна из интернета
- Проверьте, что пароль правильный
- Для Supabase: убедитесь, что добавили `?sslmode=require`

### Ошибка миграций

```bash
# Сброс базы данных (ОСТОРОЖНО: удалит все данные!)
npx prisma migrate reset

# Или создайте новую миграцию
npx prisma migrate dev --name init
```

### База данных недоступна

- Проверьте, что база данных не приостановлена (на бесплатном тарифе может быть автопауза)
- Для Supabase: проверьте статус проекта в Dashboard
- Для Railway: проверьте, что проект не спит

---

## Безопасность

⚠️ **Важно:**
- Никогда не коммитьте `.env` файл в Git
- Используйте разные базы данных для разработки и production
- Регулярно делайте резервные копии
- Используйте надежные пароли

---

## Дополнительные ресурсы

- [Документация Supabase](https://supabase.com/docs)
- [Документация Railway](https://docs.railway.app/)
- [Документация Prisma](https://www.prisma.io/docs)
- [PostgreSQL документация](https://www.postgresql.org/docs/)

