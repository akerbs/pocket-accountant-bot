import { prisma } from './prisma.service.js';

export class PurchaseService {
  async addPurchase(params: {
    userId: string;
    categoryId: string;
    amount: number;
    note?: string;
    spentAt?: Date;
  }) {
    return prisma.purchase.create({
      data: {
        userId: params.userId,
        categoryId: params.categoryId,
        amount: params.amount,
        note: params.note,
        spentAt: params.spentAt ?? new Date(),
      },
      include: {
        category: true,
      },
    });
  }

  async sumByPeriod(userId: string, from: Date, to: Date) {
    const result = await prisma.purchase.aggregate({
      _sum: { amount: true },
      where: {
        userId,
        spentAt: {
          gte: from,
          lt: to,
        },
      },
    });

    return Number(result._sum.amount ?? 0);
  }

  async categoryBreakdown(userId: string, from: Date, to: Date) {
    const purchases = await prisma.purchase.groupBy({
      by: ['categoryId'],
      _sum: { amount: true },
      where: {
        userId,
        spentAt: {
          gte: from,
          lt: to,
        },
      },
    });

    const categories = await prisma.category.findMany({
      where: {
        userId,
        id: {
          in: purchases.map((p) => p.categoryId),
        },
      },
    });

    return purchases
      .map((purchase) => {
        const category = categories.find((c) => c.id === purchase.categoryId);
        return {
          categoryId: purchase.categoryId,
          categoryName: category?.name ?? 'Без категории',
          emoji: category?.emoji ?? '🧾',
          total: Number(purchase._sum.amount ?? 0),
        };
      })
      .sort((a, b) => b.total - a.total);
  }

  async recentPurchases(userId: string, limit = 5) {
    return prisma.purchase.findMany({
      where: { userId },
      orderBy: { spentAt: 'desc' },
      take: limit,
      include: { category: true },
    });
  }

  async spentForCategoryInPeriod(params: {
    userId: string;
    categoryId: string;
    from: Date;
    to: Date;
  }) {
    const result = await prisma.purchase.aggregate({
      _sum: { amount: true },
      where: {
        userId: params.userId,
        categoryId: params.categoryId,
        spentAt: {
          gte: params.from,
          lt: params.to,
        },
      },
    });

    return Number(result._sum.amount ?? 0);
  }

  async deleteAllPurchases(userId: string) {
    const result = await prisma.purchase.deleteMany({
      where: { userId },
    });
    return result.count;
  }

}

