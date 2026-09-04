import { Request, Response } from "express";
import {
    getSalesSummaryService,
    getSalesTrendService,
    getDashboardTrendService,
    getPaymentMixService,
    getCashierReportService,
    getMovementSummaryService,
} from "../../services/reports/reportService.js";
import { getDashboardSummaryService } from "../../services/reports/dashboardService.js";
import { MovementReportQuery, SalesReportQuery } from "../../types/reports/report.js";

/** Days of history a dashboard chart asks for, clamped to something sane. */
const resolveDays = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 365) : fallback;
};

export const dashboardSummaryController = async (_req: Request, res: Response) => {
    await getDashboardSummaryService((result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const dashboardTrendController = async (req: Request, res: Response) => {
    await getDashboardTrendService(resolveDays(req.query.days, 7), (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const paymentMixController = async (req: Request, res: Response) => {
    await getPaymentMixService(resolveDays(req.query.days, 7), (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const salesSummaryController = async (req: Request, res: Response) => {
    await getSalesSummaryService(req.query as SalesReportQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const salesTrendController = async (req: Request, res: Response) => {
    await getSalesTrendService(req.query as SalesReportQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const cashierReportController = async (req: Request, res: Response) => {
    await getCashierReportService(req.query as SalesReportQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const movementSummaryController = async (req: Request, res: Response) => {
    await getMovementSummaryService(req.query as MovementReportQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
