import { Op, Transaction } from "sequelize";
import StockMovement, {
    MovementType,
    StockMovementCreationAttributes,
} from "../../schemas/inventory/stockMovementSchema.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import { dateOnlyRangeToInstants, isValidDateOnly } from "../../utils/date.js";
import { INTERNAL_SERVER_ERROR, SUCCESS } from "../../constants/statusCode.js";
import { InventoryResponse, MovementListQuery } from "../../types/inventory/inventory.js";

/**
 * The stock ledger.
 *
 * Stock never changes without a row here. Receiving, selling, returning,
 * damage, expiry and manual adjustment all write one, carrying the quantity
 * before and after, so the shelf can always be explained rather than merely
 * reported. Nothing in this module updates or deletes a movement — the ledger
 * is append-only by construction.
 */

export interface RecordMovementInput {
    productId: string;
    productName: string;
    batchId?: string | null;
    batchNumber?: string | null;
    movementType: MovementType;
    /** Signed: positive adds stock, negative removes it. */
    quantity: number;
    previousQuantity: number;
    newQuantity: number;
    referenceType?: string | null;
    referenceId?: string | null;
    userId: string;
    userName: string;
    reason?: string | null;
}

/**
 * Writes one ledger row.
 *
 * Unlike the audit trail, a failure here is NOT swallowed: the movement is
 * part of the stock change itself, and a deduction that happened without a
 * matching row would leave the ledger unable to explain the shelf. The caller
 * passes its transaction so the two commit together or not at all.
 */
export const recordMovement = async (data: RecordMovementInput, transaction?: Transaction) => {
    const payload: StockMovementCreationAttributes = {
        productId: data.productId,
        productName: data.productName,
        batchId: data.batchId ?? null,
        batchNumber: data.batchNumber ?? null,
        movementType: data.movementType,
        quantity: data.quantity,
        previousQuantity: data.previousQuantity,
        newQuantity: data.newQuantity,
        referenceType: data.referenceType ?? null,
        referenceId: data.referenceId ?? null,
        userId: data.userId,
        userName: data.userName,
        reason: data.reason ?? null,
    };

    return StockMovement.create(payload, { transaction });
};

/** Writes several ledger rows at once, for a sale that touched many batches. */
export const recordMovements = async (rows: RecordMovementInput[], transaction?: Transaction) => {
    if (rows.length === 0) return [];
    return StockMovement.bulkCreate(
        rows.map((row) => ({
            ...row,
            batchId: row.batchId ?? null,
            batchNumber: row.batchNumber ?? null,
            referenceType: row.referenceType ?? null,
            referenceId: row.referenceId ?? null,
            reason: row.reason ?? null,
        })),
        { transaction }
    );
};

export const listMovementsService = async (
    query: MovementListQuery,
    callback: (data: InventoryResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.productId) where.productId = query.productId;
        if (query.batchId) where.batchId = query.batchId;
        if (query.movementType) where.movementType = query.movementType;
        if (query.userId) where.userId = query.userId;

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [
                { productName: { [Op.iLike]: term } },
                { batchNumber: { [Op.iLike]: term } },
                { userName: { [Op.iLike]: term } },
                { reason: { [Op.iLike]: term } },
            ];
        }

        if (isValidDateOnly(query.from) && isValidDateOnly(query.to)) {
            const { start, end } = dateOnlyRangeToInstants(query.from, query.to);
            // Half-open, so a movement at 23:59 on the last day is included.
            where.createdAt = { [Op.gte]: start, [Op.lt]: end };
        }

        const { rows, count } = await StockMovement.findAndCountAll({
            where,
            order: [["createdAt", query.sortDir === "asc" ? "ASC" : "DESC"]],
            limit,
            offset,
        });

        return callback(
            messageHandler("Movements retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading movements.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getRecentMovementsService = async (
    limit: number,
    callback: (data: InventoryResponse) => void
) => {
    try {
        const rows = await StockMovement.findAll({
            order: [["createdAt", "DESC"]],
            limit,
        });

        return callback(
            messageHandler(
                "Recent movements retrieved",
                true,
                SUCCESS,
                rows.map((row) => ({
                    id: row.id,
                    productName: row.productName,
                    batchNumber: row.batchNumber,
                    movementType: row.movementType,
                    quantity: row.quantity,
                    userName: row.userName,
                    createdAt: row.createdAt,
                }))
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading recent activity.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
