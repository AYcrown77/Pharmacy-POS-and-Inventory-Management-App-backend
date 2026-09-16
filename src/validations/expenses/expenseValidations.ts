import { EXPENSE_CATEGORIES } from "../../schemas/expenses/expenseSchema.js";
import { PAYMENT_METHODS } from "../../schemas/sales/saleSchema.js";

export const expenseValidation = {
    expenseDate: {
        in: 'body',
        optional: { options: { nullable: true } },
        isISO8601: {
            options: { strict: true },
            errorMessage: 'Enter the date the money was spent',
        },
    },
    category: {
        in: 'body',
        isIn: {
            options: [EXPENSE_CATEGORIES],
            errorMessage: 'Choose what the money was spent on',
        },
    },
    amount: {
        // Kobo, and strictly positive: an expense of nothing is a mistake.
        in: 'body',
        isInt: {
            options: { min: 1 },
            errorMessage: 'Enter an amount greater than zero',
        },
        toInt: true,
    },
    paymentMethod: {
        in: 'body',
        optional: true,
        isIn: {
            options: [PAYMENT_METHODS],
            errorMessage: 'Choose how it was paid',
        },
    },
    reason: {
        // Required: an amount with no explanation is exactly what an expense
        // record exists to prevent.
        in: 'body',
        isString: true,
        trim: true,
        isLength: {
            options: { min: 3, max: 300 },
            errorMessage: 'Say what the money was for',
        },
    },
};

export const voidExpenseValidation = {
    reason: {
        in: 'body',
        isString: true,
        trim: true,
        isLength: {
            options: { min: 3, max: 300 },
            errorMessage: 'Say why this expense is being voided',
        },
    },
};
