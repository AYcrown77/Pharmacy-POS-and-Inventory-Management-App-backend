import { literal, Op, Order, Transaction } from "sequelize";
import sequelize from "../../database/db.js";
import Customer from "../../schemas/customers/customerSchema.js";
import Sale from "../../schemas/sales/saleSchema.js";
import SaleItem from "../../schemas/sales/saleItemSchema.js";
import SaleReturn from "../../schemas/sales/saleReturnSchema.js";
import { daysBetween, toDateOnly, today } from "../../utils/date.js";
import CustomerLedgerEntry, {
    LedgerEntryType,
} from "../../schemas/customers/customerLedgerSchema.js";
import { recordAudit } from "../system/auditService.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import {
    BAD_REQUEST,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
    SUCCESS,
} from "../../constants/statusCode.js";
import {
    CustomerInput,
    CustomerInsights,
    CustomerListQuery,
    CustomerResponse,
    RepaymentInput,
} from "../../types/customers/customer.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export interface MoveBalanceInput {
    customerId: string;
    entryType: LedgerEntryType;
    /** Signed kobo: positive increases the debt, negative reduces it. */
    amount: number;
    saleId?: string | null;
    receiptNumber?: string | null;
    reason?: string | null;
    user: AuthenticatedUser;
}

/**
 * The single place a customer's balance changes.
 *
 * Everything that touches debt — a sale taken on credit, a repayment at the
 * counter, a return giving credit back, an administrator's correction — comes
 * through here, so the running balance and the ledger are always written
 * together. Two code paths that each moved the balance their own way would
 * eventually disagree, and a disputed balance nobody can explain is worse than
 * no balance at all.
 *
 * The caller passes its transaction: a sale's debt must commit with the sale
 * or not at all. The customer row is locked for the duration, because two
 * tills serving the same account at once would otherwise both read the same
 * "before" balance and one update would vanish.
 */
export const moveCustomerBalance = async (
    input: MoveBalanceInput,
    transaction: Transaction
): Promise<CustomerLedgerEntry> => {
    const customer = await Customer.findByPk(input.customerId, {
        lock: transaction.LOCK.UPDATE,
        transaction,
    });

    if (!customer) {
        throw new Error("Customer not found.");
    }

    const balanceBefore = customer.balance;
    const balanceAfter = balanceBefore + input.amount;

    await customer.update({ balance: balanceAfter }, { transaction });

    return CustomerLedgerEntry.create(
        {
            customerId: customer.id,
            entryType: input.entryType,
            amount: input.amount,
            balanceBefore,
            balanceAfter,
            saleId: input.saleId ?? null,
            receiptNumber: input.receiptNumber ?? null,
            reason: input.reason ?? null,
            userId: input.user.id,
            userName: input.user.name,
        },
        { transaction }
    );
};

// A sale that was fully reversed bought nothing, and a partial return gave
// some of its money back — so both are taken out of what a customer "spent".
const CUSTOMER_TOTAL_SPENT = `(
    SELECT CAST(
        COALESCE((SELECT SUM(s.total) FROM sales s
                   WHERE s."customerId" = "Customer"."id" AND s.status <> 'REVERSED'), 0)
      - COALESCE((SELECT SUM(r."refundAmount") FROM sale_returns r
                    JOIN sales s ON s.id = r."saleId"
                   WHERE s."customerId" = "Customer"."id" AND s.status <> 'REVERSED'), 0)
    AS BIGINT)
)`;

const CUSTOMER_PURCHASE_COUNT = `(
    SELECT CAST(COUNT(*) AS INTEGER) FROM sales s
     WHERE s."customerId" = "Customer"."id" AND s.status <> 'REVERSED'
)`;

const CUSTOMER_LAST_PURCHASE = `(
    SELECT MAX(s."createdAt") FROM sales s
     WHERE s."customerId" = "Customer"."id" AND s.status <> 'REVERSED'
)`;

export const listCustomersService = async (
    query: CustomerListQuery,
    callback: (data: CustomerResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.isActive !== undefined) where.isActive = query.isActive === "true";
        // "Who owes us money" is the question this list is usually asked.
        if (query.owing === "true") where.balance = { [Op.gt]: 0 };

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [{ name: { [Op.iLike]: term } }, { phone: { [Op.iLike]: term } }];
        }

        const direction = query.sortDir === "desc" ? "DESC" : "ASC";

        // Spending is read from the sales themselves rather than kept as a
        // running total that could drift from them. Subqueries keep it to one
        // round trip per page, and sorting by them happens in the database, so
        // "biggest spenders" is right across every page, not just this one.
        const order: Order =
            query.sortBy === "balance"
                ? [["balance", direction]]
                : query.sortBy === "totalSpent"
                  ? [[literal('"totalSpent"'), direction]]
                  : query.sortBy === "purchaseCount"
                    ? [[literal('"purchaseCount"'), direction]]
                    : query.sortBy === "lastPurchaseAt"
                      ? [literal(`"lastPurchaseAt" ${direction} NULLS LAST`)]
                      : [["name", direction]];

        const { rows, count } = await Customer.findAndCountAll({
            where,
            attributes: {
                include: [
                    [literal(CUSTOMER_TOTAL_SPENT), "totalSpent"],
                    [literal(CUSTOMER_PURCHASE_COUNT), "purchaseCount"],
                    [literal(CUSTOMER_LAST_PURCHASE), "lastPurchaseAt"],
                ],
            },
            order,
            limit,
            offset,
        });

        return callback(
            messageHandler("Customers retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading customers.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getCustomerService = async (id: string, callback: (data: CustomerResponse) => void) => {
    try {
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return callback(messageHandler("Customer not found.", false, NOT_FOUND, {}));
        }

        return callback(messageHandler("Customer retrieved", true, SUCCESS, customer));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the customer.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getCustomerLedgerService = async (
    id: string,
    query: CustomerListQuery,
    callback: (data: CustomerResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const customer = await Customer.findByPk(id);
        if (!customer) {
            return callback(messageHandler("Customer not found.", false, NOT_FOUND, {}));
        }

        const { rows, count } = await CustomerLedgerEntry.findAndCountAll({
            where: { customerId: id },
            order: [["createdAt", "DESC"]],
            limit,
            offset,
        });

        return callback(
            messageHandler("Ledger retrieved", true, SUCCESS, {
                customer,
                entries: buildPaginated(rows, count, page, pageSize),
            })
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the ledger.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const createCustomerService = async (
    input: CustomerInput,
    user: AuthenticatedUser,
    callback: (data: CustomerResponse) => void
) => {
    try {
        const customer = await Customer.create({
            name: input.name.trim(),
            phone: input.phone?.trim() || null,
            note: input.note?.trim() || null,
            balance: 0,
            isActive: true,
        });

        await recordAudit({
            userId: user.id,
            userName: user.name,
            action: "CUSTOMER_CREATED",
            entityType: "CUSTOMER",
            entityId: customer.id,
            newValue: { name: customer.name, phone: customer.phone },
        });

        return callback(messageHandler("Customer created", true, SUCCESS, customer));
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the customer.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const updateCustomerService = async (
    id: string,
    input: CustomerInput,
    user: AuthenticatedUser,
    callback: (data: CustomerResponse) => void
) => {
    try {
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return callback(messageHandler("Customer not found.", false, NOT_FOUND, {}));
        }

        const before = { name: customer.name, phone: customer.phone };

        // Deliberately not updatable here: the balance. It only ever moves
        // through moveCustomerBalance, so every change leaves a ledger entry.
        await customer.update({
            name: input.name.trim(),
            phone: input.phone?.trim() || null,
            note: input.note?.trim() || null,
            ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
        });

        await recordAudit({
            userId: user.id,
            userName: user.name,
            action: "CUSTOMER_UPDATED",
            entityType: "CUSTOMER",
            entityId: customer.id,
            oldValue: before,
            newValue: { name: customer.name, phone: customer.phone },
        });

        return callback(messageHandler("Customer updated", true, SUCCESS, customer));
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the customer.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/** Money handed over against what is owed, outside of any sale. */
export const recordRepaymentService = async (
    id: string,
    input: RepaymentInput,
    user: AuthenticatedUser,
    callback: (data: CustomerResponse) => void
) => {
    const transaction = await sequelize.transaction();

    try {
        if (!Number.isInteger(input.amount) || input.amount <= 0) {
            await transaction.rollback();
            return callback(messageHandler("Enter an amount to record.", false, BAD_REQUEST, {}));
        }

        const customer = await Customer.findByPk(id, { transaction });
        if (!customer) {
            await transaction.rollback();
            return callback(messageHandler("Customer not found.", false, NOT_FOUND, {}));
        }

        // Paying more than is owed would leave a negative balance — credit the
        // pharmacy then has to honour. Allowed, but it must be deliberate.
        if (input.amount > customer.balance && !input.allowOverpayment) {
            await transaction.rollback();
            return callback(
                messageHandler(
                    `That is more than ${customer.name} owes (${customer.balance / 100} naira). Confirm to record the difference as credit.`,
                    false,
                    BAD_REQUEST,
                    { code: "OVERPAYMENT", owed: customer.balance, offered: input.amount }
                )
            );
        }

        const entry = await moveCustomerBalance(
            {
                customerId: id,
                entryType: "REPAYMENT",
                amount: -input.amount,
                reason: input.reason?.trim() || null,
                user,
            },
            transaction
        );

        await recordAudit(
            {
                userId: user.id,
                userName: user.name,
                action: "CUSTOMER_REPAYMENT",
                entityType: "CUSTOMER",
                entityId: id,
                oldValue: { balance: entry.balanceBefore },
                newValue: { balance: entry.balanceAfter, amount: input.amount },
            },
            transaction
        );

        await transaction.commit();

        const updated = await Customer.findByPk(id);

        return callback(messageHandler("Repayment recorded", true, SUCCESS, { customer: updated, entry }));
    } catch (error: any) {
        await transaction.rollback();
        console.log("Repayment failed:", error?.message);
        return callback(
            messageHandler("An error occured while recording the repayment.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/**
 * How a customer buys: how much, how often, what, and how they pay.
 *
 * Only named accounts can be tracked — a walk-in leaves no identity on the
 * sale — so this is the picture of the pharmacy's regulars. Every figure comes
 * from the sales themselves, net of returns, so it cannot disagree with them.
 */
export const getCustomerInsightsService = async (
    id: string,
    callback: (data: CustomerResponse) => void
) => {
    try {
        const customer = await Customer.findByPk(id);
        if (!customer) {
            return callback(messageHandler("Customer not found.", false, NOT_FOUND, {}));
        }

        const sales = await Sale.findAll({
            where: { customerId: id, status: { [Op.ne]: "REVERSED" } },
            include: [
                { model: SaleItem, as: "items" },
                { model: SaleReturn, as: "returns" },
            ],
            order: [["createdAt", "DESC"]],
        });

        const refundedOn = (sale: Sale) =>
            (sale.returns ?? []).reduce((total, refund) => total + refund.refundAmount, 0);
        const keptValue = (sale: Sale) => Math.max(sale.total - refundedOn(sale), 0);

        const totalSpent = sales.reduce((total, sale) => total + keptValue(sale), 0);
        const purchaseCount = sales.length;

        // What they keep coming back for — counted in base units and net of
        // anything they brought back.
        const byProduct = new Map<
            string,
            { productId: string; productName: string; quantity: number; total: number; sales: Set<string> }
        >();
        for (const sale of sales) {
            for (const item of sale.items ?? []) {
                const kept = item.quantity - item.returnedQuantity;
                if (kept <= 0) continue;
                const habit = byProduct.get(item.productId) ?? {
                    productId: item.productId,
                    productName: item.productName,
                    quantity: 0,
                    total: 0,
                    sales: new Set<string>(),
                };
                habit.quantity += kept * item.unitsPerSaleUnit;
                habit.total += kept * item.unitPrice;
                habit.sales.add(sale.id);
                byProduct.set(item.productId, habit);
            }
        }

        const topProducts = [...byProduct.values()]
            .map(({ sales: containing, ...habit }) => ({ ...habit, purchases: containing.size }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);

        // The last six calendar months in the pharmacy's timezone, quiet months
        // included, so a regular who has stopped coming shows as a gap.
        const months: string[] = [];
        let [year, month] = today().slice(0, 7).split("-").map(Number);
        for (let i = 0; i < 6; i += 1) {
            months.unshift(`${year}-${String(month).padStart(2, "0")}`);
            month -= 1;
            if (month === 0) {
                month = 12;
                year -= 1;
            }
        }
        const byMonth = new Map(months.map((key) => [key, { total: 0, purchases: 0 }]));
        for (const sale of sales) {
            const bucket = byMonth.get(toDateOnly(sale.createdAt).slice(0, 7));
            if (!bucket) continue;
            bucket.total += keptValue(sale);
            bucket.purchases += 1;
        }

        const methodCounts = new Map<string, number>();
        for (const sale of sales) {
            methodCounts.set(sale.paymentMethod, (methodCounts.get(sale.paymentMethod) ?? 0) + 1);
        }
        const preferredPaymentMethod =
            [...methodCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        const first = sales[sales.length - 1];
        const last = sales[0];

        const insights: CustomerInsights = {
            totalSpent,
            purchaseCount,
            averageBasket: purchaseCount > 0 ? Math.floor(totalSpent / purchaseCount) : 0,
            firstPurchaseAt: first?.createdAt ?? null,
            lastPurchaseAt: last?.createdAt ?? null,
            averageDaysBetweenPurchases:
                purchaseCount >= 2
                    ? Math.round(
                          daysBetween(toDateOnly(first.createdAt), toDateOnly(last.createdAt)) /
                              (purchaseCount - 1)
                      )
                    : null,
            preferredPaymentMethod,
            takenOnAccount: sales.reduce((total, sale) => total + sale.debtCharged, 0),
            topProducts,
            monthly: months.map((key) => ({ month: key, ...byMonth.get(key)! })),
            recentSales: sales.slice(0, 8).map((sale) => ({
                id: sale.id,
                receiptNumber: sale.receiptNumber,
                total: sale.total,
                refunded: refundedOn(sale),
                paymentMethod: sale.paymentMethod,
                status: sale.status,
                itemCount: (sale.items ?? []).reduce((total, item) => total + item.quantity, 0),
                createdAt: sale.createdAt,
            })),
        };

        return callback(messageHandler("Customer insights retrieved", true, SUCCESS, { customer, ...insights }));
    } catch (error: any) {
        console.log("Customer insights failed:", error?.message);
        return callback(
            messageHandler("An error occured while loading the customer's history.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
