import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
// Type-only, so this does not create a runtime cycle with saleItemSchema.
import type { SaleItem } from "./saleItemSchema.js";

// How the customer paid
export const PAYMENT_METHODS = ["CASH", "CARD", "TRANSFER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

// A sale is never deleted, only moved along this list by a return
export const SALE_STATUSES = ["COMPLETED", "PARTIALLY_RETURNED", "REVERSED"] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];

// This is the attributes for the Sale model
export interface SaleAttributes {
    id: string;
    receiptNumber: string;
    terminalId: string;
    terminalName: string;
    cashierId: string;
    cashierName: string;
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: PaymentMethod;
    amountReceived: number | null;
    changeGiven: number | null;
    status: SaleStatus;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Sale model
export interface SaleCreationAttributes
    extends Optional<
        SaleAttributes,
        "id" | "discount" | "amountReceived" | "changeGiven" | "status" | "createdAt" | "updatedAt"
    > {}

// This is the model for the Sale model
export class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
    declare id: string;
    declare receiptNumber: string;
    declare terminalId: string;
    declare terminalName: string;
    declare cashierId: string;
    declare cashierName: string;
    declare subtotal: number;
    declare discount: number;
    declare total: number;
    declare paymentMethod: PaymentMethod;
    declare amountReceived: number | null;
    declare changeGiven: number | null;
    declare status: SaleStatus;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare items?: SaleItem[];
}

// This is the schema for the Sale model
export const SaleSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    receiptNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    terminalId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    terminalName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    cashierId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    cashierName: {
        // Denormalised: a receipt reprinted next year should still name the
        // person who served the customer, whatever happened to the account.
        type: DataTypes.STRING,
        allowNull: false,
    },
    subtotal: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    discount: {
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
    },
    total: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    paymentMethod: {
        type: DataTypes.ENUM(...PAYMENT_METHODS),
        allowNull: false,
    },
    amountReceived: {
        // Cash only; card and transfer are paid to the exact total.
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
    },
    changeGiven: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
    },
    status: {
        type: DataTypes.ENUM(...SALE_STATUSES),
        allowNull: false,
        defaultValue: "COMPLETED",
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
Sale.init(SaleSchema, {
    sequelize,
    modelName: "Sale",
    tableName: "sales",
    indexes: [{ fields: ["createdAt"] }, { fields: ["cashierId"] }, { fields: ["status"] }],
});

export { Sale as default };
