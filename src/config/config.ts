import dotenv from 'dotenv';

dotenv.config();

export const config = {
    server: {
        port: process.env.PORT || 5000,
        env: process.env.NODE_ENV || 'development'
    },
    database: {
        name: process.env.DB_NAME || 'mustan_pharmacy',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432
    },
    auth: {
        secretKey: process.env.SECRET_KEY as string,
        // The pharmacy runs shifts, so a session lasts a working day.
        sessionExpiresIn: process.env.SESSION_EXPIRES_IN || '12h',
        cookieName: process.env.SESSION_COOKIE_NAME || 'mhp_session'
    },
    cors: {
        // The terminals reach the API through the Next.js server on the same
        // origin, but the origin is listed so cookies survive direct calls
        // during development.
        origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',')
    },
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        port: process.env.DB_PORT || 5432
    },
    test: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        port: process.env.DB_PORT || 5432
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST || '127.0.0.1',
        dialect: 'postgres',
        port: process.env.DB_PORT || 5432
    }
};
