import { daysUntil, DateOnly } from "./date.js";

/**
 * Derived stock and expiry classifications.
 *
 * These mirror the frontend's `lib/status.ts` exactly. They are duplicated
 * deliberately rather than shared: the server is the authority, and a client
 * that disagreed about what "low stock" means must not be able to change the
 * answer the reports give.
 */

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export type ExpiryStatus = "EXPIRED" | "CRITICAL_30" | "WARNING_60" | "NOTICE_90" | "HEALTHY";

export const deriveStockStatus = (available: number, minimum: number): StockStatus => {
    if (available <= 0) return "OUT_OF_STOCK";
    if (available <= minimum) return "LOW_STOCK";
    return "IN_STOCK";
};

/** Expiry bands from section 20 of the specification. */
export const deriveExpiryStatus = (daysUntilExpiry: number): ExpiryStatus => {
    if (daysUntilExpiry < 0) return "EXPIRED";
    if (daysUntilExpiry <= 30) return "CRITICAL_30";
    if (daysUntilExpiry <= 60) return "WARNING_60";
    if (daysUntilExpiry <= 90) return "NOTICE_90";
    return "HEALTHY";
};

export const expiryStatusFor = (expiryDate: DateOnly): ExpiryStatus =>
    deriveExpiryStatus(daysUntil(expiryDate));

/**
 * The worst expiry band across a product's batches.
 *
 * A product with one expired batch and fifty healthy ones still needs someone
 * to look at it, so the product-level badge takes the most urgent band rather
 * than an average.
 */
const SEVERITY: ExpiryStatus[] = ["EXPIRED", "CRITICAL_30", "WARNING_60", "NOTICE_90", "HEALTHY"];

export const worstExpiryStatus = (statuses: ExpiryStatus[]): ExpiryStatus => {
    for (const status of SEVERITY) {
        if (statuses.includes(status)) return status;
    }
    return "HEALTHY";
};
