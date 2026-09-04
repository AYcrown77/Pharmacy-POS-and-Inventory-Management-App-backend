import { PaymentMethod } from "../../schemas/sales/saleSchema.js";
import { BaseResponse } from "../users/auth.js";

export interface ProcessReturnInput {
    saleId: string;
    items: Array<{ saleItemId: string; quantity: number }>;
    reason: string;
    refundMethod: PaymentMethod;
}

export interface ReturnListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortDir?: string;
    saleId?: string;
    processedBy?: string;
}

export type ReturnResponse = BaseResponse;
