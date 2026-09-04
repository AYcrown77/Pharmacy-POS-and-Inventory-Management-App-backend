import AuditLog, { AuditAction } from "../../schemas/system/auditLogSchema.js";
import { Op, Transaction } from "sequelize";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import { dateOnlyRangeToInstants, isValidDateOnly } from "../../utils/date.js";
import { INTERNAL_SERVER_ERROR, SUCCESS } from "../../constants/statusCode.js";
import { AuditListQuery, UserResponse } from "../../types/users/user.js";

export interface RecordAuditInput {
    userId: string;
    userName: string;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    oldValue?: Record<string, unknown> | null;
    newValue?: Record<string, unknown> | null;
}

/**
 * Writes one audit entry.
 *
 * Every service that changes something calls this. It accepts the surrounding
 * transaction so the trail commits or rolls back with the change it records —
 * an audit row describing a sale that never happened would be worse than none.
 *
 * Auditing must never be the reason a valid operation fails, so a failure to
 * write the entry is logged and swallowed rather than thrown.
 */
export const recordAudit = async (data: RecordAuditInput, transaction?: Transaction) => {
    try {
        return await AuditLog.create(
            {
                userId: data.userId,
                userName: data.userName,
                action: data.action,
                entityType: data.entityType,
                entityId: data.entityId ?? null,
                oldValue: data.oldValue ?? null,
                newValue: data.newValue ?? null,
            },
            { transaction }
        );
    } catch (error: any) {
        console.log("Unable to write audit entry:", error.message);
        return null;
    }
};

/**
 * Reads the trail.
 *
 * Read-only by design: there is no update or delete anywhere in this module.
 * An audit log that can be rewritten is not an audit log.
 */
export const listAuditService = async (
    query: AuditListQuery,
    callback: (data: UserResponse) => void
) => {
    try {
        const { page, pageSize, limit, offset } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.userId) where.userId = query.userId;
        if (query.action) where.action = query.action;
        if (query.entityType) where.entityType = query.entityType;

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [
                { userName: { [Op.iLike]: term } },
                { entityType: { [Op.iLike]: term } },
                { entityId: { [Op.iLike]: term } },
            ];
        }

        if (isValidDateOnly(query.from) && isValidDateOnly(query.to)) {
            const { start, end } = dateOnlyRangeToInstants(query.from, query.to);
            where.createdAt = { [Op.gte]: start, [Op.lt]: end };
        }

        const { rows, count } = await AuditLog.findAndCountAll({
            where,
            order: [["createdAt", query.sortDir === "asc" ? "ASC" : "DESC"]],
            limit,
            offset,
        });

        return callback(
            messageHandler("Audit trail retrieved", true, SUCCESS, buildPaginated(rows, count, page, pageSize))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the audit trail.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

/** Distinct entity types present, for the filter dropdown. */
export const listAuditEntityTypesService = async (callback: (data: UserResponse) => void) => {
    try {
        const rows = (await AuditLog.findAll({
            attributes: ["entityType"],
            group: ["entityType"],
            order: [["entityType", "ASC"]],
            raw: true,
        })) as unknown as Array<{ entityType: string }>;

        return callback(
            messageHandler("Entity types retrieved", true, SUCCESS, rows.map((row) => row.entityType))
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading entity types.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
