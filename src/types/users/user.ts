import { Role } from "../../schemas/users/authSchema.js";
import { AuditAction } from "../../schemas/system/auditLogSchema.js";
import { BaseResponse } from "./auth.js";

export interface CreateUserInput {
    name: string;
    username: string;
    role: Role;
    password: string;
}

export interface UpdateUserInput {
    name: string;
    username: string;
    role: Role;
}

export interface UserListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortDir?: string;
    role?: Role;
    isActive?: string;
}

export interface AuditListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortDir?: string;
    userId?: string;
    action?: AuditAction;
    entityType?: string;
    from?: string;
    to?: string;
}

export interface SettingsInput {
    name: string;
    address: string;
    phone: string;
    receiptFooter: string;
    showLogoOnReceipt: boolean;
    currency: string;
    lowStockAlertsEnabled: boolean;
    expiryAlertDays: number;
}

export type UserResponse = BaseResponse;
