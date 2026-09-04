import { DataTypes, Model, Optional } from "sequelize";
import sequelize from "../../database/db.js";
import Category from "./categorySchema.js";

// How a medicine is presented
export const DOSAGE_FORMS = [
    "TABLET",
    "CAPSULE",
    "SYRUP",
    "SUSPENSION",
    "INJECTION",
    "CREAM",
    "OINTMENT",
    "DROPS",
    "INHALER",
    "SUPPOSITORY",
    "POWDER",
] as const;
export type DosageForm = (typeof DOSAGE_FORMS)[number];

// What one unit of stock represents
export const UNIT_TYPES = [
    "PACK",
    "BOTTLE",
    "TABLET",
    "SACHET",
    "TUBE",
    "VIAL",
    "CARTON",
    "PIECE",
] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

// This is the attributes for the Product model
export interface ProductAttributes {
    id: string;
    name: string;
    genericName: string | null;
    brandName: string | null;
    barcode: string | null;
    categoryId: string;
    strength: string | null;
    dosageForm: DosageForm | null;
    sellingPrice: number;
    minimumStockLevel: number;
    unitType: UnitType;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

// This is the creation attributes for the Product model
export interface ProductCreationAttributes
    extends Optional<
        ProductAttributes,
        | "id"
        | "genericName"
        | "brandName"
        | "barcode"
        | "strength"
        | "dosageForm"
        | "isActive"
        | "createdAt"
        | "updatedAt"
    > {}

// This is the model for the Product model
export class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
    declare id: string;
    declare name: string;
    declare genericName: string | null;
    declare brandName: string | null;
    declare barcode: string | null;
    declare categoryId: string;
    declare strength: string | null;
    declare dosageForm: DosageForm | null;
    declare sellingPrice: number;
    declare minimumStockLevel: number;
    declare unitType: UnitType;
    declare isActive: boolean;
    declare createdAt: Date;
    declare updatedAt: Date;

    declare category?: Category;
}

// This is the schema for the Product model
export const ProductSchema = {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    genericName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    brandName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    barcode: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
        unique: true,
    },
    categoryId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: "categories", key: "id" },
    },
    strength: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
    },
    dosageForm: {
        type: DataTypes.ENUM(...DOSAGE_FORMS),
        allowNull: true,
        defaultValue: null,
    },
    sellingPrice: {
        // Money is an integer number of kobo, never a float. A DECIMAL would
        // also be exact but would arrive as a string and invite arithmetic on
        // strings; kobo integers cannot drift and add correctly as they are.
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    minimumStockLevel: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    unitType: {
        type: DataTypes.ENUM(...UNIT_TYPES),
        allowNull: false,
        defaultValue: "PACK",
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
Product.init(ProductSchema, {
    sequelize,
    modelName: "Product",
    tableName: "products",
});

Product.belongsTo(Category, { foreignKey: "categoryId", as: "category" });
Category.hasMany(Product, { foreignKey: "categoryId", as: "products" });

export { Product as default };
