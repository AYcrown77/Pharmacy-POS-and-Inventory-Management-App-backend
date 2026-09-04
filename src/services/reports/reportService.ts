import { Op, WhereOptions } from "sequelize";
import Sale, { PAYMENT_METHODS, PaymentMethod } from "../../schemas/sales/saleSchema.js";
import SaleReturn from "../../schemas/sales/saleReturnSchema.js";
import StockMovement from "../../schemas/inventory/stockMovementSchema.js";
import { messageHandler } from "../../utils/index.js";
import { addDays, dateOnlyRangeToInstants, isValidDateOnly, toDateOnly, today } from "../../utils/date.js";
import { INTERNAL_SERVER_ERROR, SUCCESS } from "../../constants/statusCode.js";
import {
    CashierReportRow,
    MovementReportQuery,
    MovementReportSummary,
    PaymentMixEntry,
    ReportResponse,
    SalesReportQuery,
    SalesReportSummary,
    SalesTrendPoint,
} from "../../types/reports/report.js";

/**
 * Report aggregates.
 *
 * Every figure here is computed across the whole period, never across a page
 * of rows — a report that totalled one page would silently understate itself
 * the moment the period grew past twenty sales.
 *
 * A fully reversed sale contributed nothing and is excluded from takings
 * everywhere in this module. A partially returned one still counts at its
 * original total, with the refund shown separately against it.
 */

const axisLabel = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" });

const formatAxisLabel = (date: string) => axisLabel.format(new Date(`${date}T12:00:00Z`));

/** Falls back to today when a range is missing or malformed. */
const resolveRange = (from?: string, to?: string) => {
    const start = isValidDateOnly(from) ? from : today();
    const end = isValidDateOnly(to) ? to : start;
    return start <= end ? { from: start, to: end } : { from: end, to: start };
};

const billableSalesWhere = (query: SalesReportQuery): WhereOptions => {
    const { from, to } = resolveRange(query.from, query.to);
    const { start, end } = dateOnlyRangeToInstants(from, to);

    const where: Record<string | symbol, unknown> = {
        status: { [Op.ne]: "REVERSED" },
        createdAt: { [Op.gte]: start, [Op.lt]: end },
    };

    if (query.cashierId) where.cashierId = query.cashierId;
    if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

    return where as WhereOptions;
};

const buildPaymentMix = (sales: Sale[]): PaymentMixEntry[] => {
    const grossSales = sales.reduce((total, sale) => total + sale.total, 0);

    return PAYMENT_METHODS.map((method) => {
        const matching = sales.filter((sale) => sale.paymentMethod === method);
        const total = matching.reduce((sum, sale) => sum + sale.total, 0);

        return {
            method,
            total,
            transactions: matching.length,
            // Guarded: a period with no takings would otherwise divide by zero
            // and put NaN on the chart.
            share: grossSales > 0 ? total / grossSales : 0,
        };
    });
};

export const getSalesSummaryService = async (
    query: SalesReportQuery,
    callback: (data: ReportResponse) => void
) => {
    try {
        const { from, to } = resolveRange(query.from, query.to);
        const { start, end } = dateOnlyRangeToInstants(from, to);

        const sales = await Sale.findAll({ where: billableSalesWhere(query) });

        const grossSales = sales.reduce((total, sale) => total + sale.total, 0);

        const refunds = await SaleReturn.findAll({
            where: { createdAt: { [Op.gte]: start, [Op.lt]: end } },
        });

        const summary: SalesReportSummary = {
            grossSales,
            transactionCount: sales.length,
            // Integer kobo throughout, so the average is floored rather than
            // left as a fraction of a kobo that cannot exist.
            averageSale: sales.length > 0 ? Math.floor(grossSales / sales.length) : 0,
            byMethod: buildPaymentMix(sales),
            refundedAmount: refunds.reduce((total, refund) => total + refund.refundAmount, 0),
            refundCount: refunds.length,
        };

        return callback(messageHandler("Sales summary retrieved", true, SUCCESS, summary));
    } catch (error) {
        return callback(
            messageHandler("An error occured while summarising sales.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/**
 * Builds one point per calendar day across a range.
 *
 * Days with no sales are emitted as zero rather than omitted, so the chart
 * shows a quiet Sunday as a gap in takings rather than closing it up and
 * making the week look busier than it was.
 */
const buildTrend = async (from: string, to: string, extra: WhereOptions = {}): Promise<SalesTrendPoint[]> => {
    const { start, end } = dateOnlyRangeToInstants(from, to);

    const sales = await Sale.findAll({
        where: {
            status: { [Op.ne]: "REVERSED" },
            createdAt: { [Op.gte]: start, [Op.lt]: end },
            ...extra,
        } as WhereOptions,
    });

    const byDay = new Map<string, { total: number; transactions: number }>();

    for (const sale of sales) {
        const day = toDateOnly(sale.createdAt);
        const entry = byDay.get(day) ?? { total: 0, transactions: 0 };
        entry.total += sale.total;
        entry.transactions += 1;
        byDay.set(day, entry);
    }

    const points: SalesTrendPoint[] = [];
    for (let day = from; day <= to; day = addDays(day, 1)) {
        const entry = byDay.get(day) ?? { total: 0, transactions: 0 };
        points.push({
            date: day,
            label: formatAxisLabel(day),
            total: entry.total,
            transactions: entry.transactions,
        });
    }

    return points;
};

export const getSalesTrendService = async (
    query: SalesReportQuery,
    callback: (data: ReportResponse) => void
) => {
    try {
        const { from, to } = resolveRange(query.from, query.to);

        const extra: Record<string, unknown> = {};
        if (query.cashierId) extra.cashierId = query.cashierId;
        if (query.paymentMethod) extra.paymentMethod = query.paymentMethod;

        const points = await buildTrend(from, to, extra as WhereOptions);

        return callback(messageHandler("Sales trend retrieved", true, SUCCESS, points));
    } catch (error) {
        return callback(
            messageHandler("An error occured while building the trend.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/** The dashboard's trend, expressed as "the last N days ending today". */
export const getDashboardTrendService = async (
    days: number,
    callback: (data: ReportResponse) => void
) => {
    try {
        const to = today();
        const from = addDays(to, -(Math.max(days, 1) - 1));

        const points = await buildTrend(from, to);

        return callback(messageHandler("Sales trend retrieved", true, SUCCESS, points));
    } catch (error) {
        return callback(
            messageHandler("An error occured while building the trend.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getPaymentMixService = async (days: number, callback: (data: ReportResponse) => void) => {
    try {
        const to = today();
        const from = addDays(to, -(Math.max(days, 1) - 1));
        const { start, end } = dateOnlyRangeToInstants(from, to);

        const sales = await Sale.findAll({
            where: {
                status: { [Op.ne]: "REVERSED" },
                createdAt: { [Op.gte]: start, [Op.lt]: end },
            },
        });

        return callback(messageHandler("Payment mix retrieved", true, SUCCESS, buildPaymentMix(sales)));
    } catch (error) {
        return callback(
            messageHandler("An error occured while building the payment mix.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getCashierReportService = async (
    query: SalesReportQuery,
    callback: (data: ReportResponse) => void
) => {
    try {
        const { from, to } = resolveRange(query.from, query.to);
        const { start, end } = dateOnlyRangeToInstants(from, to);

        const sales = await Sale.findAll({
            where: {
                status: { [Op.ne]: "REVERSED" },
                createdAt: { [Op.gte]: start, [Op.lt]: end },
            },
        });

        const byCashier = new Map<string, CashierReportRow>();

        const bucket: Record<PaymentMethod, keyof CashierReportRow> = {
            CASH: "cashSales",
            CARD: "cardSales",
            TRANSFER: "transferSales",
        };

        for (const sale of sales) {
            let row = byCashier.get(sale.cashierId);

            if (!row) {
                row = {
                    cashierId: sale.cashierId,
                    cashierName: sale.cashierName,
                    transactions: 0,
                    cashSales: 0,
                    cardSales: 0,
                    transferSales: 0,
                    totalSales: 0,
                    averageSale: 0,
                };
                byCashier.set(sale.cashierId, row);
            }

            row.transactions += 1;
            row.totalSales += sale.total;
            (row[bucket[sale.paymentMethod]] as number) += sale.total;
        }

        const rows = [...byCashier.values()]
            .map((row) => ({
                ...row,
                averageSale: row.transactions > 0 ? Math.floor(row.totalSales / row.transactions) : 0,
            }))
            .sort((a, b) => b.totalSales - a.totalSales);

        return callback(messageHandler("Cashier report retrieved", true, SUCCESS, rows));
    } catch (error) {
        return callback(
            messageHandler("An error occured while building the cashier report.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getMovementSummaryService = async (
    query: MovementReportQuery,
    callback: (data: ReportResponse) => void
) => {
    try {
        const where: Record<string | symbol, unknown> = {};

        if (query.productId) where.productId = query.productId;
        if (query.movementType) where.movementType = query.movementType;
        if (query.userId) where.userId = query.userId;

        if (isValidDateOnly(query.from) && isValidDateOnly(query.to)) {
            const { start, end } = dateOnlyRangeToInstants(query.from, query.to);
            where.createdAt = { [Op.gte]: start, [Op.lt]: end };
        }

        const movements = await StockMovement.findAll({
            where: where as WhereOptions,
            attributes: ["quantity"],
        });

        // Quantity is signed, so in and out are simply its two halves.
        const unitsIn = movements
            .filter((movement) => movement.quantity > 0)
            .reduce((total, movement) => total + movement.quantity, 0);
        const unitsOut = movements
            .filter((movement) => movement.quantity < 0)
            .reduce((total, movement) => total + Math.abs(movement.quantity), 0);

        const summary: MovementReportSummary = {
            movementCount: movements.length,
            unitsIn,
            unitsOut,
            netUnits: unitsIn - unitsOut,
        };

        return callback(messageHandler("Movement summary retrieved", true, SUCCESS, summary));
    } catch (error) {
        return callback(
            messageHandler("An error occured while summarising movements.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
