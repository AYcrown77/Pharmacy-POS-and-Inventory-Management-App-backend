import { DosageForm, UnitType } from "../../schemas/products/productSchema.js";
import { StockStatus } from "../../utils/stock.js";
import { CategoryAttributes } from "../../schemas/products/categorySchema.js";
import { BaseResponse } from "../users/auth.js";

export interface ProductInput {
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
}

/**
 * A product as the frontend reads it: the catalogue row plus the stock
 * figures derived from its batches, so a list needs one round trip.
 */
export interface ProductListItem {
    id: string;
    name: string;
    genericName: string | null;
    brandName: string | null;
    barcode: string | null;
    categoryId: string;
    category: CategoryAttributes | null;
    strength: string | null;
    dosageForm: DosageForm | null;
    sellingPrice: number;
    minimumStockLevel: number;
    unitType: UnitType;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    availableStock: number;
    stockStatus: StockStatus;
}

export interface ProductListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    categoryId?: string;
    stockStatus?: StockStatus;
    isActive?: string;
}

/** The batch a sale would draw from, for display at the till. */
export interface SellableBatch {
    batchId: string;
    batchNumber: string;
    expiryDate: string;
    quantityRemaining: number;
}

export interface CategoryInput {
    name: string;
    description: string | null;
}

export type ProductResponse = BaseResponse;

export type CategoryResponse = BaseResponse;
