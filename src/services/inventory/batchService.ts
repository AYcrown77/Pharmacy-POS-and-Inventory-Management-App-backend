import { Op } from "sequelize";
import Batch from "../../schemas/inventory/batchSchema.js";
import Product from "../../schemas/products/productSchema.js";
import Category from "../../schemas/products/categorySchema.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging, resolveSort } from "../../utils/pagination.js";
import { expiryStatusFor } from "../../utils/stock.js";
import { daysUntil } from "../../utils/date.js";
import { INTERNAL_SERVER_ERROR, SUCCESS } from "../../constants/statusCode.js";
import { BatchListQuery, InventoryResponse } from "../../types/inventory/inventory.js";

const PRODUCT_INCLUDE = [
    { model: Product, as: "product", include: [{ model: Category, as: "category" }] },
];

/**
 * Adds the two expiry fields the frontend never computes itself.
 *
 * The specification is explicit that expiry banding is the server's answer, so
 * that three terminals open at once cannot disagree about whether a batch is
 * "critical" — and so a machine with a wrong clock cannot quietly reclassify
 * the shelf.
 */
const withExpiry = (batch: Batch) => ({
    ...(batch.toJSON() as object),
    expiryStatus: expiryStatusFor(batch.expiryDate),
    daysUntilExpiry: daysUntil(batch.expiryDate),
});

const SORTABLE = ["expiryDate", "batchNumber", "quantityRemaining", "receivedAt", "costPrice"] as const;

export const listBatchesService = async (
    query: BatchListQuery,
    callback: (data: InventoryResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);
        const [sortField, sortDir] = resolveSort(query.sortBy, SORTABLE, "expiryDate", query.sortDir);

        const where: Record<string | symbol, unknown> = {};

        if (query.productId) where.productId = query.productId;
        if (query.supplierName) where.supplierName = query.supplierName;
        if (query.onlyInStock === "true") where.quantityRemaining = { [Op.gt]: 0 };

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [
                { batchNumber: { [Op.iLike]: term } },
                { supplierName: { [Op.iLike]: term } },
                { "$product.name$": { [Op.iLike]: term } },
            ];
        }

        if (query.categoryId) {
            where["$product.categoryId$"] = query.categoryId;
        }

        // `expiryStatus` is a derived band rather than a column, so it cannot
        // be part of the WHERE clause. The page is filtered after the fetch,
        // which is why the count is taken from the filtered set below.
        const rows = await Batch.findAll({
            where,
            include: PRODUCT_INCLUDE,
            order: [[sortField, sortDir]],
            ...(query.expiryStatus ? {} : { limit, offset }),
            subQuery: false,
        });

        if (query.expiryStatus) {
            const filtered = rows
                .map(withExpiry)
                .filter((batch) => batch.expiryStatus === query.expiryStatus);
            const start = (page - 1) * pageSize;

            return callback(
                messageHandler(
                    "Batches retrieved",
                    true,
                    SUCCESS,
                    buildPaginated(filtered.slice(start, start + pageSize), filtered.length, page, pageSize)
                )
            );
        }

        const total = await Batch.count({ where, include: PRODUCT_INCLUDE, distinct: true });

        return callback(
            messageHandler(
                "Batches retrieved",
                true,
                SUCCESS,
                buildPaginated(rows.map(withExpiry), total, page, pageSize)
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading batches.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getBatchesForProductService = async (
    productId: string,
    callback: (data: InventoryResponse) => void
) => {
    try {
        // Earliest expiry first — the order FEFO will consume them in, which is
        // what the "next for sale" tag on the frontend reads.
        const batches = await Batch.findAll({
            where: { productId },
            include: PRODUCT_INCLUDE,
            order: [
                ["expiryDate", "ASC"],
                ["receivedAt", "ASC"],
            ],
        });

        return callback(messageHandler("Batches retrieved", true, SUCCESS, batches.map(withExpiry)));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading batches.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getBatchService = async (id: string, callback: (data: InventoryResponse) => void) => {
    try {
        const batch = await Batch.findByPk(id, { include: PRODUCT_INCLUDE });

        if (!batch) {
            return callback(messageHandler("Batch not found.", false, 404, {}));
        }

        return callback(messageHandler("Batch retrieved", true, SUCCESS, withExpiry(batch)));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the batch.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export { withExpiry };
