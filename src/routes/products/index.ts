import express from 'express'
import { checkSchema } from 'express-validator';
import { validate } from '../../validations/index.js';
import { verify, authorize } from '../../middlewares/auth.js';
import {
  listProductsController,
  getProductController,
  getProductByBarcodeController,
  searchProductsController,
  saleLookupController,
  createProductController,
  updateProductController,
} from '../../controllers/products/productController.js';
import {
  listCategoriesController,
  createCategoryController,
  updateCategoryController,
  deleteCategoryController,
} from '../../controllers/products/categoryController.js';
import { batchesForProductController } from '../../controllers/inventory/inventoryController.js';
import { productValidation, categoryValidation } from '../../validations/products/productValidations.js';

export const productRouter = express.Router()

// Everything here needs a session. Reading the catalogue is open to both
// roles — a cashier has to be able to find what a customer is asking for —
// but writing to it is an administrator's job.
productRouter.use(verify)

// The fixed segments are declared before `/:id`, or Express would read
// "search" as a product id and the lookups would 404.
productRouter.get('/search', searchProductsController)
productRouter.get('/barcode/:barcode', getProductByBarcodeController)
productRouter.get('/sale-lookup/:idOrBarcode', saleLookupController)

productRouter.get('/', listProductsController)
productRouter.get('/:id/batches', batchesForProductController)
productRouter.get('/:id', getProductController)

productRouter.post(
  '/',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(productValidation as any)),
  createProductController
)
productRouter.patch(
  '/:id',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(productValidation as any)),
  updateProductController
)

export const categoryRouter = express.Router()

categoryRouter.use(verify)

categoryRouter.get('/', listCategoriesController)
categoryRouter.post(
  '/',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(categoryValidation as any)),
  createCategoryController
)
categoryRouter.patch(
  '/:id',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(categoryValidation as any)),
  updateCategoryController
)
categoryRouter.delete('/:id', authorize('ADMINISTRATOR'), deleteCategoryController)
