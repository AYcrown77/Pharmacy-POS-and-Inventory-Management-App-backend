import dotenv from "dotenv";
import pg from "pg";
import { config } from "../config/config.js";

dotenv.config();

/**
 * Creates the pharmacy database if it does not exist yet.
 *
 * `sequelize.sync()` will happily create every table, but it cannot create the
 * database those tables live in — connecting already requires one. So this
 * connects to the `postgres` maintenance database instead, which always
 * exists, and creates ours from there.
 *
 * Idempotent on purpose: a new developer runs `pnpm setup` without having to
 * know or care whether the database is already there.
 */
const createDatabaseIfMissing = async () => {
    const name = config.database.name;
    const user = config.database.user;

    if (!name || !user) {
        console.error("DB_NAME and DB_USER must be set in .env — copy .env.example and fill it in.");
        process.exit(1);
    }

    const client = new pg.Client({
        host: config.database.host,
        port: Number(config.database.port) || 5432,
        user,
        password: config.database.password,
        // Every postgres install has this one, so it is the reliable way in
        // when the database we actually want may not exist yet.
        database: "postgres",
    });

    try {
        await client.connect();
    } catch (error: any) {
        console.error("Could not reach postgres:", error.message);
        console.error("");
        console.error("Check that postgres is running and that DB_HOST, DB_PORT, DB_USER and");
        console.error("DB_PASSWORD in .env are correct. A blank DB_PASSWORD is the usual cause.");
        process.exit(1);
    }

    try {
        const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);

        if (existing.rowCount) {
            console.log(`Database "${name}" already exists.`);
        } else {
            // The name cannot be parameterised in DDL, so it is quoted instead.
            // It comes from our own .env rather than from user input.
            await client.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
            console.log(`Created database "${name}".`);
        }
    } finally {
        await client.end();
    }
};

createDatabaseIfMissing().catch((error) => {
    console.error("Setup failed:", error.message);
    process.exit(1);
});
