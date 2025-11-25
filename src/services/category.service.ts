import { prisma } from './prisma.service.js';
import { DEFAULT_CATEGORIES } from '../constants/default-categories.js';

export class CategoryService {
  async ensureDefaults(userId: string) {
    const existing = await prisma.category.findMany({
      where: { userId },
      select: { name: true },
    });
    const existingNames = new Set(existing.map((c) => c.name.toLowerCase()));

    const payloads = DEFAULT_CATEGORIES.filter(
      (c) => !existingNames.has(c.name.toLowerCase()),
    ).map((c) => ({
      userId,
      name: c.name,
      emoji: c.emoji,
    }));

    if (payloads.length === 0) {
      return;
    }

    await prisma.category.createMany({ data: payloads });
  }

  async findOrCreate(userId: string, categoryName: string) {
    const normalized = categoryName.trim();

    const existing = await prisma.category.findFirst({
      where: {
        userId,
        name: {
          equals: normalized,
          mode: 'insensitive',
        },
      },
    });

    if (existing) {
      return existing;
    }

    return prisma.category.create({
      data: {
        userId,
        name: normalized
          .split(' ')
          .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
          .join(' '),
        emoji: '🧾',
      },
    });
  }

  async listWithLimits(userId: string) {
    return prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: {
        categoryLimits: {
          where: { period: 'MONTH' },
        },
      },
    });
  }

  async listAll(userId: string) {
    return prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }
}

