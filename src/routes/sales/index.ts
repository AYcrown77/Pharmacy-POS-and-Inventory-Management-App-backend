import express from 'express'
import { checkSchema } from 'express-validator';
import { validate } from '../../validations/index.js';
import { verify } from '../../middlewares/auth.js';
import {
  completeSaleController,
  listSalesController,
  getSaleController,
  getSaleByReceiptController,
  recentSalesController,
} from '../../controllers/sales/saleController.js';
import {
  processReturnController,
  listReturnsController,
  returnsForSaleController,
} from '../../controllers/sales/saleReturnController.js';
import { completeSaleValidation } from '../../validations/sales/saleValidations.js';
import { processReturnValidation } from '../../validations/sales/saleReturnValidations.js';

export const saleRouter = express.Router()

saleRouter.use(verify)

// Both roles sell. What differs is what they can read back: the service scopes
// a cashier's list and detail reads to their own sales.
saleRouter.post('/', validate(checkSchema(completeSaleValidation as any)), completeSaleController)

saleRouter.get('/recent', recentSalesController)
saleRouter.get('/receipt/:receiptNumber', getSaleByReceiptController)
saleRouter.get('/', listSalesController)
saleRouter.get('/:id/returns', returnsForSaleController)
saleRouter.get('/:id', getSaleController)

// There is deliberately no DELETE here, and there never should be. A sale that
// was wrong is reversed through /returns, which leaves both the original and
// the reversal on the record.

export const returnRouter = express.Router()

returnRouter.use(verify)

// Both roles can take a return at the counter. It is append-only either way:
// the reversal is a new record, and the sale it references is left intact.
returnRouter.post(
  '/',
  validate(checkSchema(processReturnValidation as any)),
  processReturnController
)
returnRouter.get('/', listReturnsController)
