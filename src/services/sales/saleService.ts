import { Op, QueryTypes, Transaction } from "sequelize";
import sequelize from "../../database/db.js";
import Sale from "../../schemas/sales/saleSchema.js";
import SaleItem from "../../schemas/sales/saleItemSchema.js";
import SaleReturn from "../../schemas/sales/saleReturnSchema.js";
import Batch from "../../schemas/inventory/batchSchema.js";
import Product, {
    DEFAULT_PRICE_TIER,
    pricingForTier,
} from "../../schemas/products/productSchema.js";
import Terminal from "../../schemas/system/terminalSchema.js";
import Customer from "../../schemas/customers/customerSchema.js";
import { moveCustomerBalance } from "../customers/customerService.js";
import { recordMovements, RecordMovementInput } from "../inventory/movementService.js";
import { recordAudit } from "../system/auditService.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import { dateOnlyRangeToInstants, isValidDateOnly, today } from "../../utils/date.js";
import {
    BAD_REQUEST,
    CONFLICT,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
    SUCCESS,
} from "../../constants/statusCode.js";
import {
    CompleteSaleInput,
    FefoAllocation,
    SaleListQuery,
    SaleResponse,
} from "../../types/sales/sale.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

const SALE_INCLUDE = [
    { model: SaleItem, as: "items" },
    { model: SaleReturn, as: "returns" },
];

export const formatReceiptNumber = (sequence: number): string =>
    `MHP-${sequence.toString().padStart(6, "0")}`;

/**
 * Draws the next receipt number from the postgres sequence.
 *
 * Deliberately outside the caller's transaction semantics in the sense that a
 * rolled-back sale burns its number rather than reusing it. A gap in the
 * receipt series is harmless; two sales sharing a receipt number is not.
 */
const nextReceiptNumber = async (transaction: Transaction): Promise<string> => {
    const [row] = await sequelize.query<{ nextval: string }>(
        "SELECT nextval('receipt_number_seq') AS nextval",
        { type: QueryTypes.SELECT, transaction }
    );
    return formatReceiptNumber(Number(row.nextval));
};

/**
 * Completes a sale.
 *
 * This is the one place in the system where money and stock move together, so
 * it is the one place that most needs to be all-or-nothing. Section 14 of the
 * specification requires a database transaction, and the shape here follows
 * from that:
 *
 *   1. Lock and read every batch the sale will touch.
 *   2. Plan the FEFO allocation for every line and check all of them.
 *   3. Only then write — batches, sale, items and ledger rows.
 *
 * The check-everything-before-writing-anything order is what stops a sale from
 * half-succeeding when the fourth line turns out to be short. The frontend
 * relies on this: on a rejection it keeps the cart and highlights the line,
 * which is only safe if nothing was deducted.
 */
export const completeSaleService = async (
    input: CompleteSaleInput,
    user: AuthenticatedUser,
    callback: (data: SaleResponse) => void
) => {
    const transaction = await sequelize.transaction();

    try {
        if (!input.lines?.length) {
            await transaction.rollback();
            return callback(
                messageHandler("A sale must contain at least one item.", false, BAD_REQUEST, {})
            );
        }

        // Two cashiers selling the same products at once would deadlock if each
        // locked its batches in cart order. Sorting the product ids gives every
        // terminal the same lock order, so one simply waits for the other.
        const lineByProduct = new Map<string, number>();
        for (const line of input.lines) {
            if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
                await transaction.rollback();
                return callback(
                    messageHandler("Every line must have a whole quantity of at least one.", false, BAD_REQUEST, {})
                );
            }
            lineByProduct.set(line.productId, (lineByProduct.get(line.productId) ?? 0) + line.quantity);
        }

        const productIds = [...lineByProduct.keys()].sort();

        const products = await Product.findAll({
            where: { id: { [Op.in]: productIds } },
            transaction,
        });
        const productById = new Map(products.map((product) => [product.id, product]));

        if (products.length !== productIds.length) {
            await transaction.rollback();
            return callback(
                messageHandler("A product in this sale no longer exists.", false, NOT_FOUND, {})
            );
        }

        // One tier for the whole basket: a customer is a wholesaler or a
        // walk-in, not both mid-sale.
        const priceTier = input.priceTier ?? DEFAULT_PRICE_TIER;

        const asOf = today();
        const plan: Array<{
            product: Product;
            allocations: FefoAllocation[];
            pricing: ReturnType<typeof pricingForTier>;
        }> = [];
        const batchById = new Map<string, Batch>();

        for (const productId of productIds) {
            const product = productById.get(productId)!;
            const pricing = pricingForTier(product, priceTier);

            // The cart counts in whatever the tier sells — packs for a trade
            // buyer, singles for a walk-in. The shelf counts in singles only,
            // so the two are reconciled here, once, before anything is locked
            // or deducted.
            const wantedSaleUnits = lineByProduct.get(productId)!;
            const wanted = wantedSaleUnits * pricing.baseUnits;

            // FEFO order, locked for the length of the transaction so another
            // terminal cannot sell the same units between the check and the
            // deduction.
            const batches = await Batch.findAll({
                where: {
                    productId,
                    quantityRemaining: { [Op.gt]: 0 },
                    expiryDate: { [Op.gte]: asOf },
                },
                order: [
                    ["expiryDate", "ASC"],
                    ["receivedAt", "ASC"],
                ],
                lock: transaction.LOCK.UPDATE,
                transaction,
            });

            /*
             * FEFO, counted in selling units.
             *
             * A pack is a sealed box that came from one batch, so a pack is
             * only ever drawn whole from a single batch — never assembled from
             * the tail of one and the start of another. That keeps the line's
             * arithmetic exact (an integer number of packs at an integer
             * price) and matches what is physically on the shelf. A batch with
             * fewer than a full pack left still sells as singles at the
             * consumer tier, where `baseUnits` is 1 and this degenerates to
             * the plain behaviour it always had.
             */
            const allocations: FefoAllocation[] = [];
            const perBatchTaken = new Map<string, number>();
            let outstanding = wantedSaleUnits;

            for (const batch of batches) {
                if (outstanding <= 0) break;

                const takenAlready = perBatchTaken.get(batch.id) ?? 0;
                const spare = batch.quantityRemaining - takenAlready * pricing.baseUnits;
                const canTake = Math.min(Math.floor(spare / pricing.baseUnits), outstanding);
                if (canTake <= 0) continue;

                allocations.push({
                    batchId: batch.id,
                    batchNumber: batch.batchNumber,
                    quantity: canTake,
                    expiryDate: batch.expiryDate,
                });
                perBatchTaken.set(batch.id, takenAlready + canTake);
                batchById.set(batch.id, batch);
                outstanding -= canTake;
            }

            if (outstanding > 0) {
                // Reported in the unit the cashier is working in: telling
                // someone selling packs that "17 units" are available when
                // they asked for 2 packs is not an answer they can act on.
                const availableSaleUnits = wantedSaleUnits - outstanding;
                const availableBase = availableSaleUnits * pricing.baseUnits;
                const noun = pricing.sellsPacks ? "pack" : "unit";

                await transaction.rollback();
                return callback(
                    messageHandler(
                        `Only ${availableSaleUnits} ${noun}${availableSaleUnits === 1 ? "" : "s"} of ${product.name} are available.`,
                        false,
                        CONFLICT,
                        {
                            code: "INSUFFICIENT_STOCK",
                            productId,
                            requested: wantedSaleUnits,
                            available: availableSaleUnits,
                            baseUnitsAvailable: availableBase,
                        }
                    )
                );
            }

            plan.push({ product, allocations, pricing });
        }

        // Every line is satisfiable — from here on the sale is being written.
        // Allocations are counted in selling units, so this is a plain
        // multiplication — no division, and therefore no fractional kobo.
        const subtotal = plan.reduce(
            (total, entry) =>
                total +
                entry.allocations.reduce(
                    (lineTotal, allocation) =>
                        lineTotal + entry.pricing.unitPrice * allocation.quantity,
                    0
                ),
            0
        );

        const discount = Math.max(input.discount ?? 0, 0);
        const total = Math.max(subtotal - discount, 0);

        // The customer, if this sale is on an account rather than a walk-in.
        // Locked here so the balance cannot shift between the arithmetic below
        // and the ledger entry written further down.
        const customer = input.customerId
            ? await Customer.findByPk(input.customerId, {
                  lock: transaction.LOCK.UPDATE,
                  transaction,
              })
            : null;

        if (input.customerId && !customer) {
            await transaction.rollback();
            return callback(messageHandler("Customer not found.", false, NOT_FOUND, {}));
        }

        // Every method records what was actually handed over, not just cash.
        // A card or transfer can fall short of the total just as a handful of
        // notes can, and the shortfall has to be able to become debt — which
        // it cannot if the amount is thrown away for anything but cash.
        const received = input.amountReceived ?? null;

        /*
         * How money short or over is settled.
         *
         *   short  — the customer took goods without paying in full. The
         *            shortfall becomes debt, which is only possible on a named
         *            account: a walk-in who cannot pay is refused, because
         *            there would be nobody to bill.
         *   over   — the surplus first clears what they already owe, and only
         *            what is left over is handed back as change. Giving change
         *            to someone who owes money and then chasing them for it is
         *            how a balance quietly grows.
         */
        let debtCharged = 0;
        let debtRepaid = 0;
        let changeGiven: number | null = null;

        if (received !== null) {
            if (received < total) {
                const shortfall = total - received;

                if (!customer) {
                    await transaction.rollback();
                    return callback(
                        messageHandler("The amount received is less than the total due.", false, BAD_REQUEST, {
                            code: "INSUFFICIENT_PAYMENT",
                        })
                    );
                }

                debtCharged = shortfall;
                changeGiven = 0;
            } else {
                const surplus = received - total;
                // Only an existing debt absorbs the surplus, and only as far
                // as it goes — never turning change into unasked-for credit.
                debtRepaid = customer ? Math.min(surplus, Math.max(customer.balance, 0)) : 0;
                changeGiven = surplus - debtRepaid;
            }
        }

        const terminal = input.terminalId ? await Terminal.findByPk(input.terminalId, { transaction }) : null;

        const sale = await Sale.create(
            {
                receiptNumber: await nextReceiptNumber(transaction),
                terminalId: input.terminalId,
                terminalName: terminal?.name ?? input.terminalId,
                cashierId: user.id,
                cashierName: user.name,
                customerId: customer?.id ?? null,
                customerName: customer?.name ?? null,
                subtotal,
                discount,
                total,
                paymentMethod: input.paymentMethod,
                priceTier,
                amountReceived: received,
                changeGiven,
                debtCharged,
                debtRepaid,
                customerBalanceAfter: customer
                    ? customer.balance + debtCharged - debtRepaid
                    : null,
                status: "COMPLETED",
            },
            { transaction }
        );

        const items: Array<Record<string, unknown>> = [];
        const movements: RecordMovementInput[] = [];

        for (const entry of plan) {
            const { product } = entry;

            for (const allocation of entry.allocations) {
                const batch = batchById.get(allocation.batchId)!;
                const { unitPrice, baseUnits } = entry.pricing;

                // The allocation is in selling units; the shelf moves in base
                // units. One pack of 24 leaving is 24 fewer on the shelf.
                const baseTaken = allocation.quantity * baseUnits;
                const previousQuantity = batch.quantityRemaining;
                const newQuantity = previousQuantity - baseTaken;

                await batch.update({ quantityRemaining: newQuantity }, { transaction });

                items.push({
                    saleId: sale.id,
                    productId: product.id,
                    productName: product.name,
                    batchId: batch.id,
                    batchNumber: batch.batchNumber,
                    quantity: allocation.quantity,
                    unitsPerSaleUnit: baseUnits,
                    // The price at the moment of sale. A later price change
                    // must not rewrite what this receipt says was charged.
                    unitPrice,
                    subtotal: unitPrice * allocation.quantity,
                    returnedQuantity: 0,
                });

                movements.push({
                    productId: product.id,
                    productName: product.name,
                    batchId: batch.id,
                    batchNumber: batch.batchNumber,
                    movementType: "SALE",
                    quantity: -baseTaken,
                    previousQuantity,
                    newQuantity,
                    referenceType: "SALE",
                    referenceId: sale.id,
                    userId: user.id,
                    userName: user.name,
                });
            }
        }

        await SaleItem.bulkCreate(items as never, { transaction });
        await recordMovements(movements, transaction);

        // The balance moves with the sale or not at all. A ledger entry for a
        // sale that rolled back would be a debt for goods never handed over.
        if (customer && (debtCharged > 0 || debtRepaid > 0)) {
            await moveCustomerBalance(
                {
                    customerId: customer.id,
                    entryType: debtCharged > 0 ? "CHARGE" : "REPAYMENT",
                    amount: debtCharged > 0 ? debtCharged : -debtRepaid,
                    saleId: sale.id,
                    receiptNumber: sale.receiptNumber,
                    user,
                },
                transaction
            );

            await recordAudit(
                {
                    userId: user.id,
                    userName: user.name,
                    action: debtCharged > 0 ? "CUSTOMER_CHARGED" : "CUSTOMER_REPAYMENT",
                    entityType: "CUSTOMER",
                    entityId: customer.id,
                    oldValue: { balance: customer.balance },
                    newValue: {
                        balance: customer.balance + debtCharged - debtRepaid,
                        receiptNumber: sale.receiptNumber,
                    },
                },
                transaction
            );
        }

        await recordAudit(
            {
                userId: user.id,
                userName: user.name,
                action: "SALE_COMPLETED",
                entityType: "SALE",
                entityId: sale.id,
                newValue: { receiptNumber: sale.receiptNumber, total: sale.total },
            },
            transaction
        );

        await transaction.commit();

        const saved = await Sale.findByPk(sale.id, { include: SALE_INCLUDE });

        return callback(messageHandler("Sale completed", true, SUCCESS, saved ?? sale));
    } catch (error: any) {
        await transaction.rollback();
        console.log("Sale failed:", error?.message);
        return callback(
            messageHandler("An error occured while completing the sale.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/**
 * Restricts a cashier to their own sales.
 *
 * Section 17 gives cashiers `sales:read:own`. The frontend hides other
 * people's sales, but hiding is not authorization — this is where it holds.
 */
const scopeToUser = (user: AuthenticatedUser, where: Record<string | symbol, unknown>) => {
    if (user.role !== "ADMINISTRATOR") where.cashierId = user.id;
    return where;
};

export const listSalesService = async (
    query: SaleListQuery,
    user: AuthenticatedUser,
    callback: (data: SaleResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.cashierId) where.cashierId = query.cashierId;
        if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
        if (query.status) where.status = query.status;
        if (query.terminalId) where.terminalId = query.terminalId;

        if (isValidDateOnly(query.from) && isValidDateOnly(query.to)) {
            const { start, end } = dateOnlyRangeToInstants(query.from, query.to);
            where.createdAt = { [Op.gte]: start, [Op.lt]: end };
        }

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [
                { receiptNumber: { [Op.iLike]: term } },
                { cashierName: { [Op.iLike]: term } },
            ];
        }

        scopeToUser(user, where);

        // Filtering by product means "sales that contain this product", which
        // is a condition on the items rather than the sale — an inner join
        // rather than a column comparison.
        const include = query.productId
            ? [
                  {
                      model: SaleItem,
                      as: "items",
                      required: true,
                      where: { productId: query.productId },
                  },
              ]
            : SALE_INCLUDE;

        const { rows, count } = await Sale.findAndCountAll({
            where,
            include,
            order: [["createdAt", query.sortDir === "asc" ? "ASC" : "DESC"]],
            limit,
            offset,
            distinct: true,
        });

        return callback(
            messageHandler("Sales retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading sales.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getSaleService = async (
    id: string,
    user: AuthenticatedUser,
    callback: (data: SaleResponse) => void
) => {
    try {
        const sale = await Sale.findByPk(id, { include: SALE_INCLUDE });

        if (!sale) {
            return callback(messageHandler("Sale not found.", false, NOT_FOUND, {}));
        }

        // Same message whether the sale is missing or simply not theirs, so the
        // endpoint cannot be used to enumerate other cashiers' takings.
        if (user.role !== "ADMINISTRATOR" && sale.cashierId !== user.id) {
            return callback(messageHandler("Sale not found.", false, NOT_FOUND, {}));
        }

        return callback(messageHandler("Sale retrieved", true, SUCCESS, sale));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the sale.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getSaleByReceiptService = async (
    receiptNumber: string,
    user: AuthenticatedUser,
    callback: (data: SaleResponse) => void
) => {
    try {
        const sale = await Sale.findOne({
            where: { receiptNumber: receiptNumber.trim() },
            include: SALE_INCLUDE,
        });

        if (!sale || (user.role !== "ADMINISTRATOR" && sale.cashierId !== user.id)) {
            // Null rather than a 404: the returns screen looks receipts up as
            // the user types, and a failed request there would read as an error
            // rather than "no such receipt yet".
            return callback(messageHandler("Receipt lookup complete", true, SUCCESS, null));
        }

        return callback(messageHandler("Receipt lookup complete", true, SUCCESS, sale));
    } catch (error) {
        return callback(
            messageHandler("An error occured while finding the receipt.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getRecentSalesService = async (
    limit: number,
    user: AuthenticatedUser,
    callback: (data: SaleResponse) => void
) => {
    try {
        const where = scopeToUser(user, {});

        const sales = await Sale.findAll({
            where,
            include: [{ model: SaleItem, as: "items" }],
            order: [["createdAt", "DESC"]],
            limit,
        });

        return callback(
            messageHandler(
                "Recent sales retrieved",
                true,
                SUCCESS,
                sales.map((sale) => ({
                    id: sale.id,
                    receiptNumber: sale.receiptNumber,
                    cashierName: sale.cashierName,
                    itemCount: sale.items?.length ?? 0,
                    total: sale.total,
                    paymentMethod: sale.paymentMethod,
                    status: sale.status,
                    createdAt: sale.createdAt,
                }))
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading recent sales.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
