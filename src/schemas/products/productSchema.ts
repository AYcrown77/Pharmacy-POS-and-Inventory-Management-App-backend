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

/**
 * The three prices a product carries.
 *
 * A pharmacy sells the same pack to a walk-in customer, a corner shop and a
 * distributor at three different prices. Storing one price and discounting at
 * the till would leave no record of *which* price was meant, so each is its
 * own column and the sale records the tier it used.
 */
export const PRICE_TIERS = ["WHOLESALE", "RETAIL", "CONSUMER"] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];

/** The tier the till starts on — the walk-in price, which is most sales. */
export const DEFAULT_PRICE_TIER: PriceTier = "CONSUMER";

/**
 * Which unit a tier trades in.
 *
 * A walk-in buys one sachet; a shop or a distributor buys the pack it came in.
 * So the tier decides both the price and what a "quantity of 1" means, and the
 * two can never disagree — which they would if the unit were a separate choice
 * the cashier had to keep in step with the price list.
 *
 * Stock itself is always counted in the smallest unit. A pack sale deducts
 * `unitsPerPack` of them, so there is one honest number for what is on the
 * shelf however it was sold.
 */
export const TIER_SELLS_PACKS: Record<PriceTier, boolean> = {
    WHOLESALE: true,
    RETAIL: true,
    CONSUMER: false,
};

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
    priceWholesale: number;
    priceRetail: number;
    priceConsumer: number;
    unitsPerPack: number;
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
    declare priceWholesale: number;
    declare priceRetail: number;
    declare priceConsumer: number;
    declare unitsPerPack: number;
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
    priceWholesale: {
        // Money is an integer number of kobo, never a float. A DECIMAL would
        // also be exact but would arrive as a string and invite arithmetic on
        // strings; kobo integers cannot drift and add correctly as they are.
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    priceRetail: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    priceConsumer: {
        type: DataTypes.BIGINT,
        allowNull: false,
    },
    unitsPerPack: {
        // How many of the smallest unit make up one pack. 1 means the product
        // is not broken down at all — an inhaler, a bottle — and pack and
        // sachet are then the same thing, which keeps every existing product
        // working untouched.
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
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

/**
 * The price for one tier.
 *
 * Every place that charges money goes through here, so a new tier is a change
 * in one function rather than a hunt for `product.priceRetail` across the
 * codebase.
 */
export interface TierPricing {
    /** Price of one selling unit, in kobo. */
    unitPrice: number;
    /** Base units consumed per selling unit — the pack size, or 1. */
    baseUnits: number;
    sellsPacks: boolean;
}

/**
 * What one unit costs and consumes at a given tier.
 *
 * Every place that charges or deducts goes through here, so the price and the
 * stock movement can never be computed from different assumptions about what
 * was actually sold.
 */
export const pricingForTier = (product: Product, tier: PriceTier): TierPricing => {
    const sellsPacks = TIER_SELLS_PACKS[tier];
    return {
        unitPrice: priceForTier(product, tier),
        baseUnits: sellsPacks ? Math.max(product.unitsPerPack, 1) : 1,
        sellsPacks,
    };
};

export const priceForTier = (product: Product, tier: PriceTier): number => {
    switch (tier) {
        case "WHOLESALE":
            return product.priceWholesale;
        case "RETAIL":
            return product.priceRetail;
        default:
            return product.priceConsumer;
    }
};

export { Product as default };
