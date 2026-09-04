import express from 'express'
import { checkSchema } from 'express-validator';
import { validate } from '../../validations/index.js';
import { verify, authorize } from '../../middlewares/auth.js';
import {
  receiveStockController,
  adjustStockController,
  listAdjustmentsController,
  listSuppliersController,
} from '../../controllers/inventory/stockController.js';
import {
  receiveStockValidation,
  adjustStockValidation,
} from '../../validations/inventory/stockValidations.js';

export const stockRouter = express.Router()

stockRouter.use(verify)

// Receiving and adjusting stock are administrator actions. A cashier moves
// stock only by selling it, which goes through the sales route and always
// leaves a receipt behind.
stockRouter.post(
  '/receive',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(receiveStockValidation as any)),
  receiveStockController
)

stockRouter.post(
  '/adjustments',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(adjustStockValidation as any)),
  adjustStockController
)

stockRouter.get('/adjustments', authorize('ADMINISTRATOR'), listAdjustmentsController)

export const supplierRouter = express.Router()

supplierRouter.use(verify)

supplierRouter.get('/', listSuppliersController)
