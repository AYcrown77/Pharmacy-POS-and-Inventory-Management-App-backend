import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import SaleReturn from "./saleReturnSchema.js";

// This is the attributes for the SaleReturnItem model
export interface SaleReturnItemAttributes {
    id: string;
    saleReturnId: string;
    saleItemId: string;
    productId: string;
    productName: string;
    batchId: string;
    batchNumber: string;
    quantity: number;
    unitPrice: number;
    refundAmount: number;
    restocked: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the SaleReturnItem model
export interface SaleReturnItemCreationAttributes
    extends Optional<SaleReturnItemAttributes, "id" | "restocked" | "createdAt" | "updatedAt"> {}

// This is the model for the SaleReturnItem model
export class SaleReturnItem
    extends Model<SaleReturnItemAttributes, SaleReturnItemCreationAttributes>
    implements SaleReturnItemAttributes
{
    declare id: string;
    declare saleReturnId: string;
    declare saleItemId: string;
    declare productId: string;
    declare productName: string;
    declare batchId: string;
    declare batchNumber: string;
    declare quantity: number;
    declare unitPrice: number;
    declare refundAmount: number;
    declare restocked: boolean;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the SaleReturnItem model
export const SaleReturnItemSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    saleReturnId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "sale_returns", key: "id" },
    },
    saleItemId: {
        // Points at the exact line being returned, which is what caps the
        // quantity at sold-minus-already-returned.
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "sale_items", key: "id" },
    },
    productId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    productName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    batchId: {
        // Stock goes back to the batch it came out of, not to whichever batch
        // happens to be nearest expiry now.
        type: DataTypes.UUID,
        allowNull: false,
    },
    batchNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    unitPrice: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    refundAmount: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    restocked: {
        // Goods returned in saleable condition go back on the shelf. Damaged
        // or expired ones are refunded but written off instead.
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
SaleReturnItem.init(SaleReturnItemSchema, {
    sequelize,
    modelName: "SaleReturnItem",
    tableName: "sale_return_items",
    indexes: [{ fields: ["saleReturnId"] }, { fields: ["saleItemId"] }],
});

SaleReturnItem.belongsTo(SaleReturn, { foreignKey: "saleReturnId", as: "saleReturn" });
SaleReturn.hasMany(SaleReturnItem, { foreignKey: "saleReturnId", as: "items" });

export { SaleReturnItem as default };
