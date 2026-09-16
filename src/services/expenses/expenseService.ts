import { Op, WhereOptions } from "sequelize";
import sequelize from "../../database/db.js";
import Expense, {
    EXPENSE_CATEGORIES,
    ExpenseCategory,
} from "../../schemas/expenses/expenseSchema.js";
import { PaymentMethod } from "../../schemas/sales/saleSchema.js";
import { recordAudit } from "../system/auditService.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import { isValidDateOnly, today } from "../../utils/date.js";
import {
    BAD_REQUEST,
    CONFLICT,
    INTERNAL_SERVER_ERROR,
    NOT_FOUND,
    SUCCESS,
} from "../../constants/statusCode.js";
import {
    ExpenseInput,
    ExpenseListQuery,
    ExpenseResponse,
    ExpenseSummary,
    VoidExpenseInput,
} from "../../types/expenses/expense.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

/**
 * What was spent over a period.
 *
 * Counted on the day the money went out, not the day it was typed in, and a
 * voided expense counts for nothing. Used by the sales report, which deducts
 * this from the day's takings.
 */
export const summarizeExpenses = async (filters: {
    from: string;
    to: string;
    recordedById?: string;
    paymentMethod?: PaymentMethod;
}): Promise<ExpenseSummary> => {
    const where: Record<string, unknown> = {
        status: "RECORDED",
        expenseDate: { [Op.between]: [filters.from, filters.to] },
    };
    if (filters.recordedById) where.recordedById = filters.recordedById;
    if (filters.paymentMethod) where.paymentMethod = filters.paymentMethod;

    const expenses = await Expense.findAll({
        where: where as WhereOptions,
        attributes: ["category", "amount"],
    });

    const byCategory = new Map<ExpenseCategory, { total: number; count: number }>();
    for (const expense of expenses) {
        const entry = byCategory.get(expense.category) ?? { total: 0, count: 0 };
        entry.total += expense.amount;
        entry.count += 1;
        byCategory.set(expense.category, entry);
    }

    return {
        total: expenses.reduce((total, expense) => total + expense.amount, 0),
        count: expenses.length,
        byCategory: EXPENSE_CATEGORIES.filter((category) => byCategory.has(category))
            .map((category) => ({ category, ...byCategory.get(category)! }))
            .sort((a, b) => b.total - a.total),
    };
};

export const listExpensesService = async (
    query: ExpenseListQuery,
    user: AuthenticatedUser,
    callback: (data: ExpenseResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (isValidDateOnly(query.from) && isValidDateOnly(query.to)) {
            where.expenseDate = { [Op.between]: [query.from, query.to] };
        }
        if (query.category) where.category = query.category;
        if (query.status) where.status = query.status;
        if (query.search?.trim()) where.reason = { [Op.iLike]: `%${query.search.trim()}%` };

        // A cashier sees what they recorded; an administrator sees everything.
        // As with sales, hiding it in the UI is not the same as not sending it.
        if (user.role !== "ADMINISTRATOR") {
            where.recordedById = user.id;
        } else if (query.recordedById) {
            where.recordedById = query.recordedById;
        }

        const direction = query.sortDir === "asc" ? "ASC" : "DESC";

        const { rows, count } = await Expense.findAndCountAll({
            where: where as WhereOptions,
            order: [
                ["expenseDate", direction],
                ["createdAt", direction],
            ],
            limit,
            offset,
        });

        return callback(
            messageHandler("Expenses retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading expenses.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const recordExpenseService = async (
    input: ExpenseInput,
    user: AuthenticatedUser,
    callback: (data: ExpenseResponse) => void
) => {
    const transaction = await sequelize.transaction();

    try {
        const expenseDate = input.expenseDate ? input.expenseDate.slice(0, 10) : today();
        const reason = input.reason?.trim() ?? "";

        if (!isValidDateOnly(expenseDate)) {
            await transaction.rollback();
            return callback(messageHandler("Enter a valid date.", false, BAD_REQUEST, {}));
        }

        // Dated ahead, it would quietly come off a day that has not happened.
        if (expenseDate > today()) {
            await transaction.rollback();
            return callback(
                messageHandler("An expense cannot be dated in the future.", false, BAD_REQUEST, {})
            );
        }

        if (!Number.isInteger(input.amount) || input.amount <= 0) {
            await transaction.rollback();
            return callback(messageHandler("Enter an amount greater than zero.", false, BAD_REQUEST, {}));
        }

        if (reason.length < 3) {
            await transaction.rollback();
            return callback(messageHandler("Say what the money was for.", false, BAD_REQUEST, {}));
        }

        const expense = await Expense.create(
            {
                expenseDate,
                category: input.category,
                amount: input.amount,
                paymentMethod: input.paymentMethod ?? "CASH",
                reason,
                recordedById: user.id,
                recordedByName: user.name,
            },
            { transaction }
        );

        await recordAudit(
            {
                userId: user.id,
                userName: user.name,
                action: "EXPENSE_RECORDED",
                entityType: "EXPENSE",
                entityId: expense.id,
                newValue: {
                    expenseDate,
                    category: expense.category,
                    amount: expense.amount,
                    paymentMethod: expense.paymentMethod,
                    reason,
                },
            },
            transaction
        );

        await transaction.commit();

        return callback(messageHandler("Expense recorded", true, SUCCESS, expense));
    } catch (error: any) {
        await transaction.rollback();
        console.log("Recording an expense failed:", error?.message);
        return callback(
            messageHandler("An error occured while recording the expense.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/**
 * Withdraws an expense recorded in error.
 *
 * Voided rather than deleted, so the report for that day changes and the
 * audit trail still shows the entry, who withdrew it and why.
 */
export const voidExpenseService = async (
    id: string,
    input: VoidExpenseInput,
    user: AuthenticatedUser,
    callback: (data: ExpenseResponse) => void
) => {
    const transaction = await sequelize.transaction();

    try {
        const reason = input.reason?.trim() ?? "";

        const expense = await Expense.findByPk(id, { lock: transaction.LOCK.UPDATE, transaction });

        if (!expense) {
            await transaction.rollback();
            return callback(messageHandler("Expense not found.", false, NOT_FOUND, {}));
        }

        if (expense.status === "VOIDED") {
            await transaction.rollback();
            return callback(messageHandler("This expense has already been voided.", false, CONFLICT, {}));
        }

        if (reason.length < 3) {
            await transaction.rollback();
            return callback(messageHandler("Say why this expense is being voided.", false, BAD_REQUEST, {}));
        }

        await expense.update(
            {
                status: "VOIDED",
                voidReason: reason,
                voidedById: user.id,
                voidedByName: user.name,
                voidedAt: new Date(),
            },
            { transaction }
        );

        await recordAudit(
            {
                userId: user.id,
                userName: user.name,
                action: "EXPENSE_VOIDED",
                entityType: "EXPENSE",
                entityId: expense.id,
                oldValue: { status: "RECORDED", amount: expense.amount, reason: expense.reason },
                newValue: { status: "VOIDED", voidReason: reason },
            },
            transaction
        );

        await transaction.commit();

        return callback(messageHandler("Expense voided", true, SUCCESS, expense));
    } catch (error: any) {
        await transaction.rollback();
        console.log("Voiding an expense failed:", error?.message);
        return callback(
            messageHandler("An error occured while voiding the expense.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/**
 * What was spent over a period, for the expenses page.
 *
 * Open to both roles — cashiers cannot read the sales report — and scoped the
 * same way as the list: a cashier's total is what they paid out themselves.
 */
export const getExpenseSummaryService = async (
    query: ExpenseListQuery,
    user: AuthenticatedUser,
    callback: (data: ExpenseResponse) => void
) => {
    try {
        const start = isValidDateOnly(query.from) ? query.from : today();
        const end = isValidDateOnly(query.to) ? query.to : start;

        const summary = await summarizeExpenses({
            from: start <= end ? start : end,
            to: start <= end ? end : start,
            recordedById: user.role !== "ADMINISTRATOR" ? user.id : query.recordedById,
        });

        return callback(messageHandler("Expense summary retrieved", true, SUCCESS, summary));
    } catch (error) {
        return callback(
            messageHandler("An error occured while summarising expenses.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
