import express from 'express'
import { verify, authorize } from '../../middlewares/auth.js';
import {
  dashboardSummaryController,
  dashboardTrendController,
  paymentMixController,
  salesSummaryController,
  salesTrendController,
  cashierReportController,
  movementSummaryController,
} from '../../controllers/reports/reportController.js';

export const reportRouter = express.Router()

reportRouter.use(verify)

// Reports are revenue oversight, which section 17 gives to administrators
// only. A cashier reads their own takings from their own sales list instead.
reportRouter.use(authorize('ADMINISTRATOR'))

reportRouter.get('/dashboard', dashboardSummaryController)
reportRouter.get('/sales-trend', dashboardTrendController)
reportRouter.get('/payment-mix', paymentMixController)

reportRouter.get('/sales/summary', salesSummaryController)
reportRouter.get('/sales/trend', salesTrendController)
reportRouter.get('/cashiers', cashierReportController)
reportRouter.get('/stock-movements/summary', movementSummaryController)
