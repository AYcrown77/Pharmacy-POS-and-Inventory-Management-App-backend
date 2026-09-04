import { ADJUSTMENT_REASONS } from "../../schemas/inventory/stockAdjustmentSchema.js";

export const receiveStockValidation = {
    productId: {
        in: 'body',
        isUUID: true,
        errorMessage: 'A product must be selected',
    },
    batchNumber: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Batch number is required',
        },
    },
    expiryDate: {
        in: 'body',
        // ISO 8601 with strict mode keeps this a calendar date; a full
        // timestamp here would be a different thing entirely.
        isISO8601: {
            options: { strict: true, strictSeparator: true },
            errorMessage: 'Enter a valid expiry date',
        },
    },
    quantityReceived: {
        in: 'body',
        isInt: {
            options: { min: 1 },
            errorMessage: 'Quantity received must be at least one',
        },
        toInt: true,
    },
    costPrice: {
        in: 'body',
        isInt: {
            options: { min: 0 },
            errorMessage: 'Cost price must be a whole number of kobo',
        },
        toInt: true,
    },
    sellingPrice: {
        in: 'body',
        isInt: {
            options: { min: 0 },
            errorMessage: 'Selling price must be a whole number of kobo',
        },
        toInt: true,
    },
    supplierName: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid supplier',
    },
    receivedAt: {
        in: 'body',
        optional: true,
        isISO8601: {
            options: { strict: true, strictSeparator: true },
            errorMessage: 'Enter a valid received date',
        },
    },
};

export const adjustStockValidation = {
    batchId: {
        in: 'body',
        isUUID: true,
        errorMessage: 'A batch must be selected',
    },
    adjustment: {
        // Signed, and explicitly not zero — an adjustment of nothing is a
        // mistake, not a no-op worth recording in the ledger.
        in: 'body',
        isInt: {
            errorMessage: 'Enter an adjustment quantity',
        },
        toInt: true,
        custom: {
            options: (value: number) => value !== 0,
            errorMessage: 'Enter an adjustment quantity',
        },
    },
    reason: {
        in: 'body',
        isIn: {
            options: [ADJUSTMENT_REASONS],
            errorMessage: 'Select a reason for the adjustment',
        },
    },
    notes: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid notes',
    },
};
