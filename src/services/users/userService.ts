import { Op } from "sequelize";
import Auth from "../../schemas/users/authSchema.js";
import { recordAudit } from "../system/auditService.js";
import { hashPassword, messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import {
    BAD_REQUEST,
    CONFLICT,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
    SUCCESS,
} from "../../constants/statusCode.js";
import {
    CreateUserInput,
    UpdateUserInput,
    UserListQuery,
    UserResponse,
} from "../../types/users/user.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

/**
 * Staff accounts.
 *
 * Accounts are disabled, never deleted: sales, movements and audit entries all
 * name the person who made them, and deleting the account would orphan years
 * of records. There is deliberately no delete method here.
 *
 * Password hashes never leave the database — the model's default scope
 * excludes the column, so every read in this module is already safe.
 */

const normaliseUsername = (username: string) => username.trim().toLowerCase();

const findUsernameClash = async (username: string, excludeId?: string) =>
    Auth.findOne({
        where: {
            username,
            ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
        },
    });

export const listUsersService = async (
    query: UserListQuery,
    callback: (data: UserResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.role) where.role = query.role;
        if (query.isActive !== undefined) where.isActive = query.isActive === "true";

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [{ name: { [Op.iLike]: term } }, { username: { [Op.iLike]: term } }];
        }

        const { rows, count } = await Auth.findAndCountAll({
            where,
            order: [["name", query.sortDir === "desc" ? "DESC" : "ASC"]],
            limit,
            offset,
        });

        return callback(
            messageHandler("Users retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading users.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getUserService = async (id: string, callback: (data: UserResponse) => void) => {
    try {
        const user = await Auth.findByPk(id);

        if (!user) {
            return callback(messageHandler("User not found.", false, NOT_FOUND, {}));
        }

        return callback(messageHandler("User retrieved", true, SUCCESS, user));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the user.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const createUserService = async (
    input: CreateUserInput,
    actor: AuthenticatedUser,
    callback: (data: UserResponse) => void
) => {
    try {
        const username = normaliseUsername(input.username);

        const clash = await findUsernameClash(username);
        if (clash) {
            return callback(
                messageHandler(`The username ${username} is already taken.`, false, CONFLICT, {})
            );
        }

        const user = await Auth.create({
            name: input.name.trim(),
            username,
            password: await hashPassword(input.password),
            role: input.role,
            isActive: true,
        });

        await recordAudit({
            userId: actor.id,
            userName: actor.name,
            action: "USER_CREATED",
            entityType: "USER",
            entityId: user.id,
            newValue: { name: user.name, username: user.username, role: user.role },
        });

        // Re-read through the default scope so the hash is not in the response.
        const created = await Auth.findByPk(user.id);

        return callback(messageHandler("User created", true, SUCCESS, created));
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the user.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const updateUserService = async (
    id: string,
    input: UpdateUserInput,
    actor: AuthenticatedUser,
    callback: (data: UserResponse) => void
) => {
    try {
        const user = await Auth.findByPk(id);
        if (!user) {
            return callback(messageHandler("User not found.", false, NOT_FOUND, {}));
        }

        const username = normaliseUsername(input.username);

        const clash = await findUsernameClash(username, id);
        if (clash) {
            return callback(
                messageHandler(`The username ${username} is already taken.`, false, CONFLICT, {})
            );
        }

        const before = { name: user.name, username: user.username, role: user.role };

        await user.update({ name: input.name.trim(), username, role: input.role });

        await recordAudit({
            userId: actor.id,
            userName: actor.name,
            action: "USER_UPDATED",
            entityType: "USER",
            entityId: user.id,
            oldValue: before,
            newValue: { name: user.name, username: user.username, role: user.role },
        });

        return callback(messageHandler("User updated", true, SUCCESS, user));
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the user.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const setUserActiveService = async (
    id: string,
    isActive: boolean,
    actor: AuthenticatedUser,
    callback: (data: UserResponse) => void
) => {
    try {
        const user = await Auth.findByPk(id);
        if (!user) {
            return callback(messageHandler("User not found.", false, NOT_FOUND, {}));
        }

        // Disabling your own account would lock you out of the screen you are
        // standing on, and there may be no other administrator to undo it.
        if (user.id === actor.id && !isActive) {
            return callback(
                messageHandler("You cannot disable your own account.", false, BAD_REQUEST, {})
            );
        }

        // The last administrator has to stay enabled, or nobody can manage
        // users, settings or stock again without a database edit.
        if (!isActive && user.role === "ADMINISTRATOR") {
            const others = await Auth.count({
                where: { role: "ADMINISTRATOR", isActive: true, id: { [Op.ne]: user.id } },
            });
            if (others === 0) {
                return callback(
                    messageHandler(
                        "This is the last active administrator. Promote another account first.",
                        false,
                        BAD_REQUEST,
                        {}
                    )
                );
            }
        }

        await user.update({ isActive });

        await recordAudit({
            userId: actor.id,
            userName: actor.name,
            action: isActive ? "USER_ENABLED" : "USER_DISABLED",
            entityType: "USER",
            entityId: user.id,
            newValue: { isActive },
        });

        return callback(
            messageHandler(isActive ? "User enabled" : "User disabled", true, SUCCESS, user)
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while updating the account.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const resetPasswordService = async (
    id: string,
    password: string,
    actor: AuthenticatedUser,
    callback: (data: UserResponse) => void
) => {
    try {
        const user = await Auth.findByPk(id);
        if (!user) {
            return callback(messageHandler("User not found.", false, NOT_FOUND, {}));
        }

        await user.update({ password: await hashPassword(password) });

        // The new password is never echoed back, and never recorded in the
        // audit entry — only the fact that it was changed.
        await recordAudit({
            userId: actor.id,
            userName: actor.name,
            action: "USER_UPDATED",
            entityType: "USER",
            entityId: user.id,
            newValue: { passwordReset: true },
        });

        return callback(messageHandler("Password reset", true, SUCCESS, {}));
    } catch (error) {
        return callback(
            messageHandler("An error occured while resetting the password.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
