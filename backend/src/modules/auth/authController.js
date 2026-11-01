import { authService } from './authService.js';
import { z } from 'zod';

const registerSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(30),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
};

const CLEAR_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
};

export const authController = {
  async register(req, res, next) {
    try {
      const data = registerSchema.parse(req.body);
      const { user, accessToken, refreshToken } = await authService.register(data);

      res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
      return res.status(201).json({
        success: true,
        user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  async login(req, res, next) {
    try {
      const data = loginSchema.parse(req.body);
      const { user, accessToken, refreshToken } = await authService.login(data);

      res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
      return res.status(200).json({
        success: true,
        user,
        accessToken,
      });
    } catch (error) {
      next(error);
    }
  },

  async refresh(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (!refreshToken) {
        return res.status(401).json({ success: false, message: 'No refresh token in cookie' });
      }

      const { user, accessToken, refreshToken: newRefreshToken } = await authService.refresh(refreshToken);
      res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);

      return res.status(200).json({
        success: true,
        user,
        accessToken,
      });
    } catch (error) {
      res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS);
      next(error);
    }
  },

  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken;
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      res.clearCookie('refreshToken', CLEAR_COOKIE_OPTIONS);
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  },
};
