import { ExpiryStatus, StockStatus } from "../../utils/stock.js";
import { MovementType } from "../../schemas/inventory/stockMovementSchema.js";
import { ProductListItem } from "../products/product.js";
import { BaseResponse } from "../users/auth.js";

export interface InventoryListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    categoryId?: string;
    stockStatus?: StockStatus;
    expiryStatus?: ExpiryStatus;
}

export interface BatchListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    productId?: string;
    categoryId?: string;
    expiryStatus?: ExpiryStatus;
    supplierName?: string;
    onlyInStock?: string;
}

export interface MovementListQuery {
    page?: string;
    pageSize?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    productId?: string;
    batchId?: string;
    movementType?: MovementType;
    userId?: string;
    from?: string;
    to?: string;
}

/** Product-level stock, aggregated across batches. */
export interface InventoryItem {
    productId: string;
    product: ProductListItem;
    availableStock: number;
    minimumStockLevel: number;
    batchCount: number;
    nearestExpiry: string | null;
    stockStatus: StockStatus;
    expiryStatus: ExpiryStatus | null;
    stockValue: number;
    lastReceivedAt: Date | null;
}

export interface InventorySummary {
    totalProducts: number;
    totalStockUnits: number;
    inventoryValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    expiringSoonCount: number;
    expiredCount: number;
}

export interface LowStockItem {
    productId: string;
    productName: string;
    categoryName: string | null;
    availableStock: number;
    minimumStockLevel: number;
    shortfall: number;
    stockStatus: StockStatus;
    lastReceivedAt: Date | null;
}

export interface ExpiryAlertItem {
    batchId: string;
    productId: string;
    productName: string;
    batchNumber: string;
    quantityRemaining: number;
    expiryDate: string;
    daysUntilExpiry: number;
    expiryStatus: ExpiryStatus;
    stockValue: number;
}

export type ExpirySummary = Record<ExpiryStatus, number>;

export interface RecentMovementSummary {
    id: string;
    productName: string;
    batchNumber: string | null;
    movementType: MovementType;
    quantity: number;
    userName: string;
    createdAt: Date;
}

export type InventoryResponse = BaseResponse;
