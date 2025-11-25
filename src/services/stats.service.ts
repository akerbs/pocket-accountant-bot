import dayjs from 'dayjs';
import { PurchaseService } from './purchase.service.js';
import { LimitService } from './limit.service.js';

export interface StatsSnapshot {
  today: number;
  week: number;
  month: number;
  currency: string;
  categories: Array<{
    name: string;
    emoji?: string | null;
    total: number;
    share: number;
    limitCoverage?: number;
    limitInfo?: {
      amount: number;
      spent: number;
      exceeded: boolean;
    };
  }>;
  recent: Array<{
    amount: number;
    note?: string | null;
    category: {
      name: string;
      emoji?: string | null;
    };
    spentAt: Date;
  }>;
}

export class StatsService {
  private readonly purchaseService = new PurchaseService();
  private readonly limitService = new LimitService();

  async buildSnapshot(params: { userId: string; currency: string }): Promise<StatsSnapshot> {
    const { userId } = params;
    const todayRange = {
      from: dayjs().startOf('day').toDate(),
      to: dayjs().endOf('day').toDate(),
    };
    const weekRange = {
      from: dayjs().startOf('week').toDate(),
      to: dayjs().endOf('week').toDate(),
    };
    const monthRange = {
      from: dayjs().startOf('month').toDate(),
      to: dayjs().endOf('month').toDate(),
    };

    const [today, week, month, breakdown, recent, limits] = await Promise.all([
      this.purchaseService.sumByPeriod(userId, todayRange.from, todayRange.to),
      this.purchaseService.sumByPeriod(userId, weekRange.from, weekRange.to),
      this.purchaseService.sumByPeriod(userId, monthRange.from, monthRange.to),
      this.purchaseService.categoryBreakdown(userId, monthRange.from, monthRange.to),
      this.purchaseService.recentPurchases(userId),
      this.limitService.listActive(userId),
    ]);

    const totalMonth = month || 1;
    const categories = await Promise.all(
      breakdown.slice(0, 6).map(async (item) => {
        const limitStatus = await this.limitService.resolveLimitStatus({
          userId,
          categoryId: item.categoryId,
        });

        return {
          name: item.categoryName,
          emoji: item.emoji,
          total: item.total,
          share: item.total / totalMonth,
          limitCoverage: limitStatus.type === 'active' ? limitStatus.coverage : undefined,
          limitInfo:
            limitStatus.type === 'active'
              ? {
                  amount: limitStatus.amount,
                  spent: limitStatus.spent,
                  exceeded: limitStatus.isExceeded,
                }
              : undefined,
        };
      }),
    );

    return {
      today,
      week,
      month,
      currency: params.currency,
      categories,
      recent: recent.map((purchase) => ({
        amount: Number(purchase.amount),
        note: purchase.note,
        category: {
          name: purchase.category.name,
          emoji: purchase.category.emoji,
        },
        spentAt: purchase.spentAt,
      })),
    };
  }
}

