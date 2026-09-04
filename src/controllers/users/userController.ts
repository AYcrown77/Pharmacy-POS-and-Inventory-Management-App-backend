import { Request, Response } from "express";
import {
    listUsersService,
    getUserService,
    createUserService,
    updateUserService,
    setUserActiveService,
    resetPasswordService,
} from "../../services/users/userService.js";
import { CreateUserInput, UpdateUserInput, UserListQuery } from "../../types/users/user.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const listUsersController = async (req: Request, res: Response) => {
    await listUsersService(req.query as UserListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getUserController = async (req: Request, res: Response) => {
    await getUserService(req.params.id, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const createUserController = async (req: Request<{}, {}, CreateUserInput>, res: Response) => {
    const actor = (req as any).user as AuthenticatedUser;

    await createUserService(req.body, actor, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const updateUserController = async (
    req: Request<{ id: string }, {}, UpdateUserInput>,
    res: Response
) => {
    const actor = (req as any).user as AuthenticatedUser;

    await updateUserService(req.params.id, req.body, actor, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const setUserActiveController = async (
    req: Request<{ id: string }, {}, { isActive: boolean }>,
    res: Response
) => {
    const actor = (req as any).user as AuthenticatedUser;

    await setUserActiveService(req.params.id, Boolean(req.body.isActive), actor, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const resetPasswordController = async (
    req: Request<{ id: string }, {}, { password: string }>,
    res: Response
) => {
    const actor = (req as any).user as AuthenticatedUser;

    await resetPasswordService(req.params.id, req.body.password, actor, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
