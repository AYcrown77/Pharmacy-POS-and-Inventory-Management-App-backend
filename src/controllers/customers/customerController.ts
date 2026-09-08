import { Request, Response } from "express";
import {
    listCustomersService,
    getCustomerService,
    getCustomerLedgerService,
    createCustomerService,
    updateCustomerService,
    recordRepaymentService,
} from "../../services/customers/customerService.js";
import {
    CustomerInput,
    CustomerListQuery,
    RepaymentInput,
} from "../../types/customers/customer.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const listCustomersController = async (req: Request, res: Response) => {
    await listCustomersService(req.query as CustomerListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getCustomerController = async (req: Request, res: Response) => {
    await getCustomerService(req.params.id, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getCustomerLedgerController = async (req: Request, res: Response) => {
    await getCustomerLedgerService(req.params.id, req.query as CustomerListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const createCustomerController = async (req: Request<{}, {}, CustomerInput>, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await createCustomerService(req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const updateCustomerController = async (
    req: Request<{ id: string }, {}, CustomerInput>,
    res: Response
) => {
    const user = (req as any).user as AuthenticatedUser;

    await updateCustomerService(req.params.id, req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const recordRepaymentController = async (
    req: Request<{ id: string }, {}, RepaymentInput>,
    res: Response
) => {
    const user = (req as any).user as AuthenticatedUser;

    await recordRepaymentService(req.params.id, req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
