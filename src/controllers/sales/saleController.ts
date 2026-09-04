import { Request, Response } from "express";
import {
    completeSaleService,
    listSalesService,
    getSaleService,
    getSaleByReceiptService,
    getRecentSalesService,
} from "../../services/sales/saleService.js";
import { CompleteSaleInput, SaleListQuery } from "../../types/sales/sale.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const completeSaleController = async (req: Request<{}, {}, CompleteSaleInput>, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    // The terminal is taken from the body if the till sent one, otherwise from
    // the session the cashier signed in on.
    const terminalId = req.body.terminalId || user.terminalId || "";

    await completeSaleService({ ...req.body, terminalId }, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listSalesController = async (req: Request, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await listSalesService(req.query as SaleListQuery, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getSaleController = async (req: Request, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await getSaleService(req.params.id, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getSaleByReceiptController = async (req: Request, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await getSaleByReceiptService(req.params.receiptNumber, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const recentSalesController = async (req: Request, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;
    const parsed = Number(req.query.limit);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 50) : 8;

    await getRecentSalesService(limit, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
