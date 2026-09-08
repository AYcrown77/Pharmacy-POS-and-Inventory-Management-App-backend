import express from 'express'
import { checkSchema } from 'express-validator';
import { validate } from '../../validations/index.js';
import { verify, authorize } from '../../middlewares/auth.js';
import {
  listCustomersController,
  getCustomerController,
  getCustomerLedgerController,
  createCustomerController,
  updateCustomerController,
  recordRepaymentController,
} from '../../controllers/customers/customerController.js';
import {
  customerValidation,
  repaymentValidation,
} from '../../validations/customers/customerValidations.js';

export const customerRouter = express.Router()

customerRouter.use(verify)

// A cashier needs all of this at the counter: to find the account, see what is
// owed before handing over goods, register someone new, and take a repayment.
customerRouter.get('/', listCustomersController)
customerRouter.get('/:id/ledger', getCustomerLedgerController)
customerRouter.get('/:id', getCustomerController)

customerRouter.post('/', validate(checkSchema(customerValidation as any)), createCustomerController)
customerRouter.post(
  '/:id/repayment',
  validate(checkSchema(repaymentValidation as any)),
  recordRepaymentController
)

// Editing the record itself — including disabling an account — is an
// administrator's job. Note that no route anywhere sets a balance directly:
// it moves only through a sale or a repayment, each of which leaves a ledger
// entry behind it.
customerRouter.patch(
  '/:id',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(customerValidation as any)),
  updateCustomerController
)
