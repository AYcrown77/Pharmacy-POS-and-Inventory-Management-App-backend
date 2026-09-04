import express from 'express'
import { verify } from '../../middlewares/auth.js';
import {
  listInventoryController,
  inventorySummaryController,
  lowStockController,
  expiryAlertsController,
  listExpiringController,
  expirySummaryController,
  listBatchesController,
  getBatchController,
  listMovementsController,
  recentMovementsController,
} from '../../controllers/inventory/inventoryController.js';

export const inventoryRouter = express.Router()

// Inventory is read-only here — nothing on these routes changes stock. Every
// write goes through the stock routes, so that a change always carries a
// reason and a ledger entry.
inventoryRouter.use(verify)

inventoryRouter.get('/summary', inventorySummaryController)
inventoryRouter.get('/low-stock', lowStockController)
inventoryRouter.get('/expiry-alerts', expiryAlertsController)
inventoryRouter.get('/expiring', listExpiringController)
inventoryRouter.get('/expiry-summary', expirySummaryController)
inventoryRouter.get('/', listInventoryController)

export const batchRouter = express.Router()

batchRouter.use(verify)

batchRouter.get('/', listBatchesController)
batchRouter.get('/:id', getBatchController)

export const movementRouter = express.Router()

movementRouter.use(verify)

movementRouter.get('/recent', recentMovementsController)
movementRouter.get('/', listMovementsController)
