import { z } from 'zod';

const purchaseSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(2),
  note: z.string().optional(),
});

export type ParsedPurchaseInput = z.infer<typeof purchaseSchema>;

export function parsePurchaseInput(raw: string): ParsedPurchaseInput {
  const cleaned = raw.replace(',', '.').replace(/ +/g, ' ').trim();
  const parts = cleaned.split(/;|\||,/).map((chunk) => chunk.trim());

  if (parts.length < 2) {
    throw new Error('Используй формат: сумма; категория; комментарий (по желанию).');
  }

  const amount = Number(parts[0]);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error('Сумма должна быть положительным числом.');
  }

  const category = parts[1];
  const note = parts.slice(2).join(' · ') || undefined;

  return purchaseSchema.parse({ amount, category, note });
}

const limitSchema = z.object({
  category: z.string().min(2),
  amount: z.number().positive(),
});

export type ParsedLimitInput = z.infer<typeof limitSchema>;

export function parseLimitInput(raw: string): ParsedLimitInput {
  const cleaned = raw.replace(',', '.').trim();
  const parts = cleaned.split(/;|\|/).map((chunk) => chunk.trim());

  if (parts.length < 2) {
    throw new Error('Формат лимита: категория; сумма. Пример: Продукты; 15000');
  }

  const amount = Number(parts[1]);
  if (Number.isNaN(amount) || amount <= 0) {
    throw new Error('Сумма лимита должна быть положительным числом.');
  }

  return limitSchema.parse({ category: parts[0], amount });
}

