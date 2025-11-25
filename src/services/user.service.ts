import { prisma } from './prisma.service.js';
import { env } from '../config/env.js';

export class UserService {
  async ensureUser(params: {
    telegramId: string;
    firstName?: string | null;
    username?: string | null;
  }) {
    const { telegramId, firstName, username } = params;

    const user = await prisma.user.upsert({
      where: { telegramId },
      update: {
        firstName: firstName ?? undefined,
        username: username ?? undefined,
      },
      create: {
        telegramId,
        firstName: firstName ?? undefined,
        username: username ?? undefined,
        currency: env.DEFAULT_CURRENCY,
      },
    });

    return user;
  }
}

