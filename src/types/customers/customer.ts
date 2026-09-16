import { BaseResponse } from "../users/auth.js";

export interface CustomerInput {
    name: string;
    phone: string | null;
    note: string | null;
    isActive?: boolean;
}

export interface CustomerListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    isActive?: string;
    /** "true" narrows the list to accounts currently in debt. */
    owing?: string;
}

export interface RepaymentInput {
    amount: number;
    reason: string | null;
    /** Confirms a payment larger than the balance, leaving the account in credit. */
    allowOverpayment?: boolean;
}

export type CustomerResponse = BaseResponse;

export interface CustomerProductHabit {
    productId: string;
    productName: string;
    /** Base units kept (returns taken off). */
    quantity: number;
    /** Kobo spent on it, returns taken off. */
    total: number;
    /** How many separate purchases included it. */
    purchases: number;
}

export interface CustomerMonthSpend {
    /** YYYY-MM. */
    month: string;
    total: number;
    purchases: number;
}

export interface CustomerRecentSale {
    id: string;
    receiptNumber: string;
    total: number;
    refunded: number;
    paymentMethod: string;
    status: string;
    itemCount: number;
    createdAt: Date;
}

export interface CustomerInsights {
    /** Kobo, across every sale not fully reversed, refunds taken off. */
    totalSpent: number;
    purchaseCount: number;
    averageBasket: number;
    firstPurchaseAt: Date | null;
    lastPurchaseAt: Date | null;
    /** Typical gap between visits; null until there are two purchases. */
    averageDaysBetweenPurchases: number | null;
    preferredPaymentMethod: string | null;
    /** Kobo ever taken on account across those sales. */
    takenOnAccount: number;
    topProducts: CustomerProductHabit[];
    /** The last six months, oldest first, including months with nothing. */
    monthly: CustomerMonthSpend[];
    recentSales: CustomerRecentSale[];
}
