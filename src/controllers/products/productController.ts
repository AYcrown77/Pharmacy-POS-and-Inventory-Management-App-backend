import { Request, Response } from "express";
import {
    listProductsService,
    getProductService,
    getProductByBarcodeService,
    searchProductsService,
    saleLookupService,
    createProductService,
    updateProductService,
} from "../../services/products/productService.js";
import { ProductInput, ProductListQuery } from "../../types/products/product.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const listProductsController = async (req: Request, res: Response) => {
    await listProductsService(req.query as ProductListQuery, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getProductController = async (req: Request, res: Response) => {
    await getProductService(req.params.id, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getProductByBarcodeController = async (req: Request, res: Response) => {
    await getProductByBarcodeService(req.params.barcode, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const searchProductsController = async (req: Request, res: Response) => {
    const term = String(req.query.q ?? "");
    const parsed = Number(req.query.limit);
    const limit = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 50) : 12;

    await searchProductsService(term, limit, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const saleLookupController = async (req: Request, res: Response) => {
    await saleLookupService(req.params.idOrBarcode, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const createProductController = async (req: Request<{}, {}, ProductInput>, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await createProductService(req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const updateProductController = async (
    req: Request<{ id: string }, {}, ProductInput>,
    res: Response
) => {
    const user = (req as any).user as AuthenticatedUser;

    await updateProductService(req.params.id, req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
