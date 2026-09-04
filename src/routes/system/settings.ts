import express from 'express'
import { checkSchema } from 'express-validator';
import { validate } from '../../validations/index.js';
import { verify, authorize } from '../../middlewares/auth.js';
import {
  getSettingsController,
  updateSettingsController,
  listTerminalsController,
  listAuditController,
  auditEntityTypesController,
} from '../../controllers/system/settingController.js';
import { settingsValidation } from '../../validations/users/userValidations.js';

export const settingRouter = express.Router()

settingRouter.use(verify)

// Every signed-in terminal reads settings — the receipt needs the pharmacy's
// name, address and footer. Only an administrator can change them.
settingRouter.get('/', getSettingsController)
settingRouter.put(
  '/',
  authorize('ADMINISTRATOR'),
  validate(checkSchema(settingsValidation as any)),
  updateSettingsController
)

export const terminalRouter = express.Router()

terminalRouter.use(verify)

terminalRouter.get('/', listTerminalsController)

export const auditRouter = express.Router()

auditRouter.use(verify)

// The trail is administrator-only, and read-only for everyone. There is no
// POST, PATCH or DELETE here by design.
auditRouter.use(authorize('ADMINISTRATOR'))

auditRouter.get('/entity-types', auditEntityTypesController)
auditRouter.get('/', listAuditController)
