import { Op } from "sequelize";
import Product from "../../schemas/products/productSchema.js";
import Category from "../../schemas/products/categorySchema.js";
import Batch from "../../schemas/inventory/batchSchema.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import { deriveStockStatus, expiryStatusFor, ExpiryStatus } from "../../utils/stock.js";
import { daysUntil, today } from "../../utils/date.js";
import { INTERNAL_SERVER_ERROR, SUCCESS } from "../../constants/statusCode.js";
import {
    ExpiryAlertItem,
    ExpirySummary,
    InventoryItem,
    InventoryListQuery,
    InventoryResponse,
    InventorySummary,
    LowStockItem,
} from "../../types/inventory/inventory.js";
import { ProductListItem } from "../../types/products/product.js";
import { CategoryAttributes } from "../../schemas/products/categorySchema.js";

/**
 * Inventory is entirely derived.
 *
 * There is no stock column anywhere — every figure on these screens is
 * recomputed from the batch table on each request. That is deliberate: a
 * cached total is a total that can be wrong, and a pharmacy counting units of
 * medicine cannot afford a stale number that nobody notices.
 *
 * The catalogue is a few hundred products, so the aggregation happens here in
 * one pass rather than in a query per product.
 */

const toProductItem = (product: Product, available: number): ProductListItem => ({
    id: product.id,
    name: product.name,
    genericName: product.genericName,
    brandName: product.brandName,
    barcode: product.barcode,
    categoryId: product.categoryId,
    category: product.category ? (product.category.toJSON() as CategoryAttributes) : null,
    strength: product.strength,
    dosageForm: product.dosageForm,
    sellingPrice: product.sellingPrice,
    minimumStockLevel: product.minimumStockLevel,
    unitType: product.unitType,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    availableStock: available,
    stockStatus: deriveStockStatus(available, product.minimumStockLevel),
});

/**
 * Builds every product's inventory row in two queries.
 *
 * Batches are grouped by product in memory because the same set is needed for
 * the value, the batch count, the nearest expiry and the last received date —
 * four aggregates that would otherwise be four separate GROUP BY queries.
 */
const buildInventoryItems = async (): Promise<InventoryItem[]> => {
    const asOf = today();

    const [products, batches] = await Promise.all([
        Product.findAll({ where: { isActive: true }, include: [{ model: Category, as: "category" }] }),
        Batch.findAll(),
    ]);

    const byProduct = new Map<string, Batch[]>();
    for (const batch of batches) {
        const list = byProduct.get(batch.productId);
        if (list) list.push(batch);
        else byProduct.set(batch.productId, [batch]);
    }

    return products.map((product) => {
        const all = byProduct.get(product.id) ?? [];

        // Expired units are on the shelf but cannot be sold, so they count
        // towards neither availability nor stock value.
        const sellable = all
            .filter((batch) => batch.quantityRemaining > 0 && batch.expiryDate >= asOf)
            .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

        const available = sellable.reduce((total, batch) => total + batch.quantityRemaining, 0);
        const stockValue = sellable.reduce(
            (total, batch) => total + batch.quantityRemaining * batch.costPrice,
            0
        );

        const nearest = sellable[0] ?? null;
        const lastReceived = all.reduce<Date | null>(
            (latest, batch) =>
                !latest || batch.receivedAt > latest ? batch.receivedAt : latest,
            null
        );

        return {
            productId: product.id,
            product: toProductItem(product, available),
            availableStock: available,
            minimumStockLevel: product.minimumStockLevel,
            batchCount: sellable.length,
            nearestExpiry: nearest?.expiryDate ?? null,
            stockStatus: deriveStockStatus(available, product.minimumStockLevel),
            expiryStatus: nearest ? expiryStatusFor(nearest.expiryDate) : null,
            stockValue,
            lastReceivedAt: lastReceived,
        };
    });
};

export const listInventoryService = async (
    query: InventoryListQuery,
    callback: (data: InventoryResponse) => void
) => {
    try {
        const { page, pageSize } = resolvePaging(query);

        let items = await buildInventoryItems();

        const search = query.search?.trim().toLowerCase();
        if (search) {
            items = items.filter((item) =>
                [
                    item.product.name,
                    item.product.genericName,
                    item.product.brandName,
                    item.product.barcode,
                ].some((field) => field?.toLowerCase().includes(search))
            );
        }

        if (query.categoryId) {
            items = items.filter((item) => item.product.categoryId === query.categoryId);
        }
        if (query.stockStatus) {
            items = items.filter((item) => item.stockStatus === query.stockStatus);
        }
        if (query.expiryStatus) {
            items = items.filter((item) => item.expiryStatus === query.expiryStatus);
        }

        const direction = query.sortDir === "desc" ? -1 : 1;

        const pick = (item: InventoryItem): string | number => {
            switch (query.sortBy) {
                case "availableStock":
                    return item.availableStock;
                case "stockValue":
                    return item.stockValue;
                case "batchCount":
                    return item.batchCount;
                case "nearestExpiry":
                    // Products with no expiry sort last either way, rather than
                    // ahead of everything because an empty string is smallest.
                    return item.nearestExpiry ?? "9999-12-31";
                case "category":
                    return item.product.category?.name ?? "";
                default:
                    return item.product.name.toLowerCase();
            }
        };

        items.sort((a, b) => {
            const left = pick(a);
            const right = pick(b);
            if (left === right) return 0;
            return (left < right ? -1 : 1) * direction;
        });

        const start = (page - 1) * pageSize;

        return callback(
            messageHandler(
                "Inventory retrieved",
                true,
                SUCCESS,
                buildPaginated(items.slice(start, start + pageSize), items.length, page, pageSize)
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading inventory.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/** Shared with the dashboard, which reports the same figures alongside sales. */
export const buildInventorySummary = async (): Promise<InventorySummary> => {
    const items = await buildInventoryItems();
    const asOf = today();

    const batches = await Batch.findAll({ where: { quantityRemaining: { [Op.gt]: 0 } } });

    let expiringSoonCount = 0;
    let expiredCount = 0;

    for (const batch of batches) {
        if (batch.expiryDate < asOf) expiredCount += 1;
        else if (daysUntil(batch.expiryDate) <= 90) expiringSoonCount += 1;
    }

    return {
        totalProducts: items.length,
        totalStockUnits: items.reduce((total, item) => total + item.availableStock, 0),
        inventoryValue: items.reduce((total, item) => total + item.stockValue, 0),
        lowStockCount: items.filter((item) => item.stockStatus === "LOW_STOCK").length,
        outOfStockCount: items.filter((item) => item.stockStatus === "OUT_OF_STOCK").length,
        expiringSoonCount,
        expiredCount,
    };
};

export const getInventorySummaryService = async (callback: (data: InventoryResponse) => void) => {
    try {
        const summary = await buildInventorySummary();

        return callback(messageHandler("Inventory summary retrieved", true, SUCCESS, summary));
    } catch (error) {
        return callback(
            messageHandler("An error occured while summarising inventory.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getLowStockService = async (
    limit: number | null,
    callback: (data: InventoryResponse) => void
) => {
    try {
        const items = await buildInventoryItems();

        const lowStock: LowStockItem[] = items
            .filter((item) => item.stockStatus !== "IN_STOCK")
            .map((item) => ({
                productId: item.productId,
                productName: item.product.name,
                categoryName: item.product.category?.name ?? null,
                availableStock: item.availableStock,
                minimumStockLevel: item.minimumStockLevel,
                shortfall: Math.max(item.minimumStockLevel - item.availableStock, 0),
                stockStatus: item.stockStatus,
                lastReceivedAt: item.lastReceivedAt,
            }))
            // Out of stock first, then whoever is furthest below their minimum.
            .sort(
                (a, b) =>
                    a.availableStock - b.availableStock || b.shortfall - a.shortfall
            );

        return callback(
            messageHandler(
                "Low stock retrieved",
                true,
                SUCCESS,
                limit ? lowStock.slice(0, limit) : lowStock
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading low stock.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/** Batches that still hold stock, as the expiry screens present them. */
const buildExpiryAlerts = async (): Promise<ExpiryAlertItem[]> => {
    const batches = await Batch.findAll({
        where: { quantityRemaining: { [Op.gt]: 0 } },
        include: [{ model: Product, as: "product" }],
        order: [["expiryDate", "ASC"]],
    });

    return batches.map((batch) => {
        const days = daysUntil(batch.expiryDate);
        return {
            batchId: batch.id,
            productId: batch.productId,
            productName: batch.product?.name ?? "Unknown product",
            batchNumber: batch.batchNumber,
            quantityRemaining: batch.quantityRemaining,
            expiryDate: batch.expiryDate,
            daysUntilExpiry: days,
            expiryStatus: expiryStatusFor(batch.expiryDate),
            stockValue: batch.quantityRemaining * batch.costPrice,
        };
    });
};

export const getExpiryAlertsService = async (
    limit: number | null,
    callback: (data: InventoryResponse) => void
) => {
    try {
        const alerts = await buildExpiryAlerts();

        // Only what actually needs acting on: anything inside the 90-day
        // window, or already gone.
        const actionable = alerts.filter((alert) => alert.expiryStatus !== "HEALTHY");

        return callback(
            messageHandler(
                "Expiry alerts retrieved",
                true,
                SUCCESS,
                limit ? actionable.slice(0, limit) : actionable
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading expiry alerts.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const listExpiringService = async (
    query: InventoryListQuery & { productId?: string },
    callback: (data: InventoryResponse) => void
) => {
    try {
        const { page, pageSize } = resolvePaging(query);

        let alerts = await buildExpiryAlerts();

        const search = query.search?.trim().toLowerCase();
        if (search) {
            alerts = alerts.filter(
                (alert) =>
                    alert.productName.toLowerCase().includes(search) ||
                    alert.batchNumber.toLowerCase().includes(search)
            );
        }

        if (query.expiryStatus) {
            alerts = alerts.filter((alert) => alert.expiryStatus === query.expiryStatus);
        }
        if (query.productId) {
            alerts = alerts.filter((alert) => alert.productId === query.productId);
        }

        const direction = query.sortDir === "desc" ? -1 : 1;

        const pick = (alert: ExpiryAlertItem): string | number => {
            switch (query.sortBy) {
                case "productName":
                    return alert.productName.toLowerCase();
                case "quantityRemaining":
                    return alert.quantityRemaining;
                case "stockValue":
                    return alert.stockValue;
                default:
                    return alert.expiryDate;
            }
        };

        alerts.sort((a, b) => {
            const left = pick(a);
            const right = pick(b);
            if (left === right) return 0;
            return (left < right ? -1 : 1) * direction;
        });

        const start = (page - 1) * pageSize;

        return callback(
            messageHandler(
                "Expiring stock retrieved",
                true,
                SUCCESS,
                buildPaginated(alerts.slice(start, start + pageSize), alerts.length, page, pageSize)
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading expiring stock.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getExpirySummaryService = async (callback: (data: InventoryResponse) => void) => {
    try {
        const alerts = await buildExpiryAlerts();

        const summary: ExpirySummary = {
            EXPIRED: 0,
            CRITICAL_30: 0,
            WARNING_60: 0,
            NOTICE_90: 0,
            HEALTHY: 0,
        };

        for (const alert of alerts) {
            summary[alert.expiryStatus as ExpiryStatus] += 1;
        }

        return callback(messageHandler("Expiry summary retrieved", true, SUCCESS, summary));
    } catch (error) {
        return callback(
            messageHandler("An error occured while summarising expiry.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
