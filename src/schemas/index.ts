// Importing every model in one place is what makes `sequelize.sync()` see the
// whole schema: a model that nothing has imported yet does not exist as far as
// Sequelize is concerned, so its table would silently never be created. The
// order matters too — a table referenced by a foreign key has to be defined
// before the table that points at it.
import Category from "./products/categorySchema.js";
import Product from "./products/productSchema.js";

import Batch from "./inventory/batchSchema.js";
import StockMovement from "./inventory/stockMovementSchema.js";
import StockAdjustment from "./inventory/stockAdjustmentSchema.js";

import Sale from "./sales/saleSchema.js";
import SaleItem from "./sales/saleItemSchema.js";
import SaleReturn from "./sales/saleReturnSchema.js";
import SaleReturnItem from "./sales/saleReturnItemSchema.js";

import Auth from "./users/authSchema.js";
import AuditLog from "./system/auditLogSchema.js";
import Setting from "./system/settingSchema.js";
import Terminal from "./system/terminalSchema.js";

export {
    Category,
    Product,
    Batch,
    StockMovement,
    StockAdjustment,
    Sale,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    Auth,
    AuditLog,
    Setting,
    Terminal,
};
