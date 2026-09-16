import express from 'express'
import { checkSchema } from 'express-validator';
import { validate } from '../../validations/index.js';
import { verify, authorize } from '../../middlewares/auth.js';
import {
  getExpenseSummaryController,
  listExpensesController,
  recordExpenseController,
  voidExpenseController,
} from '../../controllers/expenses/expenseController.js';
import {
  expenseValidation,
  voidExpenseValidation,
} from '../../validations/expenses/expenseValidations.js';

export const expenseRouter = express.Router()

expenseRouter.use(verify)

// Money leaves the drawer at the counter — fuel for the generator, a delivery
// fee — so both roles record it, and a cashier reads back only their own.
expenseRouter.get('/summary', getExpenseSummaryController)
expenseRouter.get('/', listExpensesController)
expenseRouter.post('/', validate(checkSchema(expenseValidation as any)), recordExpenseController)

// Withdrawing an entry changes the day's figures, which is an administrator's
// call. There is no DELETE: a voided expense stays on the record.
expenseRouter.post(
  '/:id/void',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(voidExpenseValidation as any)),
  voidExpenseController
)
