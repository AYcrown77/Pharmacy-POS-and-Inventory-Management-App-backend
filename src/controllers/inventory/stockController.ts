import { Request, Response } from "express";
import {
    receiveStockService,
    adjustStockService,
    listAdjustmentsService,
    listSuppliersService,
} from "../../services/inventory/stockOperationsService.js";
import {
    AdjustStockInput,
    AdjustmentListQuery,
    ReceiveStockInput,
} from "../../types/inventory/stock.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const receiveStockController = async (req: Request<{}, {}, ReceiveStockInput>, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await receiveStockService(req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const adjustStockController = async (req: Request<{}, {}, AdjustStockInput>, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await adjustStockService(req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listAdjustmentsController = async (req: Request, res: Response) => {
    await listAdjustmentsService(req.query as AdjustmentListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listSuppliersController = async (_req: Request, res: Response) => {
    await listSuppliersService((result) => {
        return res.status(result.statusCode).json(result);
    });
};
