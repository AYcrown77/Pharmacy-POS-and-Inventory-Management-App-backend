import { PAYMENT_METHODS } from "../../schemas/sales/saleSchema.js";

export const completeSaleValidation = {
    lines: {
        in: 'body',
        isArray: {
            options: { min: 1 },
            errorMessage: 'A sale must contain at least one item',
        },
    },
    'lines.*.productId': {
        in: 'body',
        isUUID: true,
        errorMessage: 'Invalid product in the cart',
    },
    'lines.*.quantity': {
        in: 'body',
        isInt: {
            options: { min: 1 },
            errorMessage: 'Every line must have a quantity of at least one',
        },
        toInt: true,
    },
    discount: {
        in: 'body',
        optional: true,
        isInt: {
            options: { min: 0 },
            errorMessage: 'Discount must be a whole number of kobo',
        },
        toInt: true,
    },
    paymentMethod: {
        in: 'body',
        isIn: {
            options: [PAYMENT_METHODS],
            errorMessage: 'Select a payment method',
        },
    },
    amountReceived: {
        // Cash only. Card and transfer are paid to the exact total, so there
        // is nothing to tender and nothing to give back.
        in: 'body',
        optional: { options: { nullable: true } },
        isInt: {
            options: { min: 0 },
            errorMessage: 'Amount received must be a whole number of kobo',
        },
        toInt: true,
    },
    terminalId: {
        in: 'body',
        optional: true,
        isString: true,
        errorMessage: 'Invalid terminal',
    },
};
