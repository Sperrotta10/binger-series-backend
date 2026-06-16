import { Prisma } from '@prisma/client';
import { prisma } from '../../../config/database.js';

export class AuthRepository {
  static async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email },
    });
  }

  static async findUserByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
    });
  }

  static async findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  static async createUser(data: Prisma.UserCreateInput) {
    return prisma.user.create({
      data,
    });
  }

  static async updateUserPassword(userId: string, passwordHash: string, now: Date) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, updatedAt: now },
    });
  }

  static async updateUserProfile(
    userId: string,
    data: {
      username?: string;
      fullName?: string;
      bio?: string;
      avatarUrl?: string;
      updatedAt: Date;
    },
  ) {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  }

  static async findOauthAccount(provider: string, providerUserId: string) {
    return prisma.userOauth.findUnique({
      where: {
        provider_providerUserId: { provider, providerUserId },
      },
    });
  }

  static async createOauthAccount(data: {
    userId: string;
    provider: string;
    providerUserId: string;
    createdAt: Date;
  }) {
    return prisma.userOauth.create({
      data: {
        user: { connect: { id: data.userId } },
        provider: data.provider,
        providerUserId: data.providerUserId,
        createdAt: data.createdAt,
      },
    });
  }

  static async createPasswordReset(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    createdAt: Date;
  }) {
    return prisma.passwordReset.create({
      data: {
        user: { connect: { id: data.userId } },
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt,
      },
    });
  }

  static async findValidPasswordReset(tokenHash: string) {
    return prisma.passwordReset.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  static async markPasswordResetUsed(id: string, usedAt: Date) {
    return prisma.passwordReset.update({
      where: { id },
      data: { usedAt },
    });
  }
}
