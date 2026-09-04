import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// How stock can enter or leave
export const MOVEMENT_TYPES = [
    "STOCK_RECEIVED",
    "SALE",
    "RETURN",
    "DAMAGE",
    "EXPIRY",
    "ADJUSTMENT",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

// This is the attributes for the StockMovement model
export interface StockMovementAttributes {
    id: string;
    productId: string;
    productName: string;
    batchId: string | null;
    batchNumber: string | null;
    movementType: MovementType;
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    referenceType: string | null;
    referenceId: string | null;
    userId: string;
    userName: string;
    reason: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the StockMovement model
export interface StockMovementCreationAttributes
    extends Optional<
        StockMovementAttributes,
        | "id"
        | "batchId"
        | "batchNumber"
        | "referenceType"
        | "referenceId"
        | "reason"
        | "createdAt"
        | "updatedAt"
    > {}

// This is the model for the StockMovement model
export class StockMovement
    extends Model<StockMovementAttributes, StockMovementCreationAttributes>
    implements StockMovementAttributes
{
    declare id: string;
    declare productId: string;
    declare productName: string;
    declare batchId: string | null;
    declare batchNumber: string | null;
    declare movementType: MovementType;
    declare quantity: number;
    declare previousQuantity: number;
    declare newQuantity: number;
    declare referenceType: string | null;
    declare referenceId: string | null;
    declare userId: string;
    declare userName: string;
    declare reason: string | null;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the StockMovement model
export const StockMovementSchema = {
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
        // Denormalised so the ledger still reads correctly years later, even
        // if the product is renamed.
        type: DataTypes.STRING,
        allowNull: false,
    },
    batchId: {
        type: DataTypes.UUID,
        allowNull: true,
        defaultValue: null,
    },
    batchNumber: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    movementType: {
        type: DataTypes.ENUM(...MOVEMENT_TYPES),
        allowNull: false,
    },
    quantity: {
        // Signed: positive adds stock, negative removes it.
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    previousQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    newQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    referenceType: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    referenceId: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    userId: {
        type: DataTypes.UUID,
        allowNull: false,
    },
    userName: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    reason: {
        type: DataTypes.STRING,
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
StockMovement.init(StockMovementSchema, {
    sequelize,
    modelName: "StockMovement",
    tableName: "stock_movements",
    indexes: [
        { fields: ["createdAt"] },
        { fields: ["productId"] },
        { fields: ["movementType"] },
    ],
});

export { StockMovement as default };
