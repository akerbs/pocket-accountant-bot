# Деплой через Drag and Drop на Netlify

## ⚠️ Важно: Что перетаскивать

**НЕ перетаскивайте папку с `node_modules`!**

Netlify сам установит зависимости при сборке. Используйте один из вариантов ниже.

## Вариант 1: Перетащить папку проекта (рекомендуется)

Netlify автоматически:
- ✅ Игнорирует `node_modules` (благодаря `.netlifyignore`)
- ✅ Выполнит `npm install` при сборке
- ✅ Использует только нужные файлы

**Просто перетащите папку `cursor/pocket-accountant-bot`** - Netlify сам разберется!

## Вариант 2: Создать архив без лишних файлов

Если хотите быть уверены, создайте архив:

1. **Создайте ZIP архив** папки проекта
2. **Исключите из архива:**
   - `node_modules/`
   - `.env` (переменные настроите в Netlify)
   - `dist/` (создастся при сборке)
   - `.git/`
   - Локальные файлы БД (`*.db`, `*.sqlite`)

3. **Перетащите ZIP архив** в Netlify Drop

## Вариант 3: Использовать Git (лучший вариант)

Если проект уже в Git (как у вас):
1. Просто запушьте изменения: `git push`
2. Netlify автоматически задеплоит из Git
3. Не нужно ничего перетаскивать!

## Что происходит при Drag and Drop

Когда вы перетаскиваете папку, Netlify:

1. ✅ **Игнорирует** файлы из `.netlifyignore` (включая `node_modules`)
2. ✅ **Устанавливает зависимости:** `npm install`
3. ✅ **Выполняет сборку:** `npm run build` (из `netlify.toml`)
4. ✅ **Собирает функции** из `netlify/functions/`
5. ✅ **Создает endpoint** `/webhook`

## Шаг 1: Деплой

1. Откройте [Netlify Drop](https://app.netlify.com/drop)
2. **Перетащите папку `cursor/pocket-accountant-bot`** в область деплоя
3. Netlify начнет автоматический деплой

## Шаг 2: Настройка переменных окружения

**Сразу после начала деплоя** настройте переменные:

1. В Netlify Dashboard откройте ваш сайт
2. **Site settings** → **Environment variables**
3. Добавьте:
   - `BOT_TOKEN` = ваш токен Telegram бота
   - `DATABASE_URL` = строка подключения PostgreSQL (Connection Pooling)
   - `DEFAULT_CURRENCY` = `RUB` (опционально)
   - `NODE_ENV` = `production`

## Шаг 3: Выполнение миграций

После успешного деплоя выполните миграции локально:

```bash
cd cursor\pocket-accountant-bot
npx prisma migrate deploy
```

Или если хотите использовать DATABASE_URL из Netlify:
```bash
# Получите DATABASE_URL из Netlify Dashboard
# Затем:
DATABASE_URL="ваш_url_из_netlify" npx prisma migrate deploy
```

## Шаг 4: Настройка webhook

После успешного деплоя:

1. Получите URL вашего сайта (например: `https://your-site.netlify.app`)
2. Установите webhook:
   ```bash
   curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook?url=https://your-site.netlify.app/webhook"
   ```
3. Проверьте:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

## Проверка после деплоя

1. **Логи сборки:** Netlify Dashboard → **Deploys** → выберите деплой → **Build log**
2. **Логи функций:** **Functions** → **webhook** → **Logs**
3. **Тест бота:** Отправьте `/start` боту в Telegram

## Если что-то не работает

1. Проверьте логи сборки в Netlify
2. Убедитесь, что все переменные окружения настроены
3. Проверьте, что миграции выполнены
4. Проверьте webhook в Telegram

## Рекомендация

Если проект уже подключен к Git (как у вас), **лучше использовать Git деплой**:
- Автоматические обновления при push
- История изменений
- Не нужно перетаскивать файлы

Просто выполните:
```bash
git push
```

И Netlify автоматически задеплоит изменения!
