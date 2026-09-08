import { Op } from "sequelize";
import Sale from "../../schemas/sales/saleSchema.js";
import Customer from "../../schemas/customers/customerSchema.js";
import { fn, col } from "sequelize";
import { buildInventorySummary } from "../inventory/inventoryService.js";
import { messageHandler } from "../../utils/index.js";
import { addDays, dateOnlyRangeToInstants, today } from "../../utils/date.js";
import { INTERNAL_SERVER_ERROR, SUCCESS } from "../../constants/statusCode.js";
import { ReportResponse } from "../../types/reports/report.js";

/** Takings for one calendar day, excluding sales that were fully reversed. */
const takingsFor = async (day: string) => {
    const { start, end } = dateOnlyRangeToInstants(day, day);

    const sales = await Sale.findAll({
        where: {
            status: { [Op.ne]: "REVERSED" },
            createdAt: { [Op.gte]: start, [Op.lt]: end },
        },
    });

    return {
        total: sales.reduce((sum, sale) => sum + sale.total, 0),
        count: sales.length,
    };
};

export const getDashboardSummaryService = async (callback: (data: ReportResponse) => void) => {
    try {
        const day = today();
        const yesterday = addDays(day, -1);

        const [inventory, todayFigures, yesterdayFigures, debt] = await Promise.all([
            buildInventorySummary(),
            takingsFor(day),
            takingsFor(yesterday),
            // Money already handed over as goods and not yet paid for. It sits
            // beside takings because it is the other half of the day's money:
            // what came in, and what is still out there.
            (async () => {
                const row = (await Customer.findOne({
                    attributes: [
                        [fn("COALESCE", fn("SUM", col("balance")), 0), "totalOwed"],
                        [fn("COUNT", col("id")), "accountsOwing"],
                    ],
                    where: { balance: { [Op.gt]: 0 } },
                    raw: true,
                })) as unknown as { totalOwed: string; accountsOwing: string } | null;

                return {
                    totalOwed: Number(row?.totalOwed ?? 0),
                    accountsOwing: Number(row?.accountsOwing ?? 0),
                };
            })(),
        ]);

        return callback(
            messageHandler("Dashboard summary retrieved", true, SUCCESS, {
                todaySales: todayFigures.total,
                todayTransactions: todayFigures.count,
                todayAverageSale:
                    todayFigures.count > 0 ? Math.floor(todayFigures.total / todayFigures.count) : 0,
                // Null rather than zero when yesterday took nothing: "no change"
                // and "nothing to compare against" are different statements, and
                // the card reads differently for each.
                salesChangePercent:
                    yesterdayFigures.total > 0
                        ? ((todayFigures.total - yesterdayFigures.total) / yesterdayFigures.total) * 100
                        : null,
                inventory,
                debt,
            })
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the dashboard.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
