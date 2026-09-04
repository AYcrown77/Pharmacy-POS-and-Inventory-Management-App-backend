import express from 'express'
import { checkSchema } from 'express-validator';
import { validate } from '../../validations/index.js';
import { verify, authorize } from '../../middlewares/auth.js';
import { loginController, sessionController, logoutController } from "../../controllers/users/authController.js";
import {
  listUsersController,
  getUserController,
  createUserController,
  updateUserController,
  setUserActiveController,
  resetPasswordController,
} from '../../controllers/users/userController.js';
import { loginValidation } from '../../validations/users/authValidations.js';
import {
  createUserValidation,
  updateUserValidation,
  setUserActiveValidation,
  resetPasswordValidation,
} from '../../validations/users/userValidations.js';

export const authRouter = express.Router()

authRouter.post('/login', validate(checkSchema(loginValidation as any)), loginController)
authRouter.get('/session', verify, sessionController)
authRouter.post('/logout', verify, logoutController)

export const userRouter = express.Router()

// Managing staff accounts is an administrator's job throughout.
userRouter.use(verify)
userRouter.use(authorize('ADMINISTRATOR'))

userRouter.get('/', listUsersController)
userRouter.get('/:id', getUserController)

userRouter.post('/', validate(checkSchema(createUserValidation as any)), createUserController)
userRouter.patch('/:id', validate(checkSchema(updateUserValidation as any)), updateUserController)
userRouter.patch(
  '/:id/status',
  validate(checkSchema(setUserActiveValidation as any)),
  setUserActiveController
)
userRouter.post(
  '/:id/password',
  validate(checkSchema(resetPasswordValidation as any)),
  resetPasswordController
)

// Accounts are disabled through /status, never deleted — the sales, movements
// and audit entries that name them have to keep their author.
