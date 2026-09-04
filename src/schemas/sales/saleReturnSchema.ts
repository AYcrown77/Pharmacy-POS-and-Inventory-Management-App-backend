import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import Sale, { PAYMENT_METHODS, PaymentMethod } from "./saleSchema.js";
import type { SaleReturnItem } from "./saleReturnItemSchema.js";

// This is the attributes for the SaleReturn model
export interface SaleReturnAttributes {
    id: string;
    saleId: string;
    receiptNumber: string;
    refundAmount: number;
    refundMethod: PaymentMethod;
    reason: string;
    processedBy: string;
    processedByName: string;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the SaleReturn model
export interface SaleReturnCreationAttributes
    extends Optional<SaleReturnAttributes, "id" | "createdAt" | "updatedAt"> {}

// This is the model for the SaleReturn model
export class SaleReturn
    extends Model<SaleReturnAttributes, SaleReturnCreationAttributes>
    implements SaleReturnAttributes
{
    declare id: string;
    declare saleId: string;
    declare receiptNumber: string;
    declare refundAmount: number;
    declare refundMethod: PaymentMethod;
    declare reason: string;
    declare processedBy: string;
    declare processedByName: string;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare items?: SaleReturnItem[];
    declare sale?: Sale;
}

// This is the schema for the SaleReturn model
export const SaleReturnSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    saleId: {
        // A return always references a sale. There is no such thing here as an
        // unattached refund.
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "sales", key: "id" },
    },
    receiptNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    refundAmount: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    refundMethod: {
        type: DataTypes.ENUM(...PAYMENT_METHODS),
        allowNull: false,
    },
    reason: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    processedBy: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    processedByName: {
        type: DataTypes.STRING,
        allowNull: false,
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
SaleReturn.init(SaleReturnSchema, {
    sequelize,
    modelName: "SaleReturn",
    tableName: "sale_returns",
    indexes: [{ fields: ["saleId"] }, { fields: ["createdAt"] }],
});

SaleReturn.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });
Sale.hasMany(SaleReturn, { foreignKey: "saleId", as: "returns" });

export { SaleReturn as default };
