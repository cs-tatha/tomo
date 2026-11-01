import { friendService } from './friendService.js';
import { z } from 'zod';

const targetUserSchema = z.object({
  targetUserId: z.string().uuid('Invalid user UUID'),
});

export const friendController = {
  async sendFriendRequest(req, res, next) {
    try {
      const { targetUserId } = targetUserSchema.parse(req.body);
      const result = await friendService.sendFriendRequest({
        senderId: req.user.id,
        targetUserId,
      });
      res.status(201).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getFriendRequests(req, res, next) {
    try {
      const requests = await friendService.getFriendRequests(req.user.id);
      res.status(200).json({ success: true, ...requests });
    } catch (error) {
      next(error);
    }
  },

  async acceptFriendRequest(req, res, next) {
    try {
      const { id } = req.params;
      const result = await friendService.acceptFriendRequest({
        requestId: id,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async rejectFriendRequest(req, res, next) {
    try {
      const { id } = req.params;
      const result = await friendService.rejectFriendRequest({
        requestId: id,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async cancelFriendRequest(req, res, next) {
    try {
      const { id } = req.params;
      const result = await friendService.cancelFriendRequest({
        requestId: id,
        userId: req.user.id,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async getFriends(req, res, next) {
    try {
      const friends = await friendService.getFriends(req.user.id);
      res.status(200).json({ success: true, friends });
    } catch (error) {
      next(error);
    }
  },

  async removeFriend(req, res, next) {
    try {
      const { friendId } = req.params;
      const result = await friendService.removeFriend({
        userId: req.user.id,
        friendId,
      });
      res.status(200).json({ success: true, ...result });
    } catch (error) {
      next(error);
    }
  },

  async getDirectMessages(req, res, next) {
    try {
      const { friendId } = req.params;
      const messages = await friendService.getDirectMessages({
        userId: req.user.id,
        friendId,
      });
      res.status(200).json({ success: true, messages });
    } catch (error) {
      next(error);
    }
  },
};
