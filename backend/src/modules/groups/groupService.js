import { prisma } from '../../infrastructure/database/prisma.js';
import { chatStore } from '../../infrastructure/redis/chatStore.js';
import { presenceStore } from '../../infrastructure/redis/presenceStore.js';
import { presentationStore } from '../../infrastructure/redis/presentationStore.js';
import { getIO } from '../../realtime/socket.js';

export const groupService = {
  async createGroup({ name, description, ownerId }) {
    if (!name || name.trim().length === 0) {
      throw new Error('Group name is required');
    }

    // Create group and initial owner membership in a transaction
    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        ownerId,
        members: {
          create: {
            userId: ownerId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    });

    return group;
  },

  async getMyGroups(userId) {
    const memberships = await prisma.groupMember.findMany({
      where: { userId },
      include: {
        group: {
          include: {
            owner: {
              select: { id: true, username: true },
            },
            _count: {
              select: { members: true },
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    return memberships.map((m) => ({
      ...m.group,
      currentUserRole: m.role,
      memberCount: m.group._count.members,
    }));
  },

  async getGroupById(groupId, userId) {
    // Check if user is a member of this group
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    if (!membership) {
      throw new Error('Access denied. You are not a member of this group.');
    }

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        owner: {
          select: { id: true, username: true, email: true },
        },
        members: {
          include: {
            user: {
              select: { id: true, username: true, email: true, avatarUrl: true },
            },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });

    if (!group) {
      throw new Error('Group not found');
    }

    const onlineIds = new Set(await presenceStore.getOnlineUserIds());

    const membersWithOnlineStatus = group.members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      joinedAt: m.joinedAt,
      user: {
        ...m.user,
        isOnline: onlineIds.has(m.userId),
      },
    }));

    return {
      id: group.id,
      name: group.name,
      description: group.description,
      ownerId: group.ownerId,
      owner: group.owner,
      createdAt: group.createdAt,
      currentUserRole: membership.role,
      members: membersWithOnlineStatus,
    };
  },

  async addMember({ groupId, targetUserId, requesterId, role = 'MEMBER' }) {
    // Check requester role (must be OWNER or ADMIN)
    const requesterMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: requesterId },
      },
    });

    if (!requesterMember || (requesterMember.role !== 'OWNER' && requesterMember.role !== 'ADMIN')) {
      throw new Error('Only a group Owner or Admin can add new members.');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new Error('Target user does not exist.');
    }

    // Check if already in group
    const existing = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: targetUserId },
      },
    });

    if (existing) {
      throw new Error('User is already a member of this group.');
    }

    const newMember = await prisma.groupMember.create({
      data: {
        groupId,
        userId: targetUserId,
        role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
      },
      include: {
        user: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
      },
    });

    return newMember;
  },

  async inviteMember({ groupId, targetUserId, inviterId, role = 'MEMBER' }) {
    // Check requester role (must be OWNER or ADMIN)
    const requesterMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: inviterId },
      },
    });

    if (!requesterMember || (requesterMember.role !== 'OWNER' && requesterMember.role !== 'ADMIN')) {
      throw new Error('Only a group Owner or Admin can invite members.');
    }

    // Verify target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, username: true, email: true, avatarUrl: true },
    });
    if (!targetUser) {
      throw new Error('Target user does not exist.');
    }

    // Check if already in group
    const existingMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: targetUserId },
      },
    });
    if (existingMember) {
      throw new Error('User is already a member of this workspace.');
    }

    // Check if invitation already pending
    const existingInvite = await prisma.groupInvitation.findFirst({
      where: {
        groupId,
        inviteeId: targetUserId,
        status: 'PENDING',
      },
    });
    if (existingInvite) {
      throw new Error('An invitation has already been sent to this user.');
    }

    const [invitation, group, inviter] = await Promise.all([
      prisma.groupInvitation.create({
        data: {
          groupId,
          inviterId,
          inviteeId: targetUserId,
          role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
          status: 'PENDING',
        },
      }),
      prisma.group.findUnique({
        where: { id: groupId },
        select: { id: true, name: true, description: true },
      }),
      prisma.user.findUnique({
        where: { id: inviterId },
        select: { id: true, username: true, email: true },
      }),
    ]);

    try {
      const io = getIO();
      io.to(`user:${targetUserId}`).emit('workspace:invitation_received', {
        invitation: {
          ...invitation,
          group,
          inviter,
        },
      });
    } catch (e) {}

    return {
      message: `Invitation sent to ${targetUser.username}!`,
      invitation,
    };
  },

  async getMyInvitations(userId) {
    const invitations = await prisma.groupInvitation.findMany({
      where: { inviteeId: userId, status: 'PENDING' },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            owner: { select: { id: true, username: true } },
            _count: { select: { members: true } },
          },
        },
        inviter: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations.map((inv) => ({
      id: inv.id,
      groupId: inv.groupId,
      groupName: inv.group.name,
      groupDescription: inv.group.description,
      memberCount: inv.group._count.members,
      owner: inv.group.owner,
      inviter: inv.inviter,
      role: inv.role,
      createdAt: inv.createdAt,
    }));
  },

  async acceptInvitation({ invitationId, userId }) {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
      include: { group: true },
    });

    if (!invitation || invitation.inviteeId !== userId) {
      throw new Error('Invitation not found or unauthorized.');
    }

    const [member] = await prisma.$transaction([
      prisma.groupMember.create({
        data: {
          groupId: invitation.groupId,
          userId,
          role: invitation.role,
        },
        include: {
          user: {
            select: { id: true, username: true, email: true, avatarUrl: true },
          },
        },
      }),
      prisma.groupInvitation.delete({
        where: { id: invitationId },
      }),
    ]);

    try {
      const io = getIO();
      io.to(`user:${userId}`).emit('workspace:invitation_accepted', {
        groupId: invitation.groupId,
        groupName: invitation.group.name,
      });
      io.to(`group:${invitation.groupId}`).emit('member:joined', {
        groupId: invitation.groupId,
        member,
      });
    } catch (e) {}

    return {
      success: true,
      message: `Successfully joined ${invitation.group.name}!`,
      groupId: invitation.groupId,
    };
  },

  async rejectInvitation({ invitationId, userId }) {
    const invitation = await prisma.groupInvitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation || invitation.inviteeId !== userId) {
      throw new Error('Invitation not found or unauthorized.');
    }

    await prisma.groupInvitation.delete({
      where: { id: invitationId },
    });

    try {
      const io = getIO();
      io.to(`user:${invitation.inviterId}`).emit('workspace:invitation_rejected', { invitationId });
    } catch (e) {}

    return { success: true, message: 'Invitation declined.' };
  },

  async deleteGroup({ groupId, userId }) {
    const group = await prisma.group.findUnique({
      where: { id: groupId },
    });

    if (!group) {
      throw new Error('Workspace not found.');
    }

    if (group.ownerId !== userId) {
      throw new Error('Permission denied. Only the workspace Owner can delete this workspace.');
    }

    // Clear active Redis presentations & chat
    try {
      await presentationStore.clearPresentation(groupId);
      await chatStore.clearMessages(groupId);
    } catch (e) {}

    // Notify all active room members via Socket
    try {
      const io = getIO();
      io.to(`group:${groupId}`).emit('workspace:deleted', {
        groupId,
        groupName: group.name,
      });
    } catch (e) {}

    // Delete group from database (cascades to members and invitations)
    await prisma.group.delete({
      where: { id: groupId },
    });

    return {
      success: true,
      message: `Workspace "${group.name}" was permanently deleted.`,
    };
  },

  async removeMember({ groupId, targetUserId, requesterId }) {
    const requesterMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: requesterId },
      },
    });

    if (!requesterMember) {
      throw new Error('You are not a member of this group.');
    }

    const targetMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId: targetUserId },
      },
    });

    if (!targetMember) {
      throw new Error('Member not found in group.');
    }

    // If user is leaving voluntarily:
    if (requesterId === targetUserId) {
      if (targetMember.role === 'OWNER') {
        throw new Error('Group Owner cannot leave without transferring ownership or deleting the group.');
      }
      await prisma.groupMember.delete({
        where: { id: targetMember.id },
      });
      return { message: 'Left the group successfully' };
    }

    // Otherwise, requester is removing another member: must be OWNER or ADMIN
    if (requesterMember.role !== 'OWNER' && requesterMember.role !== 'ADMIN') {
      throw new Error('Permission denied. Only Owner or Admin can remove members.');
    }

    if (targetMember.role === 'OWNER') {
      throw new Error('Cannot remove the group Owner.');
    }

    if (requesterMember.role === 'ADMIN' && targetMember.role === 'ADMIN') {
      throw new Error('Admins cannot remove fellow Admins.');
    }

    await prisma.groupMember.delete({
      where: { id: targetMember.id },
    });

    return { message: 'Member removed successfully' };
  },

  async getGroupMessages(groupId, userId) {
    // Check membership
    const membership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });

    if (!membership) {
      throw new Error('Access denied. You are not a member of this group.');
    }

    // Fetch temporary messages from Redis
    return await chatStore.getMessages(groupId);
  },

  async isMember(groupId, userId) {
    const member = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });
    return !!member;
  },
};
