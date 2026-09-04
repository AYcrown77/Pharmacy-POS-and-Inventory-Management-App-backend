import { Role } from "../../schemas/users/authSchema.js";

export interface BaseResponse {
    message: string;
    success: boolean;
    statusCode: number;
    data: any;
}

export interface SessionUser {
    id: string;
    name: string;
    username: string;
    role: Role;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface LoginRequest {
    username: string;
    password: string;
    terminalId?: string;
}

export type LoginResponse = BaseResponse;

export type SessionResponse = BaseResponse;

export type LogoutResponse = BaseResponse;

// What the `verify` middleware puts on the request once a session is proven.
export interface AuthenticatedUser {
    id: string;
    name: string;
    username: string;
    role: Role;
    terminalId?: string;
}
