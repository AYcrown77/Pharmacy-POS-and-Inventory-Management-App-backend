import { AdjustmentReason } from "../../schemas/inventory/stockAdjustmentSchema.js";
import { MovementType } from "../../schemas/inventory/stockMovementSchema.js";
import { BaseResponse } from "../users/auth.js";

export interface ReceiveStockInput {
    productId: string;
    batchNumber: string;
    expiryDate: string;
    quantityReceived: number;
    costPrice: number;
    sellingPrice: number;
    supplierName: string;
    receivedAt: string;
}

export interface AdjustStockInput {
    batchId: string;
    /** Signed change: negative removes stock. */
    adjustment: number;
    reason: AdjustmentReason;
    notes: string | null;
}

export interface AdjustmentListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortDir?: string;
    productId?: string;
    reason?: AdjustmentReason;
    userId?: string;
    from?: string;
    to?: string;
}

/**
 * Which kind of ledger entry an adjustment reason produces.
 *
 * Expiry and damage are real losses and read as such in the movement report;
 * a miscount or a supplier return is a correction, not a loss, so it must not
 * be badged red alongside them.
 */
export const ADJUSTMENT_REASON_MOVEMENT: Record<AdjustmentReason, MovementType> = {
    EXPIRED: "EXPIRY",
    DAMAGED: "DAMAGE",
    MISSING: "ADJUSTMENT",
    COUNT_CORRECTION: "ADJUSTMENT",
    RETURNED_TO_SUPPLIER: "ADJUSTMENT",
    OTHER: "ADJUSTMENT",
};

export type StockResponse = BaseResponse;
