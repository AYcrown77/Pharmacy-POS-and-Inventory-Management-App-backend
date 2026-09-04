import { Request, Response } from "express";
import { loginService, sessionService, logoutService } from "../../services/users/authService.js";
import { LoginRequest, AuthenticatedUser } from "../../types/users/auth.js";
import { config } from "../../config/config.js";
import { SUCCESS } from "../../constants/statusCode.js";

/**
 * How the session cookie is written.
 *
 * `httpOnly` keeps the token out of reach of any script on the page, so an
 * XSS cannot steal a shift. `sameSite: lax` still allows the terminals to
 * reach the API through the Next.js server on the same origin. `secure` is
 * off in development because the pharmacy LAN serves plain HTTP.
 */
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: config.server.env === "production",
  path: "/",
};

export const loginController = async (req: Request<{}, {}, LoginRequest>, res: Response) => {
  await loginService(req.body, (result) => {
    if (result.success && result.data?.accessToken) {
      const { accessToken, ...session } = result.data;

      res.cookie(config.auth.cookieName, accessToken, {
        ...cookieOptions,
        maxAge: 12 * 60 * 60 * 1000,
      });

      // The token lives in the cookie only; it is never returned in the body.
      return res.status(result.statusCode).json({ ...result, data: session });
    }

    return res.status(result.statusCode).json(result);
  });
};

export const sessionController = async (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;

  await sessionService(user, (result) => {
    return res.status(result.statusCode).json(result);
  });
};

export const logoutController = async (req: Request, res: Response) => {
  const user = (req as any).user as AuthenticatedUser;

  await logoutService(user, (result) => {
    res.clearCookie(config.auth.cookieName, cookieOptions);
    return res.status(result.success ? SUCCESS : result.statusCode).json(result);
  });
};
