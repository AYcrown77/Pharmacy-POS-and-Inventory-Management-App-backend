import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import Sale from "./saleSchema.js";

// This is the attributes for the SaleItem model
export interface SaleItemAttributes {
    id: string;
    saleId: string;
    productId: string;
    productName: string;
    batchId: string;
    batchNumber: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    returnedQuantity: number;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the SaleItem model
export interface SaleItemCreationAttributes
    extends Optional<SaleItemAttributes, "id" | "returnedQuantity" | "createdAt" | "updatedAt"> {}

// This is the model for the SaleItem model
export class SaleItem extends Model<SaleItemAttributes, SaleItemCreationAttributes> implements SaleItemAttributes {
    declare id: string;
    declare saleId: string;
    declare productId: string;
    declare productName: string;
    declare batchId: string;
    declare batchNumber: string;
    declare quantity: number;
    declare unitPrice: number;
    declare subtotal: number;
    declare returnedQuantity: number;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the SaleItem model
export const SaleItemSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    saleId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "sales", key: "id" },
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
        // One row per batch consumed. A cart line for 10 units that FEFO takes
        // from two batches is stored as two rows, because the batch a customer
        // was given is the thing a recall or a return has to know.
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
        // Captured at the time of sale. Repricing the product later must not
        // change what this receipt says was charged.
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    subtotal: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    returnedQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
SaleItem.init(SaleItemSchema, {
    sequelize,
    modelName: "SaleItem",
    tableName: "sale_items",
    indexes: [{ fields: ["saleId"] }, { fields: ["productId"] }],
});

SaleItem.belongsTo(Sale, { foreignKey: "saleId", as: "sale" });
Sale.hasMany(SaleItem, { foreignKey: "saleId", as: "items" });

export { SaleItem as default };
