import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";

// This is the attributes for the Category model
export interface CategoryAttributes {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Category model
export interface CategoryCreationAttributes
    extends Optional<CategoryAttributes, "id" | "description" | "createdAt" | "updatedAt"> {}

// This is the model for the Category model
export class Category extends Model<CategoryAttributes, CategoryCreationAttributes> implements CategoryAttributes {
    declare id: string;
    declare name: string;
    declare description: string | null;
    declare createdAt: Date;
    declare updatedAt: Date;
}

// This is the schema for the Category model
export const CategorySchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    description: {
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
Category.init(CategorySchema, {
    sequelize,
    modelName: "Category",
    tableName: "categories",
});

export { Category as default };
