# Устранение проблем с подключением к базе данных

## Ошибка: "Can't reach database server"

Если вы видите ошибку:
```
Can't reach database server at `db.wzloizeuxiffdquumphc.supabase.co:5432`
```

### Решение 1: Проверьте, что база данных не приостановлена

1. Откройте [Supabase Dashboard](https://app.supabase.com/)
2. Выберите ваш проект
3. Проверьте статус проекта в правом верхнем углу
4. Если проект приостановлен (paused), нажмите **"Restore"** или **"Resume"**
5. Подождите 1-2 минуты, пока база данных запустится

### Решение 2: Используйте Connection Pooling (рекомендуется)

Supabase рекомендует использовать Connection Pooling для лучшей производительности и надежности.

1. В Supabase Dashboard: **Settings** → **Database**
2. Прокрутите до **"Connection string"**
3. Выберите вкладку **"Connection pooling"** (не "URI"!)
4. Скопируйте строку подключения
5. Она будет выглядеть так:
   ```
   postgresql://postgres.wzloizeuxiffdquumphc:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```
6. Замените `[YOUR-PASSWORD]` на ваш пароль
7. Добавьте `?sslmode=require` в конец
8. Обновите `.env` файл

**Пример правильной строки с Connection Pooling:**
```
postgresql://postgres.wzloizeuxiffdquumphc:i66y*sKc4j7BpF2@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
```

**Отличия:**
- Порт: `6543` (вместо `5432`)
- Хост: `aws-0-[REGION].pooler.supabase.com` (вместо `db.xxxxx.supabase.co`)
- Пользователь: `postgres.xxxxx` (с точкой и ID проекта)

### Решение 3: Проверьте правильность хоста

Убедитесь, что вы используете правильный хост:

1. В Supabase Dashboard: **Settings** → **Database**
2. Найдите раздел **"Connection info"**
3. Проверьте:
   - **Host**: должен быть `db.xxxxx.supabase.co` или `aws-0-xxx.pooler.supabase.com`
   - **Port**: `5432` для прямого подключения или `6543` для pooling
   - **Database name**: обычно `postgres`

### Решение 4: Проверьте настройки безопасности

1. В Supabase Dashboard: **Settings** → **Database**
2. Найдите раздел **"Network restrictions"**
3. Убедитесь, что нет ограничений по IP
4. Или добавьте ваш IP в whitelist (если ограничения включены)

### Решение 5: Проверьте пароль

1. В Supabase Dashboard: **Settings** → **Database**
2. Найдите раздел **"Database password"**
3. Если забыли пароль, нажмите **"Reset database password"**
4. Установите новый пароль
5. Обновите `DATABASE_URL` в `.env` с новым паролем

### Решение 6: Попробуйте другой формат строки

Если ничего не помогает, попробуйте использовать формат с явным указанием параметров:

```
postgresql://postgres:i66y*sKc4j7BpF2@db.wzloizeuxiffdquumphc.supabase.co:5432/postgres?sslmode=require&connect_timeout=10
```

## Быстрая проверка

Выполните команду для проверки подключения:

```bash
npm run db:validate
```

Это проверит формат строки подключения.

## Тестирование подключения напрямую

Можно проверить подключение через psql (если установлен):

```bash
psql "postgresql://postgres:i66y*sKc4j7BpF2@db.wzloizeuxiffdquumphc.supabase.co:5432/postgres?sslmode=require"
```

Или через Node.js:

```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.\$connect().then(() => { console.log('✅ Подключение успешно!'); prisma.\$disconnect(); }).catch(e => { console.error('❌ Ошибка:', e.message); process.exit(1); });"
```

## Частые проблемы

### Проблема: База данных "спит" на бесплатном тарифе

**Решение:** 
- Supabase может автоматически приостанавливать проекты на бесплатном тарифе после периода неактивности
- Просто откройте проект в Dashboard и он автоматически "проснется"
- Или используйте Connection Pooling, который более стабилен

### Проблема: Таймаут подключения

**Решение:**
- Добавьте параметр `connect_timeout=10` в строку подключения
- Используйте Connection Pooling (порт 6543)

### Проблема: SSL ошибки

**Решение:**
- Убедитесь, что в конце строки есть `?sslmode=require`
- Для некоторых регионов может потребоваться `?sslmode=prefer`

## Если ничего не помогает

1. Создайте новый проект в Supabase
2. Скопируйте новую строку подключения
3. Обновите `.env` файл
4. Выполните миграции заново

Или попробуйте альтернативные сервисы:
- [Railway](https://railway.app/) - также бесплатный PostgreSQL
- [Render](https://render.com/) - бесплатный PostgreSQL

