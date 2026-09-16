import { PaymentMethod, SalePaymentMethod, SaleStatus } from "../../schemas/sales/saleSchema.js";
import { PriceTier, SaleUnit } from "../../schemas/products/productSchema.js";
import { BaseResponse } from "../users/auth.js";

export interface CompleteSaleLine {
    productId: string;
    /** How many of `unit`. */
    quantity: number;
    /**
     * A single base unit or a whole pack. Omitted by older callers, in which
     * case the tier's default applies — which is exactly how they behaved
     * before units were chosen per line.
     */
    unit?: SaleUnit;
}

/** Money handed over by one method. */
export interface PaymentTender {
    method: PaymentMethod;
    /** Kobo. */
    amount: number;
}

export interface CompleteSaleInput {
    lines: CompleteSaleLine[];
    discount: number;
    /**
     * Every method the customer used and how much by each — part cash, part
     * card is an ordinary sale. Older tills send `paymentMethod` and
     * `amountReceived` instead, which is read as a list of one.
     */
    payments?: PaymentTender[];
    paymentMethod?: PaymentMethod;
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
    paymentMethod?: SalePaymentMethod;
    status?: SaleStatus;
    terminalId?: string;
    productId?: string;
}

/** One batch a line was drawn from, in the order FEFO consumed them. */
export interface FefoAllocation {
    batchId: string;
    batchNumber: string;
    /** Count of the line's unit: packs, or singles. */
    quantity: number;
    /** Base units in one of those — the pack size, or 1. */
    unitsPerSaleUnit: number;
    expiryDate: string;
}

export type SaleResponse = BaseResponse;
