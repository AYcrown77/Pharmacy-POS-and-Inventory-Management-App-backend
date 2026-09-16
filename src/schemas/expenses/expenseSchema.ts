import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import { PAYMENT_METHODS, PaymentMethod } from "../sales/saleSchema.js";

// What the money went on. A short fixed list so the report can total by
// category; the reason says the rest in the recorder's own words.
export const EXPENSE_CATEGORIES = [
    "GENERATOR_FUEL",
    "UTILITIES",
    "TRANSPORT",
    "SUPPLIES",
    "REPAIRS",
    "STAFF",
    "RENT",
    "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// An expense is never deleted. One recorded in error is voided, which keeps
// the entry, who withdrew it and why on the record.
export const EXPENSE_STATUSES = ["RECORDED", "VOIDED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

// This is the attributes for the Expense model
export interface ExpenseAttributes {
    id: string;
    expenseDate: string;
    category: ExpenseCategory;
    amount: number;
    paymentMethod: PaymentMethod;
    reason: string;
    recordedById: string;
    recordedByName: string;
    status: ExpenseStatus;
    voidReason: string | null;
    voidedById: string | null;
    voidedByName: string | null;
    voidedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Expense model
export interface ExpenseCreationAttributes
    extends Optional<
        ExpenseAttributes,
        "id" | "status" | "voidReason" | "voidedById" | "voidedByName" | "voidedAt" | "createdAt" | "updatedAt"
    > {}

// This is the model for the Expense model
export class Expense extends Model<ExpenseAttributes, ExpenseCreationAttributes> implements ExpenseAttributes {
    declare id: string;
    declare expenseDate: string;
    declare category: ExpenseCategory;
    declare amount: number;
    declare paymentMethod: PaymentMethod;
    declare reason: string;
    declare recordedById: string;
    declare recordedByName: string;
    declare status: ExpenseStatus;
    declare voidReason: string | null;
    declare voidedById: string | null;
    declare voidedByName: string | null;
    declare voidedAt: Date | null;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the Expense model
export const ExpenseSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    expenseDate: {
        // The day the money went out, as a calendar date. That is not always
        // the day it was typed in, and it is the day the report deducts it from.
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    category: {
        type: DataTypes.ENUM(...EXPENSE_CATEGORIES),
        allowNull: false,
    },
    amount: {
        // Kobo, always positive.
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    paymentMethod: {
        // Cash out of the drawer is what a day-end count has to explain; money
        // sent by transfer never touches the drawer at all.
        type: DataTypes.ENUM(...PAYMENT_METHODS),
        allowNull: false,
        defaultValue: "CASH",
    },
    reason: {
        type: DataTypes.STRING(300),
        allowNull: false,
    },
    recordedById: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    recordedByName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM(...EXPENSE_STATUSES),
        allowNull: false,
        defaultValue: "RECORDED",
    },
    voidReason: {
        type: DataTypes.STRING(300),
        allowNull: true,
        defaultValue: null,
    },
    voidedById: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
    },
    voidedByName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    voidedAt: {
        type: DataTypes.DATE,
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
Expense.init(ExpenseSchema, {
    sequelize,
    modelName: "Expense",
    tableName: "expenses",
    indexes: [{ fields: ["expenseDate"] }, { fields: ["recordedById"] }, { fields: ["status"] }],
});

export { Expense as default };
