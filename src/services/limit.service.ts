import dayjs from 'dayjs';
import { prisma } from './prisma.service.js';
import { PurchaseService } from './purchase.service.js';

export type LimitStatus =
  | { type: 'none' }
  | {
      type: 'active';
      limitId: string;
      categoryName: string;
      emoji?: string | null;
      spent: number;
      amount: number;
      coverage: number;
      threshold: number;
      isExceeded: boolean;
    };

export class LimitService {
  private readonly purchaseService = new PurchaseService();
  private readonly period = 'MONTH';

  async upsertLimit(params: {
    userId: string;
    categoryId: string;
    amount: number;
  }) {
    const periodStart = dayjs().startOf('month').toDate();
    return prisma.categoryLimit.upsert({
      where: {
        userId_categoryId_period_periodStart: {
          userId: params.userId,
          categoryId: params.categoryId,
          period: this.period,
          periodStart,
        },
      },
      update: {
        amount: params.amount,
        periodStart,
      },
      create: {
        userId: params.userId,
        categoryId: params.categoryId,
        amount: params.amount,
        period: this.period,
        periodStart,
      },
      include: {
        category: true,
      },
    });
  }

  async resolveLimitStatus(params: { userId: string; categoryId: string }) {
    const periodStart = dayjs().startOf('month').toDate();
    const periodEnd = dayjs().endOf('month').toDate();

    const limit = await prisma.categoryLimit.findUnique({
      where: {
        userId_categoryId_period_periodStart: {
          userId: params.userId,
          categoryId: params.categoryId,
          period: this.period,
          periodStart,
        },
      },
      include: { category: true },
    });

    if (!limit) {
      return { type: 'none' } as LimitStatus;
    }

    const spent = await this.purchaseService.spentForCategoryInPeriod({
      userId: params.userId,
      categoryId: params.categoryId,
      from: periodStart,
      to: periodEnd,
    });
    const coverage = spent / limit.amount;

    return {
      type: 'active',
      limitId: limit.id,
      categoryName: limit.category.name,
      emoji: limit.category.emoji,
      spent,
      amount: limit.amount,
      coverage,
      threshold: limit.threshold / 100,
      isExceeded: coverage >= 1,
    } satisfies LimitStatus;
  }

  async notifyIfNeeded(params: {
    userId: string;
    categoryId: string;
    onWarning: (payload: { message: string }) => Promise<void> | void;
  }) {
    const status = await this.resolveLimitStatus({
      userId: params.userId,
      categoryId: params.categoryId,
    });

    if (status.type === 'none') {
      return;
    }

    const limit = await prisma.categoryLimit.findUnique({
      where: { id: status.limitId },
    });

    if (!limit) {
      return;
    }

    const alreadyWarned =
      limit.lastNotifiedAt && dayjs(limit.lastNotifiedAt).isAfter(dayjs().startOf('month'));

    if (status.coverage >= status.threshold && !alreadyWarned) {
      await params.onWarning({
        message: [
          '⚠️ *Лимит почти исчерпан!*',
          `${status.emoji ?? '💰'} ${status.categoryName}`,
          `Потрачено ${status.spent.toFixed(0)} / ${status.amount.toFixed(0)}`,
          `Остаток: ${(status.amount - status.spent).toFixed(0)}`,
        ].join('\n'),
      });

      await prisma.categoryLimit.update({
        where: { id: status.limitId },
        data: { lastNotifiedAt: new Date() },
      });
    }
  }

  async listActive(userId: string) {
    const periodStart = dayjs().startOf('month').toDate();

    return prisma.categoryLimit.findMany({
      where: {
        userId,
        period: this.period,
        periodStart,
      },
      include: {
        category: true,
      },
      orderBy: {
        amount: 'desc',
      },
    });
  }
}

