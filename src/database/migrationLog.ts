import { QueryTypes, Transaction } from "sequelize";
import sequelize from "./db.js";

/**
 * A record of data migrations that have already run.
 *
 * A schema change can usually tell whether it has been applied by looking at
 * the schema: the column exists or it does not. A data conversion cannot.
 * Once prices have been divided by pack size nothing in the table says so, and
 * running the step again would divide them a second time. Those steps are
 * recorded here by name instead, and skipped once recorded.
 */

/** Tier prices moved from per-pack to per-base-unit. */
export const UNIT_PRICE_MIGRATION = "products: tier prices per base unit";

export const ensureMigrationLog = async (): Promise<void> => {
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(200) PRIMARY KEY,
            "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);
};

export const hasMigrationRun = async (name: string): Promise<boolean> => {
    await ensureMigrationLog();
    const rows = await sequelize.query<{ name: string }>(
        "SELECT name FROM schema_migrations WHERE name = :name",
        { type: QueryTypes.SELECT, replacements: { name } }
    );
    return rows.length > 0;
};

/**
 * Records a step as done. Pass the step's own transaction, so the record and
 * the change it describes commit together — a conversion that rolled back must
 * not be remembered as applied.
 */
export const markMigrationRun = async (name: string, transaction?: Transaction): Promise<void> => {
    await sequelize.query(
        "INSERT INTO schema_migrations (name) VALUES (:name) ON CONFLICT (name) DO NOTHING",
        { replacements: { name }, transaction }
    );
};
