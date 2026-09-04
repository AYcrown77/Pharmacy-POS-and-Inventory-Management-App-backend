import { Op } from "sequelize";
import sequelize from "../../database/db.js";
import Batch from "../../schemas/inventory/batchSchema.js";
import Product from "../../schemas/products/productSchema.js";
import StockAdjustment from "../../schemas/inventory/stockAdjustmentSchema.js";
import { recordMovement } from "./movementService.js";
import { recordAudit } from "../system/auditService.js";
import { withExpiry } from "./batchService.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import { dateOnlyRangeToInstants, isValidDateOnly, today } from "../../utils/date.js";
import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
    SUCCESS,
} from "../../constants/statusCode.js";
import {
    AdjustStockInput,
    AdjustmentListQuery,
    ADJUSTMENT_REASON_MOVEMENT,
    ReceiveStockInput,
    StockResponse,
} from "../../types/inventory/stock.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

/**
 * The two operations that change stock outside a sale.
 *
 * Both run inside a transaction, because each one writes to two or three
 * tables and a half-applied stock change is worse than a failed one: a batch
 * whose quantity moved with no ledger row behind it can never be explained.
 */

export const receiveStockService = async (
    input: ReceiveStockInput,
    user: AuthenticatedUser,
    callback: (data: StockResponse) => void
) => {
    const transaction = await sequelize.transaction();

    try {
        if (input.quantityReceived <= 0) {
            await transaction.rollback();
            return callback(
                messageHandler("Quantity received must be greater than zero.", false, BAD_REQUEST, {})
            );
        }

        if (!isValidDateOnly(input.expiryDate)) {
            await transaction.rollback();
            return callback(messageHandler("Enter a valid expiry date.", false, BAD_REQUEST, {}));
        }

        // Receiving stock that has already expired is always a mistake, and
        // letting it in would put unsellable units on the shelf and into the
        // stock value.
        if (input.expiryDate < today()) {
            await transaction.rollback();
            return callback(
                messageHandler("That expiry date has already passed.", false, BAD_REQUEST, {})
            );
        }

        const product = await Product.findByPk(input.productId, { transaction });
        if (!product) {
            await transaction.rollback();
            return callback(messageHandler("Product not found.", false, NOT_FOUND, {}));
        }

        const receivedAt = isValidDateOnly(input.receivedAt)
            ? new Date(`${input.receivedAt}T09:00:00+01:00`)
            : new Date();

        const batch = await Batch.create(
            {
                productId: product.id,
                batchNumber: input.batchNumber.trim(),
                expiryDate: input.expiryDate,
                quantityReceived: input.quantityReceived,
                quantityRemaining: input.quantityReceived,
                costPrice: input.costPrice,
                sellingPrice: input.sellingPrice,
                supplierName: input.supplierName?.trim() || null,
                receivedAt,
                receivedBy: user.id,
                receivedByName: user.name,
            },
            { transaction }
        );

        await recordMovement(
            {
                productId: product.id,
                productName: product.name,
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                movementType: "STOCK_RECEIVED",
                quantity: input.quantityReceived,
                previousQuantity: 0,
                newQuantity: input.quantityReceived,
                referenceType: "BATCH",
                referenceId: batch.id,
                userId: user.id,
                userName: user.name,
            },
            transaction
        );

        await recordAudit(
            {
                userId: user.id,
                userName: user.name,
                action: "STOCK_RECEIVED",
                entityType: "BATCH",
                entityId: batch.id,
                newValue: {
                    product: product.name,
                    batchNumber: batch.batchNumber,
                    quantity: input.quantityReceived,
                },
            },
            transaction
        );

        // A new selling price on a delivery becomes the catalogue price, and is
        // audited separately because a price change is a tracked action of its
        // own — not a side effect somebody has to infer from a stock receipt.
        if (input.sellingPrice !== product.sellingPrice) {
            const previous = product.sellingPrice;
            await product.update({ sellingPrice: input.sellingPrice }, { transaction });

            await recordAudit(
                {
                    userId: user.id,
                    userName: user.name,
                    action: "PRICE_CHANGED",
                    entityType: "PRODUCT",
                    entityId: product.id,
                    oldValue: { sellingPrice: previous },
                    newValue: { sellingPrice: input.sellingPrice },
                },
                transaction
            );
        }

        await transaction.commit();

        const saved = await Batch.findByPk(batch.id, {
            include: [{ model: Product, as: "product" }],
        });

        return callback(messageHandler("Stock received", true, SUCCESS, saved ? withExpiry(saved) : batch));
    } catch (error: any) {
        await transaction.rollback();
        console.log("Stock receipt failed:", error?.message);
        return callback(
            messageHandler("An error occured while receiving stock.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const adjustStockService = async (
    input: AdjustStockInput,
    user: AuthenticatedUser,
    callback: (data: StockResponse) => void
) => {
    const transaction = await sequelize.transaction();

    try {
        if (!input.adjustment) {
            await transaction.rollback();
            return callback(messageHandler("Enter an adjustment quantity.", false, BAD_REQUEST, {}));
        }

        // Locked for the length of the transaction: another terminal selling
        // from this batch at the same moment must not read a quantity that is
        // about to change underneath it.
        //
        // The product is fetched separately rather than included, because
        // postgres refuses FOR UPDATE on the nullable side of an outer join.
        const batch = await Batch.findByPk(input.batchId, {
            lock: transaction.LOCK.UPDATE,
            transaction,
        });

        if (!batch) {
            await transaction.rollback();
            return callback(messageHandler("Batch not found.", false, NOT_FOUND, {}));
        }

        const product = await Product.findByPk(batch.productId, { transaction });
        if (!product) {
            await transaction.rollback();
            return callback(messageHandler("Product not found.", false, NOT_FOUND, {}));
        }

        const quantityBefore = batch.quantityRemaining;
        const quantityAfter = quantityBefore + input.adjustment;

        if (quantityAfter < 0) {
            await transaction.rollback();
            return callback(
                messageHandler(
                    `This batch only holds ${quantityBefore} unit(s). The adjustment cannot take it below zero.`,
                    false,
                    BAD_REQUEST,
                    { code: "INVALID_ADJUSTMENT" }
                )
            );
        }

        await batch.update({ quantityRemaining: quantityAfter }, { transaction });

        const adjustment = await StockAdjustment.create(
            {
                productId: product.id,
                productName: product.name,
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                quantityBefore,
                adjustment: input.adjustment,
                quantityAfter,
                reason: input.reason,
                notes: input.notes?.trim() || null,
                performedBy: user.id,
                performedByName: user.name,
            },
            { transaction }
        );

        await recordMovement(
            {
                productId: product.id,
                productName: product.name,
                batchId: batch.id,
                batchNumber: batch.batchNumber,
                movementType: ADJUSTMENT_REASON_MOVEMENT[input.reason],
                quantity: input.adjustment,
                previousQuantity: quantityBefore,
                newQuantity: quantityAfter,
                referenceType: "ADJUSTMENT",
                referenceId: adjustment.id,
                userId: user.id,
                userName: user.name,
                reason: input.notes,
            },
            transaction
        );

        await recordAudit(
            {
                userId: user.id,
                userName: user.name,
                action: "STOCK_ADJUSTMENT",
                entityType: "BATCH",
                entityId: batch.id,
                oldValue: { quantityRemaining: quantityBefore },
                newValue: { quantityRemaining: quantityAfter, reason: input.reason },
            },
            transaction
        );

        await transaction.commit();

        return callback(messageHandler("Stock adjusted", true, SUCCESS, adjustment));
    } catch (error: any) {
        await transaction.rollback();
        console.log("Stock adjustment failed:", error?.message);
        return callback(
            messageHandler("An error occured while adjusting stock.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const listAdjustmentsService = async (
    query: AdjustmentListQuery,
    callback: (data: StockResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.productId) where.productId = query.productId;
        if (query.reason) where.reason = query.reason;
        if (query.userId) where.performedBy = query.userId;

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [
                { productName: { [Op.iLike]: term } },
                { batchNumber: { [Op.iLike]: term } },
                { performedByName: { [Op.iLike]: term } },
            ];
        }

        if (isValidDateOnly(query.from) && isValidDateOnly(query.to)) {
            const { start, end } = dateOnlyRangeToInstants(query.from, query.to);
            where.createdAt = { [Op.gte]: start, [Op.lt]: end };
        }

        const { rows, count } = await StockAdjustment.findAndCountAll({
            where,
            order: [["createdAt", query.sortDir === "asc" ? "ASC" : "DESC"]],
            limit,
            offset,
        });

        return callback(
            messageHandler("Adjustments retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading adjustments.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const listSuppliersService = async (callback: (data: StockResponse) => void) => {
    try {
        // Fills the receiving form's datalist, so a delivery from a supplier
        // already on file is typed the same way every time.
        const rows = (await Batch.findAll({
            attributes: [[sequelize.fn("DISTINCT", sequelize.col("supplierName")), "supplierName"]],
            where: { supplierName: { [Op.ne]: null } },
            order: [["supplierName", "ASC"]],
            raw: true,
        })) as unknown as Array<{ supplierName: string | null }>;

        const suppliers = rows
            .map((row) => row.supplierName)
            .filter((name): name is string => Boolean(name));

        return callback(messageHandler("Suppliers retrieved", true, SUCCESS, suppliers));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading suppliers.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
