import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// Why stock was adjusted away from what the system believed
export const ADJUSTMENT_REASONS = [
    "EXPIRED",
    "DAMAGED",
    "MISSING",
    "COUNT_CORRECTION",
    "RETURNED_TO_SUPPLIER",
    "OTHER",
] as const;
export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

// This is the attributes for the StockAdjustment model
export interface StockAdjustmentAttributes {
    id: string;
    productId: string;
    productName: string;
    batchId: string;
    batchNumber: string;
    quantityBefore: number;
    adjustment: number;
    quantityAfter: number;
    reason: AdjustmentReason;
    notes: string | null;
    performedBy: string;
    performedByName: string;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the StockAdjustment model
export interface StockAdjustmentCreationAttributes
    extends Optional<StockAdjustmentAttributes, "id" | "notes" | "createdAt" | "updatedAt"> {}

// This is the model for the StockAdjustment model
export class StockAdjustment
    extends Model<StockAdjustmentAttributes, StockAdjustmentCreationAttributes>
    implements StockAdjustmentAttributes
{
    declare id: string;
    declare productId: string;
    declare productName: string;
    declare batchId: string;
    declare batchNumber: string;
    declare quantityBefore: number;
    declare adjustment: number;
    declare quantityAfter: number;
    declare reason: AdjustmentReason;
    declare notes: string | null;
    declare performedBy: string;
    declare performedByName: string;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the StockAdjustment model
export const StockAdjustmentSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
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
        type: DataTypes.UUID,
        allowNull: false,
    },
    batchNumber: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    quantityBefore: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    adjustment: {
        // Signed. A stocktake correction can go either way; expiry and damage
        // are always negative.
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    quantityAfter: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    reason: {
        type: DataTypes.ENUM(...ADJUSTMENT_REASONS),
        allowNull: false,
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
    },
    performedBy: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    performedByName: {
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
StockAdjustment.init(StockAdjustmentSchema, {
    sequelize,
    modelName: "StockAdjustment",
    tableName: "stock_adjustments",
    indexes: [{ fields: ["createdAt"] }, { fields: ["productId"] }],
});

export { StockAdjustment as default };
