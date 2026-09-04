import { ROLES } from "../../schemas/users/authSchema.js";

const passwordRules = {
    isLength: {
        options: { min: 8 },
        errorMessage: 'Password must be at least 8 characters',
    },
};

export const createUserValidation = {
    name: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Full name is required',
        },
    },
    username: {
        // Lowercased in the service, so "Sarah" and "sarah" cannot become two
        // accounts that look identical on the sign-in screen.
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Username is required',
        },
        matches: {
            options: [/^[A-Za-z0-9._-]+$/],
            errorMessage: 'Username may use letters, numbers, dots, dashes and underscores only',
        },
    },
    role: {
        in: 'body',
        isIn: {
            options: [ROLES],
            errorMessage: 'Select a role',
        },
    },
    password: {
        in: 'body',
        isString: true,
        ...passwordRules,
    },
};

export const updateUserValidation = {
    name: createUserValidation.name,
    username: createUserValidation.username,
    role: createUserValidation.role,
};

export const setUserActiveValidation = {
    isActive: {
        in: 'body',
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'Invalid status',
    },
};

export const resetPasswordValidation = {
    password: {
        in: 'body',
        isString: true,
        ...passwordRules,
    },
};

export const settingsValidation = {
    name: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Pharmacy name is required',
        },
    },
    address: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Address is required',
        },
    },
    phone: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Phone number is required',
        },
    },
    receiptFooter: {
        in: 'body',
        isString: true,
        trim: true,
        errorMessage: 'Invalid receipt footer',
    },
    showLogoOnReceipt: {
        in: 'body',
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'Invalid logo setting',
    },
    lowStockAlertsEnabled: {
        in: 'body',
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'Invalid alert setting',
    },
    expiryAlertDays: {
        // The expiry bands top out at 90 days, so a longer window would flag
        // stock the rest of the application still calls healthy.
        in: 'body',
        isInt: {
            options: { min: 1, max: 365 },
            errorMessage: 'Expiry alert window must be between 1 and 365 days',
        },
        toInt: true,
    },
};
