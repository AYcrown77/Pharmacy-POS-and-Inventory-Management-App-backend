import { Request, Response } from "express";
import {
    listInventoryService,
    getInventorySummaryService,
    getLowStockService,
    getExpiryAlertsService,
    listExpiringService,
    getExpirySummaryService,
} from "../../services/inventory/inventoryService.js";
import {
    listBatchesService,
    getBatchesForProductService,
    getBatchService,
} from "../../services/inventory/batchService.js";
import {
    listMovementsService,
    getRecentMovementsService,
} from "../../services/inventory/movementService.js";
import {
    BatchListQuery,
    InventoryListQuery,
    MovementListQuery,
} from "../../types/inventory/inventory.js";

/** Reads an optional `limit`, falling back to the whole list when absent. */
const optionalLimit = (value: unknown): number | null => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 200) : null;
};

export const listInventoryController = async (req: Request, res: Response) => {
    await listInventoryService(req.query as InventoryListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const inventorySummaryController = async (_req: Request, res: Response) => {
    await getInventorySummaryService((result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const lowStockController = async (req: Request, res: Response) => {
    await getLowStockService(optionalLimit(req.query.limit), (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const expiryAlertsController = async (req: Request, res: Response) => {
    await getExpiryAlertsService(optionalLimit(req.query.limit), (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listExpiringController = async (req: Request, res: Response) => {
    await listExpiringService(req.query as InventoryListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const expirySummaryController = async (_req: Request, res: Response) => {
    await getExpirySummaryService((result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listBatchesController = async (req: Request, res: Response) => {
    await listBatchesService(req.query as BatchListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getBatchController = async (req: Request, res: Response) => {
    await getBatchService(req.params.id, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const batchesForProductController = async (req: Request, res: Response) => {
    await getBatchesForProductService(req.params.id, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listMovementsController = async (req: Request, res: Response) => {
    await listMovementsService(req.query as MovementListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const recentMovementsController = async (req: Request, res: Response) => {
    await getRecentMovementsService(optionalLimit(req.query.limit) ?? 10, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
