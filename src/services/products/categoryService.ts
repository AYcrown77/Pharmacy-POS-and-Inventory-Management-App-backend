import Category from "../../schemas/products/categorySchema.js";
import Product from "../../schemas/products/productSchema.js";
import { messageHandler } from "../../utils/index.js";
import { CONFLICT, INTERNAL_SERVER_ERROR, NOT_FOUND, SUCCESS } from "../../constants/statusCode.js";
import { CategoryInput, CategoryResponse } from "../../types/products/product.js";

export const listCategoriesService = async (callback: (data: CategoryResponse) => void) => {
    try {
        // Categories are a short, stable list that fills a select on several
        // screens, so it is returned whole rather than paged.
        const categories = await Category.findAll({ order: [["name", "ASC"]] });

        return callback(messageHandler("Categories retrieved", true, SUCCESS, categories));
    } catch (error) {
        return callback(
            messageHandler("An error occured while loading categories.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const createCategoryService = async (
    input: CategoryInput,
    callback: (data: CategoryResponse) => void
) => {
    try {
        const name = input.name.trim();

        const existing = await Category.findOne({ where: { name } });
        if (existing) {
            return callback(messageHandler(`A category named ${name} already exists.`, false, CONFLICT, {}));
        }

        const category = await Category.create({
            name,
            description: input.description?.trim() || null,
        });

        return callback(messageHandler("Category created", true, SUCCESS, category));
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the category.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const updateCategoryService = async (
    id: string,
    input: CategoryInput,
    callback: (data: CategoryResponse) => void
) => {
    try {
        const category = await Category.findByPk(id);
        if (!category) {
            return callback(messageHandler("Category not found.", false, NOT_FOUND, {}));
        }

        const name = input.name.trim();

        const clash = await Category.findOne({ where: { name } });
        if (clash && clash.id !== id) {
            return callback(messageHandler(`A category named ${name} already exists.`, false, CONFLICT, {}));
        }

        await category.update({ name, description: input.description?.trim() || null });

        return callback(messageHandler("Category updated", true, SUCCESS, category));
    } catch (error) {
        return callback(
            messageHandler("An error occured while saving the category.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};

export const deleteCategoryService = async (id: string, callback: (data: CategoryResponse) => void) => {
    try {
        const category = await Category.findByPk(id);
        if (!category) {
            return callback(messageHandler("Category not found.", false, NOT_FOUND, {}));
        }

        // Deleting a category that products still point at would orphan them
        // and break every product list. The admin has to move them first.
        const inUse = await Product.count({ where: { categoryId: id } });
        if (inUse > 0) {
            return callback(
                messageHandler(
                    `${category.name} still holds ${inUse} product${inUse === 1 ? "" : "s"}. Move them to another category first.`,
                    false,
                    CONFLICT,
                    {}
                )
            );
        }

        await category.destroy();

        return callback(messageHandler("Category deleted", true, SUCCESS, {}));
    } catch (error) {
        return callback(
            messageHandler("An error occured while deleting the category.", false, INTERNAL_SERVER_ERROR, {})
        );
    }
};
