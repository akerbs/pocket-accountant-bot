# Как получить Connection Pooling строку в Supabase

## Пошаговая инструкция

### Шаг 1: Откройте модалку подключения

1. В Supabase Dashboard выберите ваш проект
2. В левом меню нажмите **Settings** (шестеренка)
3. Выберите **Database**
4. Прокрутите вниз до раздела **"Connection string"**
5. Нажмите на кнопку, которая открывает модалку "Connect to your project"

### Шаг 2: Настройте Connection Pooling

В модалке "Connect to your project":

1. **Вкладка "Connection String"** должна быть активна (подчеркнута)

2. Найдите выпадающий список **"Method"** (сейчас там "Direct connection")

3. **Измените "Method"** на **"Connection pooling"** или **"Session mode"**

4. После изменения вы увидите новую строку подключения, которая будет выглядеть так:
   ```
   postgresql://postgres.wzloizeuxiffdquumphc:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
   ```

5. **Обратите внимание на отличия:**
   - Порт: `6543` (вместо `5432`)
   - Хост: `aws-0-[REGION].pooler.supabase.com` (вместо `db.xxxxx.supabase.co`)
   - Пользователь: `postgres.wzloizeuxiffdquumphc` (с точкой и ID проекта)

### Шаг 3: Скопируйте строку подключения

1. Скопируйте строку подключения из поля
2. Замените `[YOUR-PASSWORD]` на ваш реальный пароль: `i66y*sKc4j7BpF2`
3. Добавьте в конец `?sslmode=require`

**Итоговая строка должна выглядеть так:**
```
postgresql://postgres.wzloizeuxiffdquumphc:i66y*sKc4j7BpF2@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require
```

### Шаг 4: Обновите .env файл

Откройте файл `.env` и замените строку `DATABASE_URL`:

**Было:**
```env
DATABASE_URL="postgresql://postgres:i66y*sKc4j7BpF2@db.wzloizeuxiffdquumphc.supabase.co:5432/postgres?sslmode=require"
```

**Должно быть (с Connection Pooling):**
```env
DATABASE_URL="postgresql://postgres.wzloizeuxiffdquumphc:i66y*sKc4j7BpF2@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require"
```

**Важно:** Замените `eu-central-1` на ваш реальный регион (он будет указан в строке подключения).

### Шаг 5: Проверьте подключение

После обновления `.env` выполните:

```bash
npm run db:test
```

Или:

```bash
npm run db:setup:migrate
```

## Почему Connection Pooling лучше?

1. **Решает проблему IPv4** - если вы видите предупреждение "Not IPv4 compatible", Connection Pooling это исправляет
2. **Более стабильное подключение** - лучше работает с serverless функциями (Netlify Functions)
3. **Лучшая производительность** - оптимизирован для множественных подключений
4. **Рекомендуется для production** - Supabase рекомендует использовать pooling для production приложений

## Альтернативный способ

Если вы не видите опцию "Connection pooling" в выпадающем списке "Method":

1. В модалке "Connect to your project" найдите предупреждение о IPv4
2. Нажмите кнопку **"Pooler settings"**
3. Там вы найдете строку подключения для Connection Pooling

## Если все еще не работает

1. Убедитесь, что проект не приостановлен (paused) в Supabase Dashboard
2. Проверьте, что пароль правильный
3. Попробуйте использовать "Session mode" вместо "Connection pooling"
4. Проверьте настройки безопасности в Supabase: Settings → Database → Network restrictions

