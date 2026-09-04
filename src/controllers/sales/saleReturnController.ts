import { Request, Response } from "express";
import {
    processReturnService,
    listReturnsService,
    getReturnsForSaleService,
} from "../../services/sales/saleReturnService.js";
import { ProcessReturnInput, ReturnListQuery } from "../../types/sales/saleReturn.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const processReturnController = async (req: Request<{}, {}, ProcessReturnInput>, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await processReturnService(req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listReturnsController = async (req: Request, res: Response) => {
    await listReturnsService(req.query as ReturnListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const returnsForSaleController = async (req: Request, res: Response) => {
    await getReturnsForSaleService(req.params.id, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
