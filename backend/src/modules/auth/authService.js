import { prisma } from '../../infrastructure/database/prisma.js';
import { hashPassword, comparePassword } from '../../utils/password.js';
import { generateTokens, verifyRefreshToken, hashToken } from '../../utils/jwt.js';

export const authService = {
  async register({ email, username, password }) {
    // Check existing
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: email.toLowerCase() },
          { username },
        ],
      },
    });

    if (existing) {
      if (existing.email === email.toLowerCase()) {
        throw new Error('An account with this email already exists.');
      }
      throw new Error('This username is already taken.');
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        username,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        username: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    const { accessToken, refreshToken } = generateTokens(user);

    // Persist refresh session
    const tokenHashed = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        tokenHash: tokenHashed,
        userId: user.id,
        expiresAt,
      },
    });

    return { user, accessToken, refreshToken };
  },

  async login({ email, password }) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new Error('Invalid email or password.');
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      throw new Error('Invalid email or password.');
    }

    const safeUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };

    const { accessToken, refreshToken } = generateTokens(safeUser);

    const tokenHashed = hashToken(refreshToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        tokenHash: tokenHashed,
        userId: user.id,
        expiresAt,
      },
    });

    return { user: safeUser, accessToken, refreshToken };
  },

  async refresh(refreshToken) {
    if (!refreshToken) {
      throw new Error('No refresh token provided.');
    }

    const decoded = verifyRefreshToken(refreshToken);
    if (!decoded) {
      throw new Error('Invalid or expired refresh token.');
    }

    const tokenHashed = hashToken(refreshToken);
    const session = await prisma.session.findUnique({
      where: { tokenHash: tokenHashed },
      include: { user: true },
    });

    if (!session || session.revoked || new Date() > session.expiresAt) {
      throw new Error('Session has expired or was revoked.');
    }

    // Refresh rotation
    await prisma.session.update({
      where: { id: session.id },
      data: { revoked: true },
    });

    const safeUser = {
      id: session.user.id,
      email: session.user.email,
      username: session.user.username,
      avatarUrl: session.user.avatarUrl,
      createdAt: session.user.createdAt,
    };

    const tokens = generateTokens(safeUser);
    const nextExpiresAt = new Date();
    nextExpiresAt.setDate(nextExpiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        tokenHash: hashToken(tokens.refreshToken),
        userId: safeUser.id,
        expiresAt: nextExpiresAt,
      },
    });

    return { user: safeUser, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  },

  async logout(refreshToken) {
    if (!refreshToken) return;
    const tokenHashed = hashToken(refreshToken);
    await prisma.session.updateMany({
      where: { tokenHash: tokenHashed },
      data: { revoked: true },
    });
  },
};
