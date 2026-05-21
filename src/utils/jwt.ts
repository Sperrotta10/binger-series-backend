import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export interface AccessTokenPayload {
  id: string;
  username: string;
}

export interface RefreshTokenPayload {
  id: string;
}

export const generateTokens = (userId: string, username: string) => {
  const accessToken = jwt.sign(
    { id: userId, username } as AccessTokenPayload,
    env.ACCESS_TOKEN_SECRET,
    { expiresIn: '15m' },
  );

  const refreshToken = jwt.sign({ id: userId } as RefreshTokenPayload, env.REFRESH_TOKEN_SECRET, {
    expiresIn: '30d',
  });

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token: string): AccessTokenPayload => {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET) as AccessTokenPayload;
};

export const verifyRefreshToken = (token: string): RefreshTokenPayload => {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
};
