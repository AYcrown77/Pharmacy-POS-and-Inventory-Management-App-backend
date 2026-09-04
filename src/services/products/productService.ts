import { Op } from "sequelize";
import Product from "../../schemas/products/productSchema.js";
import Category from "../../schemas/products/categorySchema.js";
import { recordAudit } from "../system/auditService.js";
import {
    getStockTotals,
    getSellableBatches,
    hasOnlyExpiredStock,
} from "../inventory/stockService.js";
import { messageHandler } from "../../utils/index.js";
import { buildPaginated, resolvePaging } from "../../utils/pagination.js";
import { deriveStockStatus } from "../../utils/stock.js";
import { CONFLICT, INTERNAL_SERVER_ERROR, NOT_FOUND, SUCCESS } from "../../constants/statusCode.js";
import {
    ProductInput,
    ProductListItem,
    ProductListQuery,
    ProductResponse,
} from "../../types/products/product.js";
import { CategoryAttributes } from "../../schemas/products/categorySchema.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

const CATEGORY_INCLUDE = [{ model: Category, as: "category" }];

/**
 * Attaches the stock figures the list and detail views need.
 *
 * Stock is not a column on the product; it is the sum of its sellable batches.
 * The totals arrive pre-computed in one grouped query, so this stays a map
 * lookup rather than a query per row.
 */
const withStock = (product: Product, totals: Map<string, { available: number }>): ProductListItem => {
    const available = totals.get(product.id)?.available ?? 0;
    return {
        id: product.id,
        name: product.name,
        genericName: product.genericName,
        brandName: product.brandName,
        barcode: product.barcode,
        categoryId: product.categoryId,
        category: product.category ? (product.category.toJSON() as CategoryAttributes) : null,
        strength: product.strength,
        dosageForm: product.dosageForm,
        sellingPrice: product.sellingPrice,
        minimumStockLevel: product.minimumStockLevel,
        unitType: product.unitType,
        isActive: product.isActive,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
        availableStock: available,
        stockStatus: deriveStockStatus(available, product.minimumStockLevel),
    };
};

/** A barcode has to identify exactly one product, or scanning is ambiguous. */
const findBarcodeClash = async (barcode: string | null, excludeId?: string) => {
    if (!barcode) return null;
    return Product.findOne({
        where: {
            barcode,
            ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
        },
    });
};

const normalise = (input: ProductInput) => ({
    name: input.name.trim(),
    genericName: input.genericName?.trim() || null,
    brandName: input.brandName?.trim() || null,
    barcode: input.barcode?.trim() || null,
    categoryId: input.categoryId,
    strength: input.strength?.trim() || null,
    dosageForm: input.dosageForm ?? null,
    sellingPrice: input.sellingPrice,
    minimumStockLevel: input.minimumStockLevel,
    unitType: input.unitType,
    isActive: input.isActive ?? true,
});

export const listProductsService = async (
    query: ProductListQuery,
    callback: (data: ProductResponse) => void
) => {
    try {
        const { page, pageSize } = resolvePaging(query);

        const where: Record<string | symbol, unknown> = {};

        if (query.search?.trim()) {
            const term = `%${query.search.trim()}%`;
            where[Op.or] = [
                { name: { [Op.iLike]: term } },
                { genericName: { [Op.iLike]: term } },
                { brandName: { [Op.iLike]: term } },
                { barcode: { [Op.iLike]: term } },
            ];
        }

        if (query.categoryId) where.categoryId = query.categoryId;
        if (query.isActive !== undefined) where.isActive = query.isActive === "true";

        // The catalogue is a few hundred rows, and stock status is derived from
        // a separate table — so the filtered set is read whole, decorated, then
        // sorted and paged here. Pushing it into SQL would need a join and a
        // GROUP BY on every list request to save nothing at this size.
        const products = await Product.findAll({ where, include: CATEGORY_INCLUDE });
        const totals = await getStockTotals(products.map((product) => product.id));

        let items = products.map((product) => withStock(product, totals));

        if (query.stockStatus) {
            items = items.filter((item) => item.stockStatus === query.stockStatus);
        }

        const direction = query.sortDir === "desc" ? -1 : 1;
        const sortKey = query.sortBy ?? "name";

        const pick = (item: (typeof items)[number]): string | number => {
            switch (sortKey) {
                case "sellingPrice":
                    return item.sellingPrice;
                case "availableStock":
                    return item.availableStock;
                case "category":
                    return item.category?.name ?? "";
                case "createdAt":
                    return new Date(item.createdAt).getTime();
                default:
                    return item.name.toLowerCase();
            }
        };

        items.sort((a, b) => {
            const left = pick(a);
            const right = pick(b);
            if (left === right) return 0;
            return (left < right ? -1 : 1) * direction;
        });

        const start = (page - 1) * pageSize;
        const paged = items.slice(start, start + pageSize);

        return callback(
            messageHandler(
                "Products retrieved",
                true,
                SUCCESS,
                buildPaginated(paged, items.length, page, pageSize)
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading products.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getProductService = async (id: string, callback: (data: ProductResponse) => void) => {
    try {
        const product = await Product.findByPk(id, { include: CATEGORY_INCLUDE });

        if (!product) {
            return callback(messageHandler("Product not found.", false, NOT_FOUND, {}));
        }

        const totals = await getStockTotals([product.id]);

        return callback(messageHandler("Product retrieved", true, SUCCESS, withStock(product, totals)));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading the product.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const getProductByBarcodeService = async (
    barcode: string,
    callback: (data: ProductResponse) => void
) => {
    try {
        const product = await Product.findOne({
            where: { barcode: barcode.trim(), isActive: true },
            include: CATEGORY_INCLUDE,
        });

        // A scan that matches nothing is a normal outcome at the till, not an
        // error — the POS shows "product not found" and keeps the cart.
        return callback(messageHandler("Barcode lookup complete", true, SUCCESS, product));
    } catch (error) {
        return callback(
            messageHandler("An error occured while reading the barcode.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const searchProductsService = async (
    term: string,
    limit: number,
    callback: (data: ProductResponse) => void
) => {
    try {
        const query = term.trim();
        if (!query) {
            return callback(messageHandler("Search complete", true, SUCCESS, []));
        }

        const like = `%${query}%`;
        const matches = await Product.findAll({
            where: {
                isActive: true,
                [Op.or]: [
                    { name: { [Op.iLike]: like } },
                    { genericName: { [Op.iLike]: like } },
                    { brandName: { [Op.iLike]: like } },
                    { barcode: { [Op.iLike]: like } },
                ],
            },
            include: CATEGORY_INCLUDE,
            limit: Math.max(limit, 1) * 3,
        });

        const totals = await getStockTotals(matches.map((product) => product.id));

        // An exact barcode hit leads, then names starting with the term. A
        // cashier who scanned a code should not have to read a list.
        const rank = (product: Product) => {
            if (product.barcode === query) return 0;
            if (product.name.toLowerCase().startsWith(query.toLowerCase())) return 1;
            return 2;
        };

        const ranked = [...matches].sort(
            (a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name)
        );

        return callback(
            messageHandler(
                "Search complete",
                true,
                SUCCESS,
                ranked.slice(0, limit).map((product) => withStock(product, totals))
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while searching.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const saleLookupService = async (
    idOrBarcode: string,
    callback: (data: ProductResponse) => void
) => {
    try {
        const needle = idOrBarcode.trim();

        // The value can be either a product id or a scanned barcode. Only a
        // well-formed UUID is tried as an id, because postgres raises an error
        // rather than returning nothing when a uuid column meets junk.
        const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(needle);

        const product = await Product.findOne({
            where: {
                isActive: true,
                [Op.or]: isUuid ? [{ id: needle }, { barcode: needle }] : [{ barcode: needle }],
            },
            include: CATEGORY_INCLUDE,
        });

        // Null, not a 404: "we do not stock that" is an answer the till shows
        // inline, and a failed request would clear the search box instead.
        if (!product) {
            return callback(messageHandler("Product not found.", true, SUCCESS, null));
        }

        const sellable = await getSellableBatches(product.id);
        const expiredOnly = await hasOnlyExpiredStock(product.id);

        const available = sellable.reduce((total, batch) => total + batch.quantityRemaining, 0);
        const totals = new Map([[product.id, { available }]]);

        return callback(
            messageHandler("Sale lookup complete", true, SUCCESS, {
                product: withStock(product, totals),
                availableStock: available,
                sellableBatches: sellable.map((batch) => ({
                    batchId: batch.id,
                    batchNumber: batch.batchNumber,
                    expiryDate: batch.expiryDate,
                    quantityRemaining: batch.quantityRemaining,
                })),
                expiredOnly,
            })
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured during the lookup.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const createProductService = async (
    input: ProductInput,
    user: AuthenticatedUser,
    callback: (data: ProductResponse) => void
) => {
    try {
        const data = normalise(input);

        const category = await Category.findByPk(data.categoryId);
        if (!category) {
            return callback(messageHandler("That category no longer exists.", false, NOT_FOUND, {}));
        }

        const clash = await findBarcodeClash(data.barcode);
        if (clash) {
            return callback(
                messageHandler(
                    `Barcode ${data.barcode} is already used by ${clash.name}.`,
                    false,
                    CONFLICT,
                    { code: "DUPLICATE_BARCODE" }
                )
            );
        }

        const product = await Product.create(data);

        await recordAudit({
            userId: user.id,
            userName: user.name,
            action: "PRODUCT_CREATED",
            entityType: "PRODUCT",
            entityId: product.id,
            newValue: { name: product.name, sellingPrice: product.sellingPrice },
        });

        const created = await Product.findByPk(product.id, { include: CATEGORY_INCLUDE });
        const totals = await getStockTotals([product.id]);

        return callback(
            messageHandler(
                "Product created",
                true,
                SUCCESS,
                withStock(created ?? product, totals)
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the product.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const updateProductService = async (
    id: string,
    input: ProductInput,
    user: AuthenticatedUser,
    callback: (data: ProductResponse) => void
) => {
    try {
        const product = await Product.findByPk(id);
        if (!product) {
            return callback(messageHandler("Product not found.", false, NOT_FOUND, {}));
        }

        const data = normalise(input);

        const category = await Category.findByPk(data.categoryId);
        if (!category) {
            return callback(messageHandler("That category no longer exists.", false, NOT_FOUND, {}));
        }

        const clash = await findBarcodeClash(data.barcode, id);
        if (clash) {
            return callback(
                messageHandler(
                    `Barcode ${data.barcode} is already used by ${clash.name}.`,
                    false,
                    CONFLICT,
                    { code: "DUPLICATE_BARCODE" }
                )
            );
        }

        const previousPrice = product.sellingPrice;

        await product.update(data);

        await recordAudit({
            userId: user.id,
            userName: user.name,
            action: "PRODUCT_UPDATED",
            entityType: "PRODUCT",
            entityId: product.id,
            newValue: { name: product.name },
        });

        // A price change is tracked separately — section 24 lists it as its own
        // action, because it is the one product edit that moves money.
        if (previousPrice !== data.sellingPrice) {
            await recordAudit({
                userId: user.id,
                userName: user.name,
                action: "PRICE_CHANGED",
                entityType: "PRODUCT",
                entityId: product.id,
                oldValue: { sellingPrice: previousPrice },
                newValue: { sellingPrice: data.sellingPrice },
            });
        }

        const updated = await Product.findByPk(id, { include: CATEGORY_INCLUDE });
        const totals = await getStockTotals([id]);

        return callback(
            messageHandler(
                "Product updated",
                true,
                SUCCESS,
                withStock(updated ?? product, totals)
            )
        );
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the product.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
