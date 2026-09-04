import Auth from "../../schemas/users/authSchema.js";
import Terminal from "../../schemas/system/terminalSchema.js";
import { recordAudit } from "../system/auditService.js";
import { generateToken, verifyPassword, messageHandler } from "../../utils/index.js"
import { config } from "../../config/config.js";
import { INTERNAL_SERVER_ERROR, SUCCESS, UNAUTHORIZED, FORBIDDEN } from "../../constants/statusCode.js"
import { LoginRequest, LoginResponse, SessionResponse, LogoutResponse, AuthenticatedUser } from "../../types/users/auth.js"

/**
 * Resolves the terminal a request came from, if it named one.
 *
 * A missing or unknown terminal is not an error: the browser may not have been
 * assigned one yet, and a sale can still record which staff member made it.
 */
const findTerminal = async (terminalId?: string) => {
    if (!terminalId) return null;
    return Terminal.findByPk(terminalId);
};

export const loginService = async (data: LoginRequest, callback: (data: LoginResponse) => void) => {
  try {
    const { username, password, terminalId } = data;

    // The password hash is excluded by the default scope, so it has to be
    // asked for explicitly here.
    const user = await Auth.scope("withPassword").findOne({
      where: { username: username.trim().toLowerCase() }
    });

    // The same message for an unknown username and a wrong password, so the
    // endpoint cannot be used to discover who works here.
    if (!user) {
      return callback(messageHandler("Incorrect username or password.", false, UNAUTHORIZED, {}));
    }

    const isValidPassword = await verifyPassword(password, user.password);
    if (!isValidPassword) {
      return callback(messageHandler("Incorrect username or password.", false, UNAUTHORIZED, {}));
    }

    if (!user.isActive) {
      return callback(messageHandler("This account has been disabled. Contact an administrator.", false, FORBIDDEN, {}));
    }

    const terminal = await findTerminal(terminalId);

    await user.update({ lastLoginAt: new Date() });

    await recordAudit({
      userId: user.id,
      userName: user.name,
      action: "USER_LOGIN",
      entityType: "SESSION",
      entityId: user.id,
      newValue: { terminalId: terminalId ?? null }
    });

    const accessToken = generateToken(
      // `name` rides along so every audited action can record who did it
      // without a lookup on each write.
      { id: user.id, name: user.name, username: user.username, role: user.role, terminalId: terminalId ?? null },
      config.auth.sessionExpiresIn as any
    );

    return callback(messageHandler("Login successful", true, SUCCESS, {
      // The controller moves this into an httpOnly cookie and strips it from
      // the body, so the token never reaches JavaScript in the browser.
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      },
      terminal
    }));
  } catch (error) {
    return callback(messageHandler("An error occured while processing your login.", false, INTERNAL_SERVER_ERROR, {}));
  }
};

export const sessionService = async (data: AuthenticatedUser, callback: (data: SessionResponse) => void) => {
  try {
    const user = await Auth.findByPk(data.id);

    // The cookie can outlive the account it names — disabled overnight, or
    // deleted from the database entirely.
    if (!user || !user.isActive) {
      return callback(messageHandler("Your session has expired.", false, UNAUTHORIZED, {}));
    }

    const terminal = await findTerminal(data.terminalId);

    return callback(messageHandler("Session active", true, SUCCESS, { user, terminal }));
  } catch (error) {
    return callback(messageHandler("An error occured while reading your session.", false, INTERNAL_SERVER_ERROR, {}));
  }
};

export const logoutService = async (data: AuthenticatedUser, callback: (data: LogoutResponse) => void) => {
  try {
    const user = await Auth.findByPk(data.id);

    if (user) {
      await recordAudit({
        userId: user.id,
        userName: user.name,
        action: "USER_LOGOUT",
        entityType: "SESSION",
        entityId: user.id
      });
    }

    return callback(messageHandler("Logout successful", true, SUCCESS, {}));
  } catch (error) {
    return callback(messageHandler("An error occured while signing you out.", false, INTERNAL_SERVER_ERROR, {}));
  }
};
