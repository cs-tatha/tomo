import { prisma } from '../../infrastructure/database/prisma.js';
import { presenceStore } from '../../infrastructure/redis/presenceStore.js';
import { chatStore } from '../../infrastructure/redis/chatStore.js';
import { getIO } from '../../realtime/socket.js';

export const friendService = {
  async sendFriendRequest({ senderId, targetUserId }) {
    if (senderId === targetUserId) {
      throw new Error('You cannot add yourself as a friend.');
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, email: true, avatarUrl: true },
    });

    if (!targetUser) {
      throw new Error('User not found.');
    }

    // Check if already friends
    const existingFriendship = await prisma.friendship.findFirst({
      where: { userId: senderId, friendId: targetUserId, status: 'ACCEPTED' },
    });
    if (existingFriendship) {
      const isOnline = await presenceStore.isUserOnline(targetUserId);
      return { status: 'ACCEPTED', message: 'Already friends', friend: { ...targetUser, isOnline } };
    }

    // Check if target user has already sent a pending request to sender -> auto-accept!
    const reciprocalRequest = await prisma.friendRequest.findFirst({
      where: { senderId: targetUserId, receiverId: senderId, status: 'PENDING' },
    });

    if (reciprocalRequest) {
      await prisma.$transaction([
        prisma.friendRequest.delete({ where: { id: reciprocalRequest.id } }),
        prisma.friendship.upsert({
          where: { userId_friendId: { userId: senderId, friendId: targetUserId } },
          create: { userId: senderId, friendId: targetUserId, status: 'ACCEPTED' },
          update: { status: 'ACCEPTED' },
        }),
        prisma.friendship.upsert({
          where: { userId_friendId: { userId: targetUserId, friendId: senderId } },
          create: { userId: targetUserId, friendId: senderId, status: 'ACCEPTED' },
          update: { status: 'ACCEPTED' },
        }),
      ]);

      const senderUser = await prisma.user.findUnique({
        where: { id: senderId },
        select: { id: true, username: true, email: true, avatarUrl: true },
      });

      try {
        const io = getIO();
        io.to(`user:${targetUserId}`).emit('friend:request_accepted', { friend: senderUser });
        io.to(`user:${senderId}`).emit('friend:request_accepted', { friend: targetUser });
      } catch (e) {}

      const isOnline = await presenceStore.isUserOnline(targetUserId);
      return {
        status: 'ACCEPTED',
        message: `You and ${targetUser.username} are now friends!`,
        friend: { ...targetUser, isOnline },
      };
    }

    // Check if request already sent
    const existingRequest = await prisma.friendRequest.findFirst({
      where: { senderId, receiverId: targetUserId, status: 'PENDING' },
    });
    if (existingRequest) {
      throw new Error('Friend request already sent.');
    }

    const request = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId: targetUserId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
      },
    });

    try {
      const io = getIO();
      io.to(`user:${targetUserId}`).emit('friend:request_received', {
        request,
      });
    } catch (e) {}

    return {
      status: 'PENDING',
      message: `Friend request sent to ${targetUser.username}!`,
      request,
    };
  },

  async getFriendRequests(userId) {
    const [incoming, outgoing] = await Promise.all([
      prisma.friendRequest.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        include: {
          sender: {
            select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.friendRequest.findMany({
        where: { senderId: userId, status: 'PENDING' },
        include: {
          receiver: {
            select: { id: true, username: true, email: true, avatarUrl: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const onlineIds = new Set(await presenceStore.getOnlineUserIds());

    const incomingWithStatus = incoming.map((req) => ({
      ...req,
      sender: {
        ...req.sender,
        isOnline: onlineIds.has(req.sender.id),
      },
    }));

    const outgoingWithStatus = outgoing.map((req) => ({
      ...req,
      receiver: {
        ...req.receiver,
        isOnline: onlineIds.has(req.receiver.id),
      },
    }));

    return {
      incoming: incomingWithStatus,
      outgoing: outgoingWithStatus,
    };
  },

  async acceptFriendRequest({ requestId, userId }) {
    const reqItem = await prisma.friendRequest.findUnique({
      where: { id: requestId },
      include: {
        sender: { select: { id: true, username: true, email: true, avatarUrl: true } },
        receiver: { select: { id: true, username: true, email: true, avatarUrl: true } },
      },
    });

    if (!reqItem || reqItem.receiverId !== userId) {
      throw new Error('Friend request not found or unauthorized.');
    }

    await prisma.$transaction([
      prisma.friendRequest.delete({ where: { id: requestId } }),
      prisma.friendship.upsert({
        where: { userId_friendId: { userId, friendId: reqItem.senderId } },
        create: { userId, friendId: reqItem.senderId, status: 'ACCEPTED' },
        update: { status: 'ACCEPTED' },
      }),
      prisma.friendship.upsert({
        where: { userId_friendId: { userId: reqItem.senderId, friendId: userId } },
        create: { userId: reqItem.senderId, friendId: userId, status: 'ACCEPTED' },
        update: { status: 'ACCEPTED' },
      }),
    ]);

    try {
      const io = getIO();
      io.to(`user:${reqItem.senderId}`).emit('friend:request_accepted', {
        friend: reqItem.receiver,
      });
      io.to(`user:${userId}`).emit('friend:request_accepted', {
        friend: reqItem.sender,
      });
    } catch (e) {}

    return {
      success: true,
      message: `Accepted friend request from ${reqItem.sender.username}!`,
      friend: reqItem.sender,
    };
  },

  async rejectFriendRequest({ requestId, userId }) {
    const reqItem = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!reqItem || reqItem.receiverId !== userId) {
      throw new Error('Friend request not found or unauthorized.');
    }

    await prisma.friendRequest.delete({ where: { id: requestId } });

    try {
      const io = getIO();
      io.to(`user:${reqItem.senderId}`).emit('friend:request_rejected', { requestId });
    } catch (e) {}

    return { success: true, message: 'Friend request rejected.' };
  },

  async cancelFriendRequest({ requestId, userId }) {
    const reqItem = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!reqItem || reqItem.senderId !== userId) {
      throw new Error('Friend request not found or unauthorized.');
    }

    await prisma.friendRequest.delete({ where: { id: requestId } });

    return { success: true, message: 'Friend request cancelled.' };
  },

  async getFriends(userId) {
    const friendships = await prisma.friendship.findMany({
      where: { userId, status: 'ACCEPTED' },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            email: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const onlineIds = new Set(await presenceStore.getOnlineUserIds());

    return friendships.map((f) => ({
      friendshipId: f.id,
      ...f.friend,
      isOnline: onlineIds.has(f.friend.id),
      since: f.createdAt,
    }));
  },

  async removeFriend({ userId, friendId }) {
    await prisma.$transaction([
      prisma.friendship.deleteMany({
        where: {
          OR: [
            { userId, friendId },
            { userId: friendId, friendId: userId },
          ],
        },
      }),
      prisma.friendRequest.deleteMany({
        where: {
          OR: [
            { senderId: userId, receiverId: friendId },
            { senderId: friendId, receiverId: userId },
          ],
        },
      }),
    ]);

    return { message: 'Friend removed successfully.' };
  },

  async getDirectMessages({ userId, friendId }) {
    // Check if friends (must be confirmed ACCEPTED friendship)
    const friendship = await prisma.friendship.findFirst({
      where: {
        userId,
        friendId,
        status: 'ACCEPTED',
      },
    });

    if (!friendship) {
      throw new Error('Access denied. You can only chat with confirmed friends.');
    }

    return await chatStore.getDirectMessages(userId, friendId);
  },
};
