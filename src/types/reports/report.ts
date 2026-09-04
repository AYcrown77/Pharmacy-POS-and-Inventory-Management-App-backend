import { MovementType } from "../../schemas/inventory/stockMovementSchema.js";
import { PaymentMethod } from "../../schemas/sales/saleSchema.js";
import { BaseResponse } from "../users/auth.js";

export interface SalesReportQuery {
    from?: string;
    to?: string;
    cashierId?: string;
    paymentMethod?: PaymentMethod;
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
}

export interface CashierReportRow {
    cashierId: string;
    cashierName: string;
    transactions: number;
    cashSales: number;
    cardSales: number;
    transferSales: number;
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

export type ReportResponse = BaseResponse;
