import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

class PrismaService {
  private static instance: PrismaClient;

  static get client(): PrismaClient {
    if (!PrismaService.instance) {
      PrismaService.instance = new PrismaClient({
        datasources: {
          db: {
            url: env.DATABASE_URL,
          },
        },
      });
    }

    return PrismaService.instance;
  }
}

export const prisma = PrismaService.client;

