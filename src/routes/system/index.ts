import express from 'express'
import { healthController } from "../../controllers/system/systemController.js";

export const healthRouter = express.Router()

healthRouter.get('/', healthController)
