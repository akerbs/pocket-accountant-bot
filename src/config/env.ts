import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN обязателен'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL обязателен'),
  DEFAULT_CURRENCY: z.string().min(3).max(5).default('RUB'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export const env: EnvConfig = envSchema.parse({
  BOT_TOKEN: process.env.BOT_TOKEN,
  DATABASE_URL: process.env.DATABASE_URL,
  DEFAULT_CURRENCY: process.env.DEFAULT_CURRENCY ?? 'RUB',
});

