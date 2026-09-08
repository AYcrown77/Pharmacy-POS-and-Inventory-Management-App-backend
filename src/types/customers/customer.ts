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
