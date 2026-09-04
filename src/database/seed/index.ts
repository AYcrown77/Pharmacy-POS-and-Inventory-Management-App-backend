import dotenv from "dotenv";
import sequelize, { connectToDB } from "../db.js";
import "../../schemas/index.js";
import Category from "../../schemas/products/categorySchema.js";
import Product from "../../schemas/products/productSchema.js";
import Batch from "../../schemas/inventory/batchSchema.js";
import StockMovement from "../../schemas/inventory/stockMovementSchema.js";
import Sale, { PaymentMethod } from "../../schemas/sales/saleSchema.js";
import SaleItem from "../../schemas/sales/saleItemSchema.js";
import Auth from "../../schemas/users/authSchema.js";
import Terminal from "../../schemas/system/terminalSchema.js";
import Setting from "../../schemas/system/settingSchema.js";
import AuditLog from "../../schemas/system/auditLogSchema.js";
import StockAdjustment from "../../schemas/inventory/stockAdjustmentSchema.js";
import SaleReturn from "../../schemas/sales/saleReturnSchema.js";
import SaleReturnItem from "../../schemas/sales/saleReturnItemSchema.js";
import { hashPassword } from "../../utils/index.js";
import { addDays, today } from "../../utils/date.js";
import {
    SEED_BATCH_PLANS,
    SEED_CATEGORIES,
    SEED_PRODUCTS,
    SEED_SUPPLIERS,
    SEED_TERMINALS,
    SEED_USERS,
} from "./catalogue.js";

dotenv.config();

/**
 * Seeds a working pharmacy.
 *
 * The goal is not merely to have rows: it is that every screen has something
 * true to show. Stock spreads across the expiry bands, a couple of products sit
 * below their minimum, one is out of stock entirely, and roughly ninety days of
 * sales sit behind the reports so the charts and cashier totals are real.
 *
 * Two rules keep the data honest:
 *
 *   - Batch arithmetic adds up. `quantityReceived - unitsSold = quantityRemaining`
 *     for every batch, and the movement ledger walks that path step by step. A
 *     seed that fudged this would make the stock report disagree with itself.
 *
 *   - Nothing is dated in the future. Today is capped at the previous complete
 *     hour, so no sale reads as having happened later this afternoon.
 */

const SEED_PASSWORD = "Pharmacy@2026";
const HISTORY_DAYS = 90;

/** A small deterministic generator, so two runs produce the same shop. */
const makeRandom = (seed: number) => {
    let state = seed;
    return () => {
        state = (state * 1103515245 + 12345) & 0x7fffffff;
        return state / 0x7fffffff;
    };
};

const random = makeRandom(20260904);

const pick = <T>(items: T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

const PAYMENT_WEIGHTS: PaymentMethod[] = [
    // Roughly 60 / 30 / 10 — a cash-first counter, as the brief describes.
    ...Array<PaymentMethod>(6).fill("CASH"),
    ...Array<PaymentMethod>(3).fill("CARD"),
    ...Array<PaymentMethod>(1).fill("TRANSFER"),
];

// Weighted so the typical basket is one or two lines of one or two units.
// A flat 1-3 on both makes the average sale nearly twice what a community
// pharmacy actually takes.
const LINE_COUNTS = [1, 1, 2, 2, 2, 3];
const LINE_QUANTITIES = [1, 1, 1, 1, 2, 2, 3];

interface BatchRow {
    id: string;
    productSlug: string;
    batchNumber: string;
    expiryDate: string;
    quantityRemaining: number;
    costPrice: number;
    sellingPrice: number;
    supplierName: string;
    receivedAt: Date;
    /**
     * A depleted batch that exists only to account for the sales history.
     * Ninety days of trading moves far more stock than the shelf holds today,
     * and those units have to have come from somewhere — so the batches that
     * supplied them sit in the ledger at zero remaining, exactly as they would
     * in a real pharmacy.
     */
    isHistorical: boolean;
    /** Filled in once the sales history is known. */
    unitsSold: number;
}

const clearExistingData = async () => {
    // Order matters: children before parents, or the foreign keys refuse.
    await SaleReturnItem.destroy({ where: {}, truncate: true, cascade: true });
    await SaleReturn.destroy({ where: {}, truncate: true, cascade: true });
    await SaleItem.destroy({ where: {}, truncate: true, cascade: true });
    await Sale.destroy({ where: {}, truncate: true, cascade: true });
    await StockMovement.destroy({ where: {}, truncate: true, cascade: true });
    await StockAdjustment.destroy({ where: {}, truncate: true, cascade: true });
    await Batch.destroy({ where: {}, truncate: true, cascade: true });
    await Product.destroy({ where: {}, truncate: true, cascade: true });
    await Category.destroy({ where: {}, truncate: true, cascade: true });
    await AuditLog.destroy({ where: {}, truncate: true, cascade: true });
    await Auth.destroy({ where: {}, truncate: true, cascade: true });
    await Terminal.destroy({ where: {}, truncate: true, cascade: true });
    await Setting.destroy({ where: {}, truncate: true, cascade: true });

    // Receipt numbers restart with the data they belong to.
    await sequelize.query("ALTER SEQUENCE receipt_number_seq RESTART WITH 1");
};

const seed = async () => {
    await connectToDB();

    console.log("Clearing existing data...");
    await clearExistingData();

    /* ---------------------------------------------------------------- users */

    console.log("Seeding users and terminals...");

    const passwordHash = await hashPassword(SEED_PASSWORD);

    const users = await Auth.bulkCreate(
        SEED_USERS.map((user) => ({ ...user, password: passwordHash, isActive: true }))
    );

    const admin = users.find((user) => user.role === "ADMINISTRATOR")!;
    const cashiers = users.filter((user) => user.role === "CASHIER");

    await Terminal.bulkCreate(SEED_TERMINALS.map((terminal) => ({ ...terminal, isActive: true })));

    await Setting.create({
        id: 1,
        name: "Mustan Healthcare Pharmacy",
        address: "12 Ahmadu Bello Way, Kaduna, Nigeria",
        phone: "+234 803 000 0000",
        receiptFooter: "Your Health, Our Priority",
        showLogoOnReceipt: true,
        currency: "NGN",
        lowStockAlertsEnabled: true,
        expiryAlertDays: 90,
    });

    /* ----------------------------------------------------------- catalogue */

    console.log("Seeding catalogue...");

    const categories = await Category.bulkCreate(
        SEED_CATEGORIES.map((category) => ({
            name: category.name,
            description: category.description,
        }))
    );

    const categoryIdByName = new Map(categories.map((category) => [category.name, category.id]));
    const categoryIdBySlug = new Map(
        SEED_CATEGORIES.map((category) => [category.slug, categoryIdByName.get(category.name)!])
    );

    const products = await Product.bulkCreate(
        SEED_PRODUCTS.map((item) => ({
            name: item.name,
            genericName: item.genericName,
            brandName: item.brandName,
            barcode: item.barcode,
            categoryId: categoryIdBySlug.get(item.categorySlug)!,
            strength: item.strength,
            dosageForm: item.dosageForm,
            sellingPrice: item.sellingPrice,
            minimumStockLevel: item.minimumStockLevel,
            unitType: item.unitType,
            isActive: true,
        }))
    );

    const productIdBySlug = new Map(
        SEED_PRODUCTS.map((item, index) => [item.slug, products[index].id])
    );
    const productBySlug = new Map(SEED_PRODUCTS.map((item, index) => [item.slug, products[index]]));

    /* ------------------------------------------------------------- batches */

    console.log("Seeding batches...");

    const startOfDay = today();
    const batchRows: BatchRow[] = [];

    for (const [slug, plans] of Object.entries(SEED_BATCH_PLANS)) {
        const product = productBySlug.get(slug);
        if (!product) continue;

        for (const [batchNumber, daysFromToday, quantityRemaining, costNaira] of plans) {
            // Received far enough back that the sales history has something to
            // draw from, and always before the sales that consume it.
            const receivedDaysAgo = between(HISTORY_DAYS + 5, HISTORY_DAYS + 60);

            batchRows.push({
                id: "",
                productSlug: slug,
                batchNumber,
                expiryDate: addDays(startOfDay, daysFromToday),
                quantityRemaining,
                costPrice: Math.round(costNaira * 100),
                sellingPrice: product.sellingPrice,
                supplierName: pick(SEED_SUPPLIERS),
                receivedAt: new Date(`${addDays(startOfDay, -receivedDaysAgo)}T09:00:00+01:00`),
                isHistorical: false,
                unitsSold: 0,
            });
        }

        // Two spent batches per product, covering the first and second halves
        // of the history. They expire at -45 and -5 days, so FEFO reaches for
        // them in the right order and stops using each one the day it lapses.
        // Both end at zero remaining, which keeps them out of every stock,
        // value and expiry figure while still explaining where the sold units
        // came from.
        const prefix = plans[0][0].replace(/\d+$/, "");
        const baseCost = Math.round(plans[0][3] * 100 * 0.95);

        for (const [suffix, expiresIn, receivedIn] of [
            ["H1", -45, -170],
            ["H2", -5, -110],
        ] as const) {
            batchRows.push({
                id: "",
                productSlug: slug,
                batchNumber: `${prefix}${suffix}`,
                expiryDate: addDays(startOfDay, expiresIn),
                quantityRemaining: 0,
                costPrice: baseCost,
                sellingPrice: product.sellingPrice,
                supplierName: pick(SEED_SUPPLIERS),
                receivedAt: new Date(`${addDays(startOfDay, receivedIn)}T09:00:00+01:00`),
                isHistorical: true,
                unitsSold: 0,
            });
        }
    }

    /* ------------------------------------------------------- sales history */

    console.log(`Generating ${HISTORY_DAYS} days of sales...`);

    // Every batch a sale could ever have drawn from, earliest expiry first —
    // the spent historical ones included, since those are what most of the
    // history was actually sold out of.
    const batchesByProduct = new Map<string, BatchRow[]>();
    for (const batch of batchRows) {
        const list = batchesByProduct.get(batch.productSlug);
        if (list) list.push(batch);
        else batchesByProduct.set(batch.productSlug, [batch]);
    }
    for (const list of batchesByProduct.values()) {
        list.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    }

    const sellableSlugs = [...batchesByProduct.keys()];

    interface PlannedItem {
        productSlug: string;
        batch: BatchRow;
        quantity: number;
        unitPrice: number;
    }

    interface PlannedSale {
        createdAt: Date;
        cashierIndex: number;
        terminalId: string;
        paymentMethod: PaymentMethod;
        items: PlannedItem[];
    }

    const plannedSales: PlannedSale[] = [];

    const now = new Date();
    // Cap today at the previous complete hour, so nothing reads as happening
    // later this afternoon.
    const lastCompleteHour = now.getHours();

    for (let dayOffset = HISTORY_DAYS - 1; dayOffset >= 0; dayOffset -= 1) {
        const day = addDays(startOfDay, -dayOffset);
        const isToday = dayOffset === 0;

        // The shop runs 08:00–20:00. Today only counts the hours already past.
        const openHour = 8;
        const closeHour = isToday ? Math.min(lastCompleteHour, 20) : 20;
        if (closeHour <= openHour) continue;

        const fullDayVolume = between(60, 92);
        const volume = isToday
            ? Math.round((fullDayVolume * (closeHour - openHour)) / 12)
            : fullDayVolume;

        for (let index = 0; index < volume; index += 1) {
            const hour = between(openHour, closeHour - 1);
            const createdAt = new Date(
                `${day}T${String(hour).padStart(2, "0")}:${String(between(0, 59)).padStart(2, "0")}:${String(
                    between(0, 59)
                ).padStart(2, "0")}+01:00`
            );

            const lineCount = pick(LINE_COUNTS);
            const items: PlannedItem[] = [];
            const usedSlugs = new Set<string>();

            for (let line = 0; line < lineCount; line += 1) {
                // Sample two candidates and keep the cheaper one. Without this
                // the basket average drifts far above what a community
                // pharmacy actually takes.
                const first = pick(sellableSlugs);
                const second = pick(sellableSlugs);
                const slug =
                    productBySlug.get(first)!.sellingPrice <= productBySlug.get(second)!.sellingPrice
                        ? first
                        : second;

                if (usedSlugs.has(slug)) continue;
                usedSlugs.add(slug);

                const product = productBySlug.get(slug)!;
                const batches = batchesByProduct.get(slug)!;

                // FEFO as it stood on the day: the earliest-expiring batch that
                // had already been delivered and had not yet lapsed. The spent
                // historical batches are unconstrained because their received
                // quantity is derived from exactly what the history took; the
                // current ones are capped so today's shelf still matches the
                // stock levels the screens were designed around.
                const batch = batches.find(
                    (candidate) =>
                        candidate.receivedAt <= createdAt &&
                        candidate.expiryDate >= day &&
                        (candidate.isHistorical ||
                            candidate.unitsSold < candidate.quantityRemaining * 3)
                );
                if (!batch) continue;

                const quantity = pick(LINE_QUANTITIES);
                batch.unitsSold += quantity;

                items.push({
                    productSlug: slug,
                    batch,
                    quantity,
                    unitPrice: product.sellingPrice,
                });
            }

            if (items.length === 0) continue;

            plannedSales.push({
                createdAt,
                cashierIndex: index % cashiers.length,
                terminalId: index % 4 === 0 ? "trm-02" : "trm-01",
                paymentMethod: pick(PAYMENT_WEIGHTS),
                items,
            });
        }
    }

    plannedSales.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    /* ------------------------------------------------ write batches for real */

    // A historical batch nothing was ever sold from would be a delivery of zero
    // units, which is not a thing. Drop those before writing.
    const finalBatchRows = batchRows.filter(
        (batch) => !batch.isHistorical || batch.unitsSold > 0
    );

    // Now that the history is known, a batch's received quantity is simply what
    // is left plus everything that was sold out of it. The two figures agree by
    // construction rather than by luck.
    const createdBatches = await Batch.bulkCreate(
        finalBatchRows.map((batch) => ({
            productId: productIdBySlug.get(batch.productSlug)!,
            batchNumber: batch.batchNumber,
            expiryDate: batch.expiryDate,
            quantityReceived: batch.quantityRemaining + batch.unitsSold,
            quantityRemaining: batch.quantityRemaining,
            costPrice: batch.costPrice,
            sellingPrice: batch.sellingPrice,
            supplierName: batch.supplierName,
            receivedAt: batch.receivedAt,
            receivedBy: admin.id,
            receivedByName: admin.name,
        }))
    );

    finalBatchRows.forEach((batch, index) => {
        batch.id = createdBatches[index].id;
    });

    /* ------------------------------------------------------------ movements */

    const movements: Array<Record<string, unknown>> = [];

    // Every batch opens with the delivery that created it.
    finalBatchRows.forEach((batch, index) => {
        const received = createdBatches[index].quantityReceived;
        movements.push({
            productId: productIdBySlug.get(batch.productSlug)!,
            productName: productBySlug.get(batch.productSlug)!.name,
            batchId: batch.id,
            batchNumber: batch.batchNumber,
            movementType: "STOCK_RECEIVED",
            quantity: received,
            previousQuantity: 0,
            newQuantity: received,
            referenceType: "BATCH",
            referenceId: batch.id,
            userId: admin.id,
            userName: admin.name,
            reason: null,
            createdAt: batch.receivedAt,
            updatedAt: batch.receivedAt,
        });
    });

    /* ---------------------------------------------------------------- sales */

    console.log(`Writing ${plannedSales.length} sales...`);

    // The running quantity per batch, walked forward in chronological order so
    // the ledger's previous/new columns tell a continuous story.
    const runningQuantity = new Map<string, number>();
    finalBatchRows.forEach((batch, index) => {
        runningQuantity.set(batch.id, createdBatches[index].quantityReceived);
    });

    const saleRows: Array<Record<string, unknown>> = [];
    const saleItemRows: Array<Record<string, unknown>> = [];

    let receiptSequence = 0;

    for (const planned of plannedSales) {
        receiptSequence += 1;
        const cashier = cashiers[planned.cashierIndex];
        const terminal = SEED_TERMINALS.find((item) => item.id === planned.terminalId)!;

        const saleId = crypto.randomUUID();
        const subtotal = planned.items.reduce(
            (total, item) => total + item.unitPrice * item.quantity,
            0
        );

        // Cash customers hand over a round note, so change is realistic.
        const amountReceived =
            planned.paymentMethod === "CASH" ? Math.ceil(subtotal / 50_000) * 50_000 : null;

        saleRows.push({
            id: saleId,
            receiptNumber: `MHP-${receiptSequence.toString().padStart(6, "0")}`,
            terminalId: terminal.id,
            terminalName: terminal.name,
            cashierId: cashier.id,
            cashierName: cashier.name,
            subtotal,
            discount: 0,
            total: subtotal,
            paymentMethod: planned.paymentMethod,
            amountReceived,
            changeGiven: amountReceived === null ? null : amountReceived - subtotal,
            status: "COMPLETED",
            createdAt: planned.createdAt,
            updatedAt: planned.createdAt,
        });

        for (const item of planned.items) {
            const product = productBySlug.get(item.productSlug)!;

            saleItemRows.push({
                id: crypto.randomUUID(),
                saleId,
                productId: product.id,
                productName: product.name,
                batchId: item.batch.id,
                batchNumber: item.batch.batchNumber,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.unitPrice * item.quantity,
                returnedQuantity: 0,
                createdAt: planned.createdAt,
                updatedAt: planned.createdAt,
            });

            const previousQuantity = runningQuantity.get(item.batch.id)!;
            const newQuantity = previousQuantity - item.quantity;
            runningQuantity.set(item.batch.id, newQuantity);

            movements.push({
                productId: product.id,
                productName: product.name,
                batchId: item.batch.id,
                batchNumber: item.batch.batchNumber,
                movementType: "SALE",
                quantity: -item.quantity,
                previousQuantity,
                newQuantity,
                referenceType: "SALE",
                referenceId: saleId,
                userId: cashier.id,
                userName: cashier.name,
                reason: null,
                createdAt: planned.createdAt,
                updatedAt: planned.createdAt,
            });
        }
    }

    // Chunked, because a single insert of twenty thousand rows exceeds what the
    // postgres wire protocol will accept in one statement.
    const chunk = <T>(rows: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let index = 0; index < rows.length; index += size) {
            chunks.push(rows.slice(index, index + size));
        }
        return chunks;
    };

    for (const part of chunk(saleRows, 500)) {
        await Sale.bulkCreate(part as never, { validate: false });
    }
    for (const part of chunk(saleItemRows, 500)) {
        await SaleItem.bulkCreate(part as never, { validate: false });
    }

    movements.sort(
        (a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime()
    );
    for (const part of chunk(movements, 500)) {
        await StockMovement.bulkCreate(part as never, { validate: false });
    }

    // The receipt sequence continues from the history, so the next real sale
    // does not reuse a number already printed.
    await sequelize.query(`ALTER SEQUENCE receipt_number_seq RESTART WITH ${receiptSequence + 1}`);

    /* ---------------------------------------------------------------- audit */

    await AuditLog.bulkCreate(
        finalBatchRows.slice(0, 12).map((batch) => ({
            userId: admin.id,
            userName: admin.name,
            action: "STOCK_RECEIVED" as const,
            entityType: "BATCH",
            entityId: batch.id,
            oldValue: null,
            newValue: {
                product: productBySlug.get(batch.productSlug)!.name,
                batchNumber: batch.batchNumber,
            },
            createdAt: batch.receivedAt,
            updatedAt: batch.receivedAt,
        })) as never
    );

    /* -------------------------------------------------------------- summary */

    const totalTakings = saleRows.reduce((sum, sale) => sum + (sale.total as number), 0);

    console.log("");
    console.log("Seed complete.");
    console.log(`  Categories      ${categories.length}`);
    console.log(`  Products        ${products.length}`);
    console.log(`  Batches         ${createdBatches.length}`);
    console.log(`  Sales           ${saleRows.length}`);
    console.log(`  Sale items      ${saleItemRows.length}`);
    console.log(`  Movements       ${movements.length}`);
    console.log(
        `  Takings         NGN ${(totalTakings / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
    const averageKobo = Math.round(totalTakings / saleRows.length);
    console.log(
        `  Average basket  NGN ${(averageKobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    );
    console.log("");
    console.log("Sign in with:");
    for (const user of SEED_USERS) {
        console.log(`  ${user.username.padEnd(10)} ${SEED_PASSWORD}   (${user.role})`);
    }
    console.log("");

    await sequelize.close();
};

seed().catch(async (error) => {
    console.error("Seed failed:", error);
    await sequelize.close();
    process.exit(1);
});
