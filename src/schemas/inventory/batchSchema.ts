import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import Product from "../products/productSchema.js";

// This is the attributes for the Batch model
export interface BatchAttributes {
    id: string;
    productId: string;
    batchNumber: string;
    expiryDate: string;
    quantityReceived: number;
    quantityRemaining: number;
    costPrice: number;
    sellingPrice: number;
    supplierName: string | null;
    receivedAt: Date;
    receivedBy: string;
    receivedByName: string;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Batch model
export interface BatchCreationAttributes
    extends Optional<BatchAttributes, "id" | "supplierName" | "createdAt" | "updatedAt"> {}

// This is the model for the Batch model
export class Batch extends Model<BatchAttributes, BatchCreationAttributes> implements BatchAttributes {
    declare id: string;
    declare productId: string;
    declare batchNumber: string;
    declare expiryDate: string;
    declare quantityReceived: number;
    declare quantityRemaining: number;
    declare costPrice: number;
    declare sellingPrice: number;
    declare supplierName: string | null;
    declare receivedAt: Date;
    declare receivedBy: string;
    declare receivedByName: string;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare product?: Product;
}

// This is the schema for the Batch model
export const BatchSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    productId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "products", key: "id" },
    },
    batchNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    expiryDate: {
        // DATEONLY, not DATE. An expiry is a calendar day, and putting it
        // through a timestamp lets a timezone shift it by one — which would
        // mark a batch expired a day early, or sell one a day late.
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    quantityReceived: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    quantityRemaining: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    costPrice: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    sellingPrice: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    supplierName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    receivedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
    },
    receivedBy: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    receivedByName: {
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
Batch.init(BatchSchema, {
    sequelize,
    modelName: "Batch",
    tableName: "batches",
    indexes: [
        // FEFO reads this constantly: every sale asks for a product's batches
        // in expiry order.
        { fields: ["productId", "expiryDate"] },
        { fields: ["batchNumber"] },
    ],
});

Batch.belongsTo(Product, { foreignKey: "productId", as: "product" });
Product.hasMany(Batch, { foreignKey: "productId", as: "batches" });

export { Batch as default };
