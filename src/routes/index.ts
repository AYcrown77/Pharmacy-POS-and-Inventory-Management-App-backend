import { authRouter, userRouter } from "./users/index.js"
import { healthRouter } from "./system/index.js"
import { productRouter, categoryRouter } from "./products/index.js"
import { inventoryRouter, batchRouter, movementRouter } from "./inventory/index.js"
import { stockRouter, supplierRouter } from "./stock/index.js"
import { saleRouter, returnRouter } from "./sales/index.js"
import { reportRouter } from "./reports/index.js"
import { settingRouter, terminalRouter, auditRouter } from "./system/settings.js"

const baseRoute = '/api/v1'

const router = (app: any) => {
  app.use(`${baseRoute}/auth`, authRouter)
  app.use(`${baseRoute}/users`, userRouter)
  app.use(`${baseRoute}/health`, healthRouter)
  app.use(`${baseRoute}/products`, productRouter)
  app.use(`${baseRoute}/categories`, categoryRouter)
  app.use(`${baseRoute}/inventory`, inventoryRouter)
  app.use(`${baseRoute}/batches`, batchRouter)
  app.use(`${baseRoute}/stock-movements`, movementRouter)
  app.use(`${baseRoute}/stock`, stockRouter)
  app.use(`${baseRoute}/suppliers`, supplierRouter)
  app.use(`${baseRoute}/sales`, saleRouter)
  app.use(`${baseRoute}/returns`, returnRouter)
  app.use(`${baseRoute}/reports`, reportRouter)
  app.use(`${baseRoute}/settings`, settingRouter)
  app.use(`${baseRoute}/terminals`, terminalRouter)
  app.use(`${baseRoute}/audit`, auditRouter)
}

export default router
