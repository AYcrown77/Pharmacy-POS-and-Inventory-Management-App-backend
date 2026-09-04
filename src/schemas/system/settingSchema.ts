import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// This is the attributes for the Setting model
export interface SettingAttributes {
    id: number;
    name: string;
    address: string;
    phone: string;
    receiptFooter: string;
    showLogoOnReceipt: boolean;
    currency: string;
    lowStockAlertsEnabled: boolean;
    expiryAlertDays: number;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Setting model
export interface SettingCreationAttributes
    extends Optional<SettingAttributes, "id" | "createdAt" | "updatedAt"> {}

// This is the model for the Setting model
export class Setting extends Model<SettingAttributes, SettingCreationAttributes> implements SettingAttributes {
    declare id: number;
    declare name: string;
    declare address: string;
    declare phone: string;
    declare receiptFooter: string;
    declare showLogoOnReceipt: boolean;
    declare currency: string;
    declare lowStockAlertsEnabled: boolean;
    declare expiryAlertDays: number;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the Setting model
export const SettingSchema = {
    id: {
        // One pharmacy, one row. The seed pins the id to 1 so the settings
        // can be read and written without a lookup.
        type: DataTypes.INTEGER,
        primaryKey: true,
        defaultValue: 1,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    receiptFooter: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "Thank you for your patronage.",
    },
    showLogoOnReceipt: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    currency: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: "NGN",
    },
    lowStockAlertsEnabled: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    expiryAlertDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 90,
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
Setting.init(SettingSchema, {
    sequelize,
    modelName: "Setting",
    tableName: "settings",
});

export { Setting as default };
