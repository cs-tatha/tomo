import { userService } from './userService.js';

export const userController = {
  async getMe(req, res, next) {
    try {
      const user = await userService.getMe(req.user.id);
      res.status(200).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  },

  async searchUsers(req, res, next) {
    try {
      const { search } = req.query;
      const users = await userService.searchUsers({
        query: search,
        currentUserId: req.user.id,
      });
      res.status(200).json({ success: true, users });
    } catch (error) {
      next(error);
    }
  },

  async getTeammates(req, res, next) {
    try {
      const teammates = await userService.getTeammates(req.user.id);
      res.status(200).json({ success: true, teammates });
    } catch (error) {
      next(error);
    }
  },

  async getUserById(req, res, next) {
    try {
      const { id } = req.params;
      const user = await userService.getUserById(id);
      res.status(200).json({ success: true, user });
    } catch (error) {
      next(error);
    }
  },
};
