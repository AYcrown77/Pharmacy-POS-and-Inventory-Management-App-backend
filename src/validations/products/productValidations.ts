import { DOSAGE_FORMS, UNIT_TYPES } from "../../schemas/products/productSchema.js";

export const productValidation = {
    name: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Product name is required',
        },
        isLength: {
            options: { max: 160 },
            errorMessage: 'Product name is too long',
        },
    },
    genericName: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid generic name',
    },
    brandName: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid brand name',
    },
    barcode: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid barcode',
    },
    categoryId: {
        in: 'body',
        isUUID: true,
        errorMessage: 'A category must be selected',
    },
    strength: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid strength',
    },
    dosageForm: {
        in: 'body',
        optional: { options: { nullable: true } },
        isIn: {
            options: [DOSAGE_FORMS],
            errorMessage: 'Unknown dosage form',
        },
    },
    priceWholesale: {
        // Kobo, so a whole number. A price arriving as 1500.5 would mean half
        // a kobo, which cannot be charged or given as change.
        in: 'body',
        isInt: {
            options: { min: 0 },
            errorMessage: 'Wholesale price must be a whole number of kobo',
        },
        toInt: true,
    },
    priceRetail: {
        in: 'body',
        isInt: {
            options: { min: 0 },
            errorMessage: 'Retail price must be a whole number of kobo',
        },
        toInt: true,
    },
    priceConsumer: {
        in: 'body',
        isInt: {
            options: { min: 0 },
            errorMessage: 'Consumer price must be a whole number of kobo',
        },
        toInt: true,
    },
    unitsPerPack: {
        // 1 means the product is not broken down at all.
        in: 'body',
        optional: true,
        isInt: {
            options: { min: 1, max: 10000 },
            errorMessage: 'Units per pack must be at least 1',
        },
        toInt: true,
    },
    minimumStockLevel: {
        in: 'body',
        isInt: {
            options: { min: 0 },
            errorMessage: 'Minimum stock level must be zero or more',
        },
        toInt: true,
    },
    unitType: {
        in: 'body',
        isIn: {
            options: [UNIT_TYPES],
            errorMessage: 'Unknown unit type',
        },
    },
    isActive: {
        in: 'body',
        optional: true,
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'Invalid active flag',
    },
};

export const categoryValidation = {
    name: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Category name is required',
        },
        isLength: {
            options: { max: 80 },
            errorMessage: 'Category name is too long',
        },
    },
    description: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid description',
    },
};
