import { PaymentMethod, SaleStatus } from "../../schemas/sales/saleSchema.js";
import { PriceTier } from "../../schemas/products/productSchema.js";
import { BaseResponse } from "../users/auth.js";

export interface CompleteSaleLine {
    productId: string;
    quantity: number;
}

export interface CompleteSaleInput {
    lines: CompleteSaleLine[];
    discount: number;
    paymentMethod: PaymentMethod;
    /** Which price list to charge. Defaults to the walk-in consumer price. */
    priceTier?: PriceTier;
    amountReceived: number | null;
    /** Attaching an account lets an underpayment become debt. */
    customerId?: string | null;
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
