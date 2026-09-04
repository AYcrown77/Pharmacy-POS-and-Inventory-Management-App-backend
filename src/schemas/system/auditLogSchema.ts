import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// Every action the specification asks to be tracked
export const AUDIT_ACTIONS = [
    "USER_LOGIN",
    "USER_LOGOUT",
    "PRODUCT_CREATED",
    "PRODUCT_UPDATED",
    "PRICE_CHANGED",
    "STOCK_RECEIVED",
    "STOCK_ADJUSTMENT",
    "SALE_COMPLETED",
    "SALE_REVERSAL",
    "USER_CREATED",
    "USER_UPDATED",
    "USER_DISABLED",
    "USER_ENABLED",
    "SETTINGS_UPDATED",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// This is the attributes for the AuditLog model
export interface AuditLogAttributes {
    id: string;
    userId: string;
    userName: string;
    action: AuditAction;
    entityType: string;
    entityId: string | null;
    oldValue: Record<string, unknown> | null;
    newValue: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the AuditLog model
export interface AuditLogCreationAttributes
    extends Optional<
        AuditLogAttributes,
        "id" | "entityId" | "oldValue" | "newValue" | "createdAt" | "updatedAt"
    > {}

// This is the model for the AuditLog model
export class AuditLog extends Model<AuditLogAttributes, AuditLogCreationAttributes> implements AuditLogAttributes {
    declare id: string;
    declare userId: string;
    declare userName: string;
    declare action: AuditAction;
    declare entityType: string;
    declare entityId: string | null;
    declare oldValue: Record<string, unknown> | null;
    declare newValue: Record<string, unknown> | null;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the AuditLog model
export const AuditLogSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    userName: {
        // Denormalised on purpose: the log must still read correctly if the
        // account is later renamed or disabled.
        type: DataTypes.STRING,
        allowNull: false,
    },
    action: {
        type: DataTypes.ENUM(...AUDIT_ACTIONS),
        allowNull: false,
    },
    entityType: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    entityId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    oldValue: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
    },
    newValue: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: null,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
} as const;

// Initialize and export the Sequelize model instance
AuditLog.init(AuditLogSchema, {
    sequelize,
    modelName: "AuditLog",
    tableName: "audit_logs",
});

export { AuditLog as default };
