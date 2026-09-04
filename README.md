## Quick Serve TypeScript – Starter Template

Production-ready Express + TypeScript starter with JWT auth, Sequelize (SQL), validation, file uploads, email (Nodemailer/Handlebars), and helpful utilities.

### Features
- **TypeScript + tsx**: Fast dev runtime with `tsx`, compiled builds via `tsc`
- **Express**: API server with middlewares (CORS, morgan, cookie-parser)
- **JWT Auth**: Access/refresh token generation and verification
- **Sequelize**: SQL ORM (MySQL by default); example `Auth` model wired
- **Validation**: `express-validator` examples for auth
- **Email**: Nodemailer + Handlebars templates and Brevo (Sendinblue) REST support
- **Uploads**: Cloudinary SDK integrated
- **Utilities**: Password hashing, token helpers, phone utils, message shaping

### Tech Stack
- Node.js, TypeScript
- Express, express-validator
- Sequelize, mysql2
- jsonwebtoken, bcrypt/bcryptjs
- Nodemailer, nodemailer-express-handlebars, Brevo API (axios)
- Cloudinary

### Project Structure
```
src/
  controllers/
    users/
      authController.ts         # register/login controllers
  middlewares/
    auth.ts                     # JWT verify middleware
  modules/
    notifications/
      email.ts                  # Nodemailer + Handlebars
      brevo.ts                  # Brevo REST email
    storage/
      cloudinary.ts             # Cloudinary upload helper
    views/                      # Handlebars email templates
  routes/
    index.ts                    # mounts routers under /api/v1
    users/
      index.ts                  # (wire controllers + validations here)
  schemas/
    users/
      authSchema.ts             # Sequelize model + init
  services/
    users/
      authService.ts            # register/login business logic
  types/
    users/auth.ts               # DTOs for auth
    nodemailer-express-handlebars.d.ts # local type shim
  utils/
    index.ts                    # hashing, jwt utils, validators, messageHandler
index.ts                        # app bootstrap (uses src/routes/index)
```

### Getting Started
1) Install dependencies
```bash
npm install
```

2) Configure environment (.env)
```bash
NODE_ENV=development
PORT=4000

# JWT
SECRET_KEY=your_jwt_secret

# Database (Sequelize / MySQL)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=quick_serve

# Nodemailer (Gmail example)
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your_app_password

# Brevo (optional)
BREVO_API_KEY=your_brevo_api_key
BREVO_SENDER_EMAIL=hello@example.com
BREVO_SENDER_NAME=Vyntra
BREVO_API_URL=https://api.brevo.com/v3/smtp/email

# Cloudinary (optional)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

3) Database setup
- Ensure `src/database/db.ts` (imported as `../../database/db.js`) connects Sequelize using env vars and exports a Sequelize instance.
- Confirm `Auth` model initialization succeeds. Run migrations or `sequelize.sync()` depending on your setup.

4) Run in development
```bash
npm run dev
```

5) Build and start
```bash
npm run build
npm start
```

The app responds at `/` with a simple health message and mounts API routes under `/api/v1`.

### Auth Flow
- Registration: creates user, hashes password, issues access/refresh tokens, stores refresh token + expiry.
- Login: verifies credentials, rotates refresh token, returns tokens and user summary.

Key files:
- `schemas/users/authSchema.ts` – `Auth` model with `email`, `password`, `refreshToken`, `refreshTokenExpiresAt`
- `services/users/authService.ts` – `registerService`, `loginService`
- `controllers/users/authController.ts` – `registerController`, `loginController`
- `middlewares/auth.ts` – `verify` middleware uses `SECRET_KEY`
- `types/users/auth.ts` – DTOs for requests/responses

### Validation
- `validations/users/authValidations.ts`
  - `registerValidation`: checks email format and password length (>= 8)
  - `loginValidation`: requires valid email and non-empty password

Integrate with routes via `express-validator` (example below).

### Routing
`src/routes/index.ts` mounts a user router under `/api/v1`. Wire your user routes in `src/routes/users/index.ts`:
```ts
import { Router } from 'express';
import { registerController, loginController } from '../../controllers/users/authController.js';
import { checkSchema } from 'express-validator';
import { registerValidation, loginValidation } from '../../validations/users/authValidations.js';

const router = Router();

router.post('/register', checkSchema(registerValidation), registerController);
router.post('/login', checkSchema(loginValidation), loginController);

export default router;
```
Then mount it in `routes/index.ts`:
```ts
import { Router } from 'express';
import buyerRouter from './users/index.js';

const baseRoute = '/api/v1';
const router = (app: any) => {
  app.use(`${baseRoute}/buyers`, buyerRouter);
};

export default router;
```

### Email
- Nodemailer + Handlebars: `src/modules/notifications/email.ts`
  - Templates live in `src/modules/views/*.handlebars`
  - Configure `EMAIL_USER` and `EMAIL_PASSWORD`
- Brevo REST: `src/modules/notifications/brevo.ts`
  - Requires `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_API_URL`

### File Uploads (Cloudinary)
- Configure Cloudinary env vars
- Use helper in `src/modules/storage/cloudinary.ts`

### Utilities
- `utils/index.ts` provides:
  - `hashPassword`, `verifyPassword`
  - `generateToken`, `verifyToken`
  - `passwordValidator`, phone helpers
  - `messageHandler` standardizes service responses

### Scripts
```json
{
  "dev": "nodemon --watch \"src/**/*.ts\" --exec tsx src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

### Environment and Types
- Local type shim for `nodemailer-express-handlebars` at `src/types/nodemailer-express-handlebars.d.ts`.
- Ensure `tsconfig.json` includes `src` (and `src/types`) within `include` so custom typings are picked up.

### Security Notes
- Store secrets in `.env` (never commit)
- Use strong `SECRET_KEY`
- Prefer app-specific passwords for email providers
- Rate-limit sensitive routes in production

### Health Check
- GET `/` returns a simple message confirming the server is running.

### Next Steps / Customization
- Add refresh token endpoint and rotation policies
- Add password reset and email verification flows
- Extend models and relationships in Sequelize
- Add integration tests and CI pipeline

### License
ISC

