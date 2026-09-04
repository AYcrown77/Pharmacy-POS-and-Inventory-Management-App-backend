import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/config.js';
import { UNAUTHORIZED, FORBIDDEN, INTERNAL_SERVER_ERROR } from '../constants/statusCode.js';
import { messageHandler } from '../utils/index.js';
import { Role } from '../schemas/users/authSchema.js';

/**
 * Proves a session.
 *
 * The token normally arrives in an httpOnly cookie, which is what the browser
 * terminals use. The Authorization header is still accepted so scripts and
 * API clients can call the same endpoints without a cookie jar.
 */
export const verify = (req: Request, res: Response, next: NextFunction) => {
  try {
    const cookieToken = (req as any).cookies?.[config.auth.cookieName];
    const authHeader = req.headers['authorization'];
    const headerToken = authHeader ? authHeader.split(' ')[1] : undefined;

    const token = cookieToken || headerToken;

    if (!token) {
      return res
        .status(UNAUTHORIZED)
        .json(messageHandler('You are not signed in.', false, UNAUTHORIZED, {}));
    }

    jwt.verify(token, config.auth.secretKey, (err: any, decodedToken: any) => {
      if (err) {
        return res
          .status(UNAUTHORIZED)
          .json(messageHandler('Your session has expired.', false, UNAUTHORIZED, {}));
      }

      (req as any).user = decodedToken;
      next();
    });
  } catch (err) {
    return res
      .status(INTERNAL_SERVER_ERROR)
      .json(messageHandler('Server Error', false, INTERNAL_SERVER_ERROR, {}));
  }
};

/**
 * Restricts a route to particular roles.
 *
 * This is the real enforcement. The frontend hides what a role cannot use,
 * but hiding a button is a convenience — the answer that counts is here,
 * where a crafted request cannot get past it.
 */
export const authorize = (...roles: Role[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
      return res
        .status(UNAUTHORIZED)
        .json(messageHandler('You are not signed in.', false, UNAUTHORIZED, {}));
    }

    if (!roles.includes(user.role)) {
      return res
        .status(FORBIDDEN)
        .json(messageHandler('Your role does not permit this action.', false, FORBIDDEN, {}));
    }

    next();
  };
};
