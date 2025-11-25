import dayjs from 'dayjs';
import { StatsSnapshot } from './stats.service.js';

interface RecommendationContext {
  stats: StatsSnapshot;
  lastPurchaseDate?: Date;
}

export class RecommendationService {
  build(context: RecommendationContext): string[] {
    const tips: string[] = [];
    const { stats, lastPurchaseDate } = context;
    const topCategory = stats.categories[0];

    if (topCategory && topCategory.share > 0.45) {
      tips.push(
        `${topCategory.emoji ?? '📌'} Категория *${topCategory.name}* тянет ${(
          topCategory.share * 100
        ).toFixed(0)} % бюджета. Подумай о мягком лимите или дневном чек‑листе.`,
      );
    }

    if (topCategory?.limitInfo && topCategory.limitInfo.exceeded) {
      tips.push(
        `🚨 Лимит для *${topCategory.name}* превышен. Зафиксируй обязательные траты и перенеси остальное на следующий месяц.`,
      );
    } else if (topCategory?.limitCoverage && topCategory.limitCoverage > 0.75) {
      tips.push(
        `⚠️ До лимита по *${topCategory.name}* осталось ${(
          100 -
          topCategory.limitCoverage * 100
        ).toFixed(0)} %. Проверь подписки и авто‑платежи.`,
      );
    }

    if (stats.week > stats.month * 0.5) {
      tips.push('📈 Недельные расходы догоняют месячные. Попробуй «неделю экономии» с твёрдыми лимитами.');
    }

    if (stats.categories.length >= 3) {
      const tail = stats.categories.slice(-2).filter((c) => c.share < 0.05);
      if (tail.length === 2) {
        tips.push('🧺 Есть мелкие категории <5 %. Объедини их в «Другое», чтобы фокусироваться на крупных расходах.');
      }
    }

    if (lastPurchaseDate) {
      const days = dayjs().diff(dayjs(lastPurchaseDate), 'day');
      if (days >= 3) {
        tips.push('⏱ Уже несколько дней без записей. Зафиксируй чеки, чтобы не потерять контекст.');
      }
    }

    if (tips.length === 0) {
      tips.push('✨ Баланс выглядит устойчиво. Продолжай фиксировать расходы в том же темпе.');
    }

    return tips.slice(0, 3);
  }
}

