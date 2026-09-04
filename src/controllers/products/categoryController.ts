import { Request, Response } from "express";
import {
    listCategoriesService,
    createCategoryService,
    updateCategoryService,
    deleteCategoryService,
} from "../../services/products/categoryService.js";
import { CategoryInput } from "../../types/products/product.js";

export const listCategoriesController = async (_req: Request, res: Response) => {
    await listCategoriesService((result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const createCategoryController = async (req: Request<{}, {}, CategoryInput>, res: Response) => {
    await createCategoryService(req.body, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const updateCategoryController = async (
    req: Request<{ id: string }, {}, CategoryInput>,
    res: Response
) => {
    await updateCategoryService(req.params.id, req.body, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const deleteCategoryController = async (req: Request<{ id: string }>, res: Response) => {
    await deleteCategoryService(req.params.id, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
