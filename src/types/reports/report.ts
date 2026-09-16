import { MovementType } from "../../schemas/inventory/stockMovementSchema.js";
import { PaymentMethod, SalePaymentMethod } from "../../schemas/sales/saleSchema.js";
import { ExpenseSummary } from "../expenses/expense.js";
import { BaseResponse } from "../users/auth.js";

export interface SalesReportQuery {
    from?: string;
    to?: string;
    cashierId?: string;
    paymentMethod?: SalePaymentMethod;
}

export interface MovementReportQuery {
    from?: string;
    to?: string;
    productId?: string;
    movementType?: MovementType;
    userId?: string;
}

export interface SalesTrendPoint {
    date: string;
    /** Pre-formatted axis label, so the chart does no date maths. */
    label: string;
    total: number;
    transactions: number;
}

export interface PaymentMixEntry {
    method: PaymentMethod;
    /** What this method paid towards sales — change and debt taken off. */
    total: number;
    transactions: number;
    /** 0-1. */
    share: number;
}

export interface SalesReportSummary {
    grossSales: number;
    transactionCount: number;
    averageSale: number;
    byMethod: PaymentMixEntry[];
    refundedAmount: number;
    refundCount: number;
    /** Goods handed over on account: in gross sales, but not yet paid for. */
    creditSales: number;
    /** Money received against customers' debts — not a sale, but in the drawer. */
    debtCollected: number;
    expenses: ExpenseSummary;
    /** Gross sales, less refunds, less expenses. */
    netSales: number;
}

export interface CashierReportRow {
    cashierId: string;
    cashierName: string;
    transactions: number;
    cashSales: number;
    cardSales: number;
    transferSales: number;
    creditSales: number;
    totalSales: number;
    averageSale: number;
}

export interface MovementReportSummary {
    movementCount: number;
    unitsIn: number;
    unitsOut: number;
    /** Positive when the period added more stock than it removed. */
    netUnits: number;
}

export interface DebtorRow {
    customerId: string;
    customerName: string;
    phone: string | null;
    balance: number;
    /** Days since money last came in against this account. */
    daysSinceLastPayment: number | null;
    lastActivityAt: Date | null;
}

export type ReportResponse = BaseResponse;
