import { Op, fn, col, literal } from "sequelize";
import Batch from "../../schemas/inventory/batchSchema.js";
import { today, DateOnly } from "../../utils/date.js";

/**
 * Shared stock reads.
 *
 * Stock is never stored as a number on the product — it is always the sum of
 * that product's batches. Every module that needs "how many are on the shelf"
 * comes through here, so there is exactly one definition of the answer.
 *
 * Sellable means: still in the batch, and not past its expiry date. Expired
 * units are physically present but must never count towards what can be sold,
 * which is why a product can read zero available while its batches are not
 * empty.
 */

export interface StockTotals {
    available: number;
    batchCount: number;
    nearestExpiry: DateOnly | null;
}

const sellableWhere = (asOf: DateOnly) => ({
    quantityRemaining: { [Op.gt]: 0 },
    expiryDate: { [Op.gte]: asOf },
});

/**
 * Sellable totals for many products in one query.
 *
 * The product and inventory lists would otherwise run a count per row; at a
 * few hundred products that is a few hundred round trips on a mini-PC.
 */
export const getStockTotals = async (productIds?: string[]): Promise<Map<string, StockTotals>> => {
    const asOf = today();

    const rows = await Batch.findAll({
        attributes: [
            "productId",
            [fn("SUM", col("quantityRemaining")), "available"],
            [fn("COUNT", col("id")), "batchCount"],
            [fn("MIN", col("expiryDate")), "nearestExpiry"],
        ],
        where: {
            ...sellableWhere(asOf),
            ...(productIds ? { productId: { [Op.in]: productIds } } : {}),
        },
        group: ["productId"],
        raw: true,
    });

    const totals = new Map<string, StockTotals>();

    for (const row of rows as unknown as Array<Record<string, unknown>>) {
        totals.set(String(row.productId), {
            // SUM and COUNT come back as strings from postgres regardless of
            // parseInt8, because the aggregate result type is numeric.
            available: Number(row.available ?? 0),
            batchCount: Number(row.batchCount ?? 0),
            nearestExpiry: row.nearestExpiry ? String(row.nearestExpiry) : null,
        });
    }

    return totals;
};

export const emptyTotals = (): StockTotals => ({ available: 0, batchCount: 0, nearestExpiry: null });

/**
 * A product's sellable batches, earliest expiry first.
 *
 * This is the FEFO order — the order a sale consumes them in. The received
 * date breaks ties so two batches sharing an expiry are still consumed
 * deterministically, oldest stock first.
 */
export const getSellableBatches = async (productId: string) =>
    Batch.findAll({
        where: { productId, ...sellableWhere(today()) },
        order: [
            ["expiryDate", "ASC"],
            ["receivedAt", "ASC"],
        ],
    });

/** Every batch of a product, expired included, earliest expiry first. */
export const getBatchesForProduct = async (productId: string) =>
    Batch.findAll({
        where: { productId },
        order: [["expiryDate", "ASC"]],
    });

/** True when a product has stock on the shelf but every unit of it has expired. */
export const hasOnlyExpiredStock = async (productId: string): Promise<boolean> => {
    const onShelf = await Batch.count({
        where: { productId, quantityRemaining: { [Op.gt]: 0 } },
    });
    if (onShelf === 0) return false;

    const sellable = await Batch.count({
        where: { productId, ...sellableWhere(today()) },
    });
    return sellable === 0;
};

/** Total value of sellable stock at cost, in kobo. */
export const getInventoryValue = async (): Promise<number> => {
    const row = (await Batch.findOne({
        attributes: [[literal('SUM("quantityRemaining" * "costPrice")'), "value"]],
        where: sellableWhere(today()),
        raw: true,
    })) as unknown as { value: string | null } | null;

    return Number(row?.value ?? 0);
};
