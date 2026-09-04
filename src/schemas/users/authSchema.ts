import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// The roles a member of staff can hold
export const ROLES = ["ADMINISTRATOR", "CASHIER"] as const;
export type Role = (typeof ROLES)[number];

// This is the attributes for the Auth model
export interface AuthAttributes {
    id: string;
    name: string;
    username: string;
    password: string;
    role: Role;
    isActive: boolean;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Auth model
export interface AuthCreationAttributes
    extends Optional<AuthAttributes, "id" | "isActive" | "lastLoginAt" | "createdAt" | "updatedAt"> {}

// This is the model for the Auth model
export class Auth extends Model<AuthAttributes, AuthCreationAttributes> implements AuthAttributes {
    declare id: string;
    declare name: string;
    declare username: string;
    declare password: string;
    declare role: Role;
    declare isActive: boolean;
    declare lastLoginAt: Date | null;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the Auth model
export const AuthSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    username: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    role: {
        type: DataTypes.ENUM(...ROLES),
        allowNull: false,
        defaultValue: "CASHIER",
    },
    isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
    lastLoginAt: {
        type: DataTypes.DATE,
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
Auth.init(AuthSchema, {
    sequelize,
    modelName: "Auth",
    tableName: "users",
    defaultScope: {
        // A password hash must never leave the database by accident.
        attributes: { exclude: ["password"] },
    },
    scopes: {
        // Opt in explicitly where the hash is genuinely needed, i.e. login.
        withPassword: { attributes: { include: ["password"] } },
    },
});

export { Auth as default };
