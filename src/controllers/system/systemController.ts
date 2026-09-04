import { Request, Response } from "express";
import { healthService } from "../../services/system/systemService.js";

export const healthController = async (req: Request, res: Response) => {
  await healthService((result) => {
    return res.status(result.statusCode).json(result);
  });
};
