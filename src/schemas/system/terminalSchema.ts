import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// The kinds of terminal on the pharmacy network
export const TERMINAL_TYPES = ["CHECKOUT", "DISPENSING", "ADMIN"] as const;
export type TerminalType = (typeof TERMINAL_TYPES)[number];

// This is the attributes for the Terminal model
export interface TerminalAttributes {
    id: string;
    name: string;
    location: string;
    type: TerminalType;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Terminal model
export interface TerminalCreationAttributes
    extends Optional<TerminalAttributes, "isActive" | "createdAt" | "updatedAt"> {}

// This is the model for the Terminal model
export class Terminal extends Model<TerminalAttributes, TerminalCreationAttributes> implements TerminalAttributes {
    declare id: string;
    declare name: string;
    declare location: string;
    declare type: TerminalType;
    declare isActive: boolean;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the Terminal model
export const TerminalSchema = {
    id: {
        // Not a UUID: a terminal is a physical machine with a fixed label
        // such as trm-01, which the browser stores and sends with every sale.
        type: DataTypes.STRING,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    type: {
        type: DataTypes.ENUM(...TERMINAL_TYPES),
        allowNull: false,
    },
    isActive: {
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
Terminal.init(TerminalSchema, {
    sequelize,
    modelName: "Terminal",
    tableName: "terminals",
});

export { Terminal as default };
