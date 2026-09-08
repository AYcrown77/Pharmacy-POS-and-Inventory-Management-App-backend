import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
// Type-only, so this does not create a runtime cycle with saleItemSchema.
import type { SaleItem } from "./saleItemSchema.js";
import { PRICE_TIERS, PriceTier } from "../products/productSchema.js";

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
    customerId: string | null;
    customerName: string | null;
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: PaymentMethod;
    priceTier: PriceTier;
    amountReceived: number | null;
    changeGiven: number | null;
    status: SaleStatus;
    debtCharged: number;
    debtRepaid: number;
    customerBalanceAfter: number | null;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Sale model
export interface SaleCreationAttributes
    extends Optional<
        SaleAttributes,
        "id" | "discount" | "priceTier" | "customerId" | "customerName" | "debtCharged" | "debtRepaid" | "customerBalanceAfter" | "amountReceived" | "changeGiven" | "status" | "createdAt" | "updatedAt"
    > {}

// This is the model for the Sale model
export class Sale extends Model<SaleAttributes, SaleCreationAttributes> implements SaleAttributes {
    declare id: string;
    declare receiptNumber: string;
    declare terminalId: string;
    declare terminalName: string;
    declare cashierId: string;
    declare cashierName: string;
    declare customerId: string | null;
    declare customerName: string | null;
    declare subtotal: number;
    declare discount: number;
    declare total: number;
    declare paymentMethod: PaymentMethod;
    declare priceTier: PriceTier;
    declare amountReceived: number | null;
    declare changeGiven: number | null;
    declare status: SaleStatus;
    declare debtCharged: number;
    declare debtRepaid: number;
    declare customerBalanceAfter: number | null;
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
    customerId: {
        // Null for a walk-in, which is most sales. Only a named account can
        // carry a balance.
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
    },
    customerName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
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
    priceTier: {
        // Which of the three prices this sale was rung up at. Stored on the
        // sale, not inferred from the amounts, so a later price edit cannot
        // change what an old receipt appears to have charged.
        type: DataTypes.ENUM(...PRICE_TIERS),
        allowNull: false,
        defaultValue: "CONSUMER",
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
    debtCharged: {
        // What this sale added to the customer's debt, because they took goods
        // without paying in full.
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
    },
    debtRepaid: {
        // What an overpayment took off an existing balance.
        type: DataTypes.BIGINT,
        allowNull: false,
        defaultValue: 0,
    },
    customerBalanceAfter: {
        // The balance as it stood when the receipt printed. Stored rather than
        // read live, so reprinting an old receipt shows what the customer was
        // actually told at the time.
        type: DataTypes.BIGINT,
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
Sale.init(SaleSchema, {
    sequelize,
    modelName: "Sale",
    tableName: "sales",
    indexes: [{ fields: ["createdAt"] }, { fields: ["cashierId"] }, { fields: ["status"] }],
});

export { Sale as default };
