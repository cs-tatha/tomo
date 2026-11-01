import { prisma } from '../../infrastructure/database/prisma.js';
import { presenceStore } from '../../infrastructure/redis/presenceStore.js';

export const userService = {
  async getMe(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
        memberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isOnline = await presenceStore.isUserOnline(userId);
    return { ...user, isOnline };
  },

  /**
   * Search registered users by username or email.
   * Privacy rule: Does NOT return all users by default.
   * Only returns results when a non-empty search query is provided.
   */
  async searchUsers({ query = '', currentUserId }) {
    const trimmed = query ? query.trim() : '';
    if (!trimmed || trimmed.length === 0) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: trimmed } },
          { email: { contains: trimmed.toLowerCase() } },
        ],
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
        memberships: {
          select: {
            groupId: true,
            role: true,
            group: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      take: 20,
      orderBy: { username: 'asc' },
    });

    const onlineIds = new Set(await presenceStore.getOnlineUserIds());

    return users.map((u) => ({
      ...u,
      isOnline: onlineIds.has(u.id),
      isSelf: u.id === currentUserId,
    }));
  },

  /**
   * Retrieves teammates sharing common workspace groups with the current user.
   */
  async getTeammates(currentUserId) {
    const myMemberships = await prisma.groupMember.findMany({
      where: { userId: currentUserId },
      select: { groupId: true },
    });

    const groupIds = myMemberships.map((m) => m.groupId);
    if (groupIds.length === 0) return [];

    const teammates = await prisma.groupMember.findMany({
      where: {
        groupId: { in: groupIds },
        userId: { not: currentUserId },
      },
      select: {
        user: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
      distinct: ['userId'],
    });

    const onlineIds = new Set(await presenceStore.getOnlineUserIds());
    return teammates.map((t) => ({
      ...t.user,
      isOnline: onlineIds.has(t.user.id),
    }));
  },

  async getUserById(targetUserId) {
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
        memberships: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                description: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    const isOnline = await presenceStore.isUserOnline(targetUserId);
    return { ...user, isOnline };
  },
};
