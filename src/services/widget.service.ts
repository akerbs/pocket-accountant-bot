import dayjs from 'dayjs';
import { StatsSnapshot } from './stats.service.js';

export class WidgetService {
  private readonly barLength = 12;

  renderSummary(stats: StatsSnapshot) {
    return [
      '*📊 Быстрый обзор*',
      `Сегодня: ${this.money(stats.today, stats.currency)}`,
      `Неделя: ${this.money(stats.week, stats.currency)}`,
      `Месяц: ${this.money(stats.month, stats.currency)}`,
    ].join('\n');
  }

  renderCategories(stats: StatsSnapshot) {
    if (stats.categories.length === 0) {
      return 'Категорий пока нет — добавь первую покупку.';
    }

    return [
      '*💡 Категории месяца*',
      ...stats.categories.map((category) => {
        const bar = this.progressBar(category.share);
        const limitBadge = (() => {
          if (!category.limitInfo) return '';
          if (category.limitInfo.exceeded) return ' 🚨';
          if ((category.limitCoverage ?? 0) > 0.85) return ' ⚠️';
          return ' 🎯';
        })();

        const limitLine = category.limitInfo
          ? ` — ${category.limitInfo.spent.toFixed(0)} / ${category.limitInfo.amount.toFixed(
              0,
            )}`
          : '';

        return `${category.emoji ?? '•'} ${category.name}: ${this.money(
          category.total,
          stats.currency,
        )}${limitLine}\n${bar}${limitBadge}`;
      }),
    ].join('\n');
  }

  renderRecent(stats: StatsSnapshot) {
    if (stats.recent.length === 0) {
      return 'Ещё нет операций. Нажми «➕ Добавить расход».';
    }

    return [
      '*🧾 Последние операции*',
      ...stats.recent.map((item) => {
        const date = dayjs(item.spentAt).format('DD.MM HH:mm');
        const note = item.note ? ` — ${item.note}` : '';
        return `${item.category.emoji ?? '•'} ${date}: ${this.money(
          item.amount,
          stats.currency,
        )}${note}`;
      }),
    ].join('\n');
  }

  progressBar(value: number) {
    const clamped = Math.min(Math.max(value, 0), 1);
    const filled = Math.round(clamped * this.barLength);
    return '▰'.repeat(filled) + '▱'.repeat(this.barLength - filled);
  }

  private money(amount: number, currency: string) {
    return `${amount.toFixed(0)} ${currency}`;
  }
}

