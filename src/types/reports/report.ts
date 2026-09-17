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
    /**
     * Sales rung up on these dates that have since been fully returned. Left
     * out of gross sales, but their refunds are money out on the day of the
     * return — so the takings sum adds them back to count each sale once.
     */
    returnedSalesTotal: number;
    /** Debt taken: goods handed over on account on these dates, not yet paid for. */
    creditSales: number;
    /** Debt paid back: money received against customers' debts — not a sale, but in the drawer. */
    debtCollected: number;
    /** Returned goods that cleared a customer's debt rather than being paid out. */
    debtCleared: number;
    /** Refunds handed back as money: the value of returns, less the debt they cleared. */
    refundsPaidOut: number;
    /** Every entry behind the three debt figures, newest first. */
    debtActivity: DebtActivity;
    expenses: ExpenseSummary;
    /**
     * What the period actually brought in: gross sales, plus sales since fully
     * returned, less debt taken, plus debt paid back, less refunds paid out,
     * less expenses. Every part is counted on the date it happened.
     */
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

/** One sale that put goods on a customer's account. */
export interface DebtTakenEntry {
    saleId: string;
    receiptNumber: string;
    customerId: string | null;
    customerName: string | null;
    /** Kobo taken on account by this sale. */
    amount: number;
    recordedBy: string;
    /** REVERSED when the goods have since all come back. */
    status: string;
    createdAt: Date;
}

/** Money paid back, or debt cleared by a return — one ledger entry. */
export interface DebtLedgerMovement {
    entryId: string;
    customerId: string;
    customerName: string;
    /** Kobo, always positive. */
    amount: number;
    /** The sale it happened with, if any: a surplus at the till, or a return. */
    saleId: string | null;
    receiptNumber: string | null;
    recordedBy: string;
    reason: string | null;
    createdAt: Date;
}

export interface DebtActivity {
    taken: DebtTakenEntry[];
    paid: DebtLedgerMovement[];
    cleared: DebtLedgerMovement[];
}
