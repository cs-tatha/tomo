import { groupService } from './groupService.js';
import { z } from 'zod';

const createGroupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(60),
  description: z.string().max(250).optional(),
});

const addMemberSchema = z.object({
  userId: z.string().uuid('Invalid user UUID'),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
});

export const groupController = {
  async createGroup(req, res, next) {
    try {
      const data = createGroupSchema.parse(req.body);
      const group = await groupService.createGroup({
        name: data.name,
        description: data.description,
        ownerId: req.user.id,
      });
      res.status(201).json({ success: true, group });
    } catch (error) {
      next(error);
    }
  },

  async getMyGroups(req, res, next) {
    try {
      const groups = await groupService.getMyGroups(req.user.id);
      res.status(200).json({ success: true, groups });
    } catch (error) {
      next(error);
    }
  },

  async getGroupById(req, res, next) {
    try {
      const { id } = req.params;
      const group = await groupService.getGroupById(id, req.user.id);
      res.status(200).json({ success: true, group });
    } catch (error) {
      next(error);
    }
  },

  async addMember(req, res, next) {
    try {
      const { id } = req.params;
      const data = addMemberSchema.parse(req.body);
      const result = await groupService.inviteMember({
        groupId: id,
        targetUserId: data.userId,
        inviterId: req.user.id,
        role: data.role,
      });
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async inviteMember(req, res, next) {
    try {
      const { id } = req.params;
      const data = addMemberSchema.parse(req.body);
      const result = await groupService.inviteMember({
        groupId: id,
        targetUserId: data.userId,
        inviterId: req.user.id,
        role: data.role,
      });
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getMyInvitations(req, res, next) {
    try {
      const invitations = await groupService.getMyInvitations(req.user.id);
      res.status(200).json({ success: true, invitations });
    } catch (error) {
      next(error);
    }
  },

  async acceptInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await groupService.acceptInvitation({
        invitationId: id,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async rejectInvitation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await groupService.rejectInvitation({
        invitationId: id,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async deleteGroup(req, res, next) {
    try {
      const { id } = req.params;
      const result = await groupService.deleteGroup({
        groupId: id,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async removeMember(req, res, next) {
    try {
      const { id, userId } = req.params;
      const result = await groupService.removeMember({
        groupId: id,
        targetUserId: userId,
        requesterId: req.user.id,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getGroupMessages(req, res, next) {
    try {
      const { id } = req.params;
      const messages = await groupService.getGroupMessages(id, req.user.id);
      res.status(200).json({ success: true, messages });
    } catch (error) {
      next(error);
    }
  },
};
