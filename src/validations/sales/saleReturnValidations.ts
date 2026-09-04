import { PAYMENT_METHODS } from "../../schemas/sales/saleSchema.js";

export const processReturnValidation = {
    saleId: {
        // A return always references a sale. There is no unattached refund.
        in: 'body',
        isUUID: true,
        errorMessage: 'A sale must be selected',
    },
    items: {
        in: 'body',
        isArray: {
            options: { min: 1 },
            errorMessage: 'Select at least one item to return',
        },
    },
    'items.*.saleItemId': {
        in: 'body',
        isUUID: true,
        errorMessage: 'Invalid line selected',
    },
    'items.*.quantity': {
        in: 'body',
        isInt: {
            options: { min: 1 },
            errorMessage: 'Return quantity must be at least one',
        },
        toInt: true,
    },
    reason: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'A reason is required',
        },
    },
    refundMethod: {
        in: 'body',
        isIn: {
            options: [PAYMENT_METHODS],
            errorMessage: 'Select a refund method',
        },
    },
};
