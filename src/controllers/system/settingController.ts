import { Request, Response } from "express";
import {
    getSettingsService,
    updateSettingsService,
    listTerminalsService,
} from "../../services/system/settingService.js";
import {
    listAuditService,
    listAuditEntityTypesService,
} from "../../services/system/auditService.js";
import { AuditListQuery, SettingsInput } from "../../types/users/user.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const getSettingsController = async (_req: Request, res: Response) => {
    await getSettingsService((result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const updateSettingsController = async (req: Request<{}, {}, SettingsInput>, res: Response) => {
    const actor = (req as any).user as AuthenticatedUser;

    await updateSettingsService(req.body, actor, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listTerminalsController = async (_req: Request, res: Response) => {
    await listTerminalsService((result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const listAuditController = async (req: Request, res: Response) => {
    await listAuditService(req.query as AuditListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const auditEntityTypesController = async (_req: Request, res: Response) => {
    await listAuditEntityTypesService((result) => {
        return res.status(result.statusCode).json(result);
    });
};
