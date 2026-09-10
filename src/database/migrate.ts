import dotenv from "dotenv";
import { QueryTypes } from "sequelize";
import sequelize, { connectToDB } from "./db.js";
import "../schemas/index.js";
import {
    ensureMigrationLog,
    hasMigrationRun,
    markMigrationRun,
    UNIT_PRICE_MIGRATION,
} from "./migrationLog.js";

dotenv.config();

/**
 * Schema changes that `sequelize.sync()` cannot make on its own.
 *
 * `sync()` creates tables that do not exist yet, but it will not add a column
 * to a table that does — so a new field appears on a fresh database and is
 * silently missing on the pharmacy's live one, which is the worst of both.
 * These statements close that gap.
 *
 * Every step is idempotent and safe to re-run: the script is the way to bring
 * any database, fresh or years old, up to the current schema without losing a
 * single sale.
 */

interface Step {
    name: string;
    /**
     * Skips the step when it has already been applied.
     *
     * Statements like `ADD COLUMN IF NOT EXISTS` are re-runnable on their own,
     * but a backfill that reads the old column is not: once the column is
     * dropped, re-running the step fails on a database that is already
     * correct. A migration you cannot run twice is a migration you cannot
     * safely retry after a half-finished deploy.
     */
    appliesWhen?: () => Promise<boolean>;
    /**
     * For data conversions, which leave no mark in the schema: the step is
     * recorded under this name when it commits and skipped once recorded.
     */
    track?: string;
    sql: string[];
}

/** True when a postgres enum type already has the given label. */
const enumHasValue = async (typeName: string, label: string): Promise<boolean> => {
    const rows = await sequelize.query<{ exists: boolean }>(
        `SELECT EXISTS (
            SELECT 1 FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid
             WHERE t.typname = :typeName AND e.enumlabel = :label
         ) AS exists`,
        { type: QueryTypes.SELECT, replacements: { typeName, label } }
    );
    return Boolean(rows[0]?.exists);
};

/** True when a table still has the named column. */
const hasColumn = async (table: string, column: string): Promise<boolean> => {
    const rows = await sequelize.query<{ exists: boolean }>(
        `SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
             WHERE table_name = :table AND column_name = :column
         ) AS exists`,
        { type: QueryTypes.SELECT, replacements: { table, column } }
    );
    return Boolean(rows[0]?.exists);
};

const steps: Step[] = [
    {
        name: "products: three price tiers",
        appliesWhen: () => hasColumn("products", "sellingPrice"),
        sql: [
            // Added nullable first so the ALTER succeeds on a table that
            // already has rows; backfilled and made NOT NULL below.
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS "priceWholesale" BIGINT`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS "priceRetail" BIGINT`,
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS "priceConsumer" BIGINT`,

            // The old single price was the walk-in price, so it becomes the
            // consumer tier. The other two start equal to it: nothing reprices
            // on the day of the migration, and an admin edits them afterwards.
            `UPDATE products
                SET "priceConsumer"  = COALESCE("priceConsumer",  "sellingPrice"),
                    "priceRetail"    = COALESCE("priceRetail",    "sellingPrice"),
                    "priceWholesale" = COALESCE("priceWholesale", "sellingPrice")
              WHERE "sellingPrice" IS NOT NULL`,

            // Any row that somehow still has nulls (a product added between
            // the ALTER and the UPDATE) is filled so the NOT NULL can apply.
            `UPDATE products
                SET "priceConsumer"  = COALESCE("priceConsumer",  0),
                    "priceRetail"    = COALESCE("priceRetail",    0),
                    "priceWholesale" = COALESCE("priceWholesale", 0)`,

            `ALTER TABLE products ALTER COLUMN "priceWholesale" SET NOT NULL`,
            `ALTER TABLE products ALTER COLUMN "priceRetail" SET NOT NULL`,
            `ALTER TABLE products ALTER COLUMN "priceConsumer" SET NOT NULL`,

            // Dropped last, once every tier is populated from it.
            `ALTER TABLE products DROP COLUMN IF EXISTS "sellingPrice"`,
        ],
    },
    {
        name: "sales: record which tier was charged",
        appliesWhen: async () => !(await hasColumn("sales", "priceTier")),
        sql: [
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "priceTier" VARCHAR(16)`,
            // Existing sales were all rung up at the single old price, which
            // is now the consumer tier — so that is what they were.
            `UPDATE sales SET "priceTier" = 'CONSUMER' WHERE "priceTier" IS NULL`,
            `ALTER TABLE sales ALTER COLUMN "priceTier" SET DEFAULT 'CONSUMER'`,
            `ALTER TABLE sales ALTER COLUMN "priceTier" SET NOT NULL`,
        ],
    },
    {
        name: "sales: customer and debt effect",
        appliesWhen: async () => !(await hasColumn("sales", "customerId")),
        sql: [
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "customerId" UUID`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "customerName" VARCHAR(255)`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "debtCharged" BIGINT NOT NULL DEFAULT 0`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "debtRepaid" BIGINT NOT NULL DEFAULT 0`,
            `ALTER TABLE sales ADD COLUMN IF NOT EXISTS "customerBalanceAfter" BIGINT`,
            // Every sale so far was a walk-in paid in full, which is exactly
            // what these defaults say — so no backfill is needed.
        ],
    },
    {
        name: "products: pack size, sale items: unit size",
        appliesWhen: async () => !(await hasColumn("products", "unitsPerPack")),
        sql: [
            // 1 means the product is not broken down at all, which is what
            // every existing product is until someone says otherwise — so the
            // default alone is a correct backfill.
            `ALTER TABLE products ADD COLUMN IF NOT EXISTS "unitsPerPack" INTEGER NOT NULL DEFAULT 1`,
            `ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS "unitsPerSaleUnit" INTEGER NOT NULL DEFAULT 1`,
        ],
    },
    {
        // Its own step, committed before anything uses it: postgres will not
        // let a new enum label be used inside the transaction that added it.
        name: "products: capsule as a base unit",
        appliesWhen: async () => !(await enumHasValue("enum_products_unitType", "CAPSULE")),
        sql: [
            `ALTER TYPE "enum_products_unitType" ADD VALUE IF NOT EXISTS 'CAPSULE' AFTER 'TABLET'`,
        ],
    },
    {
        name: UNIT_PRICE_MIGRATION,
        track: UNIT_PRICE_MIGRATION,
        sql: [
            // Retail and wholesale used to be typed per pack, while consumer
            // was per single. Every tier is now per base unit, so the two pack
            // prices are divided down. Consumer is untouched — it already was.
            //
            // Rounded to the nearest kobo. A pack price that does not divide
            // evenly by its pack size loses at most half a kobo per unit, and
            // the alternative — a fractional kobo — cannot be charged at all.
            `UPDATE products
                SET "priceRetail"    = ROUND("priceRetail"::numeric    / "unitsPerPack"),
                    "priceWholesale" = ROUND("priceWholesale"::numeric / "unitsPerPack")
              WHERE "unitsPerPack" > 1`,

            // "One unit of stock is a pack" and "24 units per pack" cannot both
            // be true. Where they conflict, the base unit is taken from the
            // dosage form — what one single actually is.
            `UPDATE products
                SET "unitType" = (CASE "dosageForm"
                        WHEN 'TABLET'  THEN 'TABLET'
                        WHEN 'CAPSULE' THEN 'CAPSULE'
                        WHEN 'POWDER'  THEN 'SACHET'
                        ELSE 'PIECE'
                    END)::"enum_products_unitType"
              WHERE "unitsPerPack" > 1
                AND "unitType" IN ('PACK', 'CARTON')`,
        ],
    },
];

const migrate = async () => {
    await connectToDB();
    await ensureMigrationLog();

    for (const step of steps) {
        process.stdout.write(`  ${step.name} ... `);

        const applies = step.appliesWhen
            ? await step.appliesWhen()
            : step.track
              ? !(await hasMigrationRun(step.track))
              : true;

        if (!applies) {
            console.log("already applied");
            continue;
        }

        // One transaction per step, so a failure leaves that step untouched
        // rather than half-applied.
        const transaction = await sequelize.transaction();
        try {
            for (const statement of step.sql) {
                await sequelize.query(statement, { transaction });
            }
            if (step.track) {
                await markMigrationRun(step.track, transaction);
            }
            await transaction.commit();
            console.log("done");
        } catch (error: any) {
            await transaction.rollback();
            console.log("FAILED");
            console.error(`    ${error.message}`);
            await sequelize.close();
            process.exit(1);
        }
    }

    console.log("\nSchema is up to date.");
    await sequelize.close();
};

migrate().catch(async (error) => {
    console.error("Migration failed:", error.message);
    await sequelize.close();
    process.exit(1);
});
