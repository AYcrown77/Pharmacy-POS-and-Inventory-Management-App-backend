import { PAYMENT_METHODS } from "../../schemas/sales/saleSchema.js";
import { PRICE_TIERS, SALE_UNITS } from "../../schemas/products/productSchema.js";

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
    'lines.*.unit': {
        in: 'body',
        optional: true,
        isIn: {
            options: [SALE_UNITS],
            errorMessage: 'A line must be sold as singles or packs',
        },
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
    priceTier: {
        in: 'body',
        optional: true,
        isIn: {
            options: [PRICE_TIERS],
            errorMessage: 'Unknown price tier',
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
