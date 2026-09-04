import { PaymentMethod, SaleStatus } from "../../schemas/sales/saleSchema.js";
import { BaseResponse } from "../users/auth.js";

export interface CompleteSaleLine {
    productId: string;
    quantity: number;
}

export interface CompleteSaleInput {
    lines: CompleteSaleLine[];
    discount: number;
    paymentMethod: PaymentMethod;
    amountReceived: number | null;
    terminalId: string;
}

export interface SaleListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortDir?: string;
    from?: string;
    to?: string;
    cashierId?: string;
    paymentMethod?: PaymentMethod;
    status?: SaleStatus;
    terminalId?: string;
    productId?: string;
}

/** One batch a line was drawn from, in the order FEFO consumed them. */
export interface FefoAllocation {
    batchId: string;
    batchNumber: string;
    quantity: number;
    expiryDate: string;
}

export type SaleResponse = BaseResponse;
