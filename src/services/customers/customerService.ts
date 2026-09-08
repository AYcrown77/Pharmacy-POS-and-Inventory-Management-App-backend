import { Op, Transaction } from "sequelize";
import sequelize from "../../database/db.js";
import Customer from "../../schemas/customers/customerSchema.js";
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

        const { rows, count } = await Customer.findAndCountAll({
            where,
            order: [[query.sortBy === "balance" ? "balance" : "name", query.sortDir === "desc" ? "DESC" : "ASC"]],
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
