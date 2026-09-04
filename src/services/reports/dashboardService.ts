import { Op } from "sequelize";
import Sale from "../../schemas/sales/saleSchema.js";
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

        const [inventory, todayFigures, yesterdayFigures] = await Promise.all([
            buildInventorySummary(),
            takingsFor(day),
            takingsFor(yesterday),
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
            })
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the dashboard.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
