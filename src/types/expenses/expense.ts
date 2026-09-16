import { ExpenseCategory, ExpenseStatus } from "../../schemas/expenses/expenseSchema.js";
import { PaymentMethod } from "../../schemas/sales/saleSchema.js";
import { BaseResponse } from "../users/auth.js";

export interface ExpenseInput {
    /** YYYY-MM-DD. Today when omitted. */
    expenseDate?: string | null;
    category: ExpenseCategory;
    /** Kobo. */
    amount: number;
    /** Cash when omitted: most expenses are paid out of the drawer. */
    paymentMethod?: PaymentMethod;
    reason: string;
}

export interface VoidExpenseInput {
    reason: string;
}

export interface ExpenseListQuery {
    page?: string;
    pageSize?: string;
    from?: string;
    to?: string;
    category?: ExpenseCategory;
    status?: ExpenseStatus;
    recordedById?: string;
    search?: string;
    sortDir?: string;
}

export interface ExpenseCategoryTotal {
    category: ExpenseCategory;
    total: number;
    count: number;
}

export interface ExpenseSummary {
    /** Kobo, recorded (not voided) expenses only. */
    total: number;
    count: number;
    /** Largest first. */
    byCategory: ExpenseCategoryTotal[];
}

export type ExpenseResponse = BaseResponse;
