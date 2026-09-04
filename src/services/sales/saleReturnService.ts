import { Op } from "sequelize";
import sequelize from "../../database/db.js";
import Sale, { SaleStatus } from "../../schemas/sales/saleSchema.js";
import SaleItem from "../../schemas/sales/saleItemSchema.js";
import SaleReturn from "../../schemas/sales/saleReturnSchema.js";
import SaleReturnItem from "../../schemas/sales/saleReturnItemSchema.js";
import Batch from "../../schemas/inventory/batchSchema.js";
import { recordMovements, RecordMovementInput } from "../inventory/movementService.js";
import { recordAudit } from "../system/auditService.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import {
    BAD_REQUEST,
    CONFLICT,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
    SUCCESS,
} from "../../constants/statusCode.js";
import { ProcessReturnInput, ReturnListQuery, ReturnResponse } from "../../types/sales/saleReturn.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

const RETURN_INCLUDE = [{ model: SaleReturnItem, as: "items" }];

/**
 * Processes a return against an existing sale.
 *
 * Nothing here deletes or rewrites the original sale. A reversal record is
 * created alongside it, the stock goes back to the batch it actually came out
 * of, and the sale's status moves to partially returned or reversed. The
 * original receipt stays exactly as it was printed, which is the point: a
 * pharmacy has to be able to show what was sold as well as what came back.
 */
export const processReturnService = async (
    input: ProcessReturnInput,
    user: AuthenticatedUser,
    callback: (data: ReturnResponse) => void
) => {
    const transaction = await sequelize.transaction();

    try {
        // Locked without its lines. Postgres refuses FOR UPDATE on the nullable
        // side of an outer join, which is what an `include` would produce here,
        // so the sale and its items are locked as two plain row-level reads.
        const sale = await Sale.findByPk(input.saleId, {
            lock: transaction.LOCK.UPDATE,
            transaction,
        });

        if (!sale) {
            await transaction.rollback();
            return callback(messageHandler("Sale not found.", false, NOT_FOUND, {}));
        }

        if (sale.status === "REVERSED") {
            await transaction.rollback();
            return callback(
                messageHandler("This sale has already been fully reversed.", false, CONFLICT, {})
            );
        }

        const saleItems = await SaleItem.findAll({
            where: { saleId: sale.id },
            lock: transaction.LOCK.UPDATE,
            transaction,
        });
        const itemById = new Map(saleItems.map((item) => [item.id, item]));

        const requested = (input.items ?? []).filter((entry) => entry.quantity > 0);

        if (requested.length === 0) {
            await transaction.rollback();
            return callback(messageHandler("Select at least one item to return.", false, BAD_REQUEST, {}));
        }

        // Everything is checked before anything is written, so a bad quantity
        // on the third line cannot leave the first two already refunded.
        const planned: Array<{ saleItem: SaleItem; quantity: number }> = [];

        for (const entry of requested) {
            const saleItem = itemById.get(entry.saleItemId);
            if (!saleItem) {
                await transaction.rollback();
                return callback(messageHandler("That item is not part of this sale.", false, NOT_FOUND, {}));
            }

            const returnable = saleItem.quantity - saleItem.returnedQuantity;
            if (entry.quantity > returnable) {
                await transaction.rollback();
                return callback(
                    messageHandler(
                        `Only ${returnable} unit(s) of ${saleItem.productName} can still be returned.`,
                        false,
                        BAD_REQUEST,
                        { code: "INVALID_RETURN_QUANTITY" }
                    )
                );
            }

            planned.push({ saleItem, quantity: entry.quantity });
        }

        const refundAmount = planned.reduce(
            (total, entry) => total + entry.saleItem.unitPrice * entry.quantity,
            0
        );

        const saleReturn = await SaleReturn.create(
            {
                saleId: sale.id,
                receiptNumber: sale.receiptNumber,
                refundAmount,
                refundMethod: input.refundMethod,
                reason: input.reason,
                processedBy: user.id,
                processedByName: user.name,
            },
            { transaction }
        );

        const returnItems: Array<Record<string, unknown>> = [];
        const movements: RecordMovementInput[] = [];

        for (const { saleItem, quantity } of planned) {
            await saleItem.update(
                { returnedQuantity: saleItem.returnedQuantity + quantity },
                { transaction }
            );

            // Back to the batch it left, not to whichever batch is nearest
            // expiry now — otherwise a return would silently reshuffle which
            // units the pharmacy believes it is holding.
            const batch = await Batch.findByPk(saleItem.batchId, {
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            const previousQuantity = batch?.quantityRemaining ?? 0;
            const newQuantity = previousQuantity + quantity;

            if (batch) {
                await batch.update({ quantityRemaining: newQuantity }, { transaction });
            }

            returnItems.push({
                saleReturnId: saleReturn.id,
                saleItemId: saleItem.id,
                productId: saleItem.productId,
                productName: saleItem.productName,
                batchId: saleItem.batchId,
                batchNumber: saleItem.batchNumber,
                quantity,
                unitPrice: saleItem.unitPrice,
                refundAmount: saleItem.unitPrice * quantity,
                restocked: Boolean(batch),
            });

            movements.push({
                productId: saleItem.productId,
                productName: saleItem.productName,
                batchId: saleItem.batchId,
                batchNumber: saleItem.batchNumber,
                movementType: "RETURN",
                quantity,
                previousQuantity,
                newQuantity,
                referenceType: "RETURN",
                referenceId: saleReturn.id,
                userId: user.id,
                userName: user.name,
                reason: input.reason,
            });
        }

        await SaleReturnItem.bulkCreate(returnItems as never, { transaction });
        await recordMovements(movements, transaction);

        // Re-read the lines so the status reflects this return's updates.
        const refreshed = await SaleItem.findAll({ where: { saleId: sale.id }, transaction });
        const fullyReturned = refreshed.every((item) => item.returnedQuantity >= item.quantity);
        const status: SaleStatus = fullyReturned ? "REVERSED" : "PARTIALLY_RETURNED";

        const previousStatus = sale.status;
        await sale.update({ status }, { transaction });

        await recordAudit(
            {
                userId: user.id,
                userName: user.name,
                action: "SALE_REVERSAL",
                entityType: "SALE",
                entityId: sale.id,
                oldValue: { status: previousStatus },
                newValue: { status, refundAmount, reason: input.reason },
            },
            transaction
        );

        await transaction.commit();

        const saved = await SaleReturn.findByPk(saleReturn.id, { include: RETURN_INCLUDE });

        return callback(messageHandler("Return processed", true, SUCCESS, saved ?? saleReturn));
    } catch (error: any) {
        await transaction.rollback();
        console.log("Return failed:", error?.message);
        return callback(
            messageHandler("An error occured while processing the return.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const listReturnsService = async (
    query: ReturnListQuery,
    callback: (data: ReturnResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.saleId) where.saleId = query.saleId;
        if (query.processedBy) where.processedBy = query.processedBy;

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [
                { receiptNumber: { [Op.iLike]: term } },
                { reason: { [Op.iLike]: term } },
                { processedByName: { [Op.iLike]: term } },
            ];
        }

        const { rows, count } = await SaleReturn.findAndCountAll({
            where,
            include: RETURN_INCLUDE,
            order: [["createdAt", query.sortDir === "asc" ? "ASC" : "DESC"]],
            limit,
            offset,
            distinct: true,
        });

        return callback(
            messageHandler("Returns retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading returns.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getReturnsForSaleService = async (
    saleId: string,
    callback: (data: ReturnResponse) => void
) => {
    try {
        const returns = await SaleReturn.findAll({
            where: { saleId },
            include: RETURN_INCLUDE,
            order: [["createdAt", "DESC"]],
        });

        return callback(messageHandler("Reversal history retrieved", true, SUCCESS, returns));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the reversal history.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
