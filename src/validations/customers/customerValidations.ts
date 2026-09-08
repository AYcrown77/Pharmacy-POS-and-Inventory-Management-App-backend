export const customerValidation = {
    name: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Customer name is required',
        },
        isLength: {
            options: { max: 120 },
            errorMessage: 'Customer name is too long',
        },
    },
    phone: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid phone number',
    },
    note: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid note',
    },
    isActive: {
        in: 'body',
        optional: true,
        isBoolean: true,
        toBoolean: true,
        errorMessage: 'Invalid status',
    },
};

export const repaymentValidation = {
    amount: {
        // Kobo, and strictly positive: a repayment of nothing is a mistake,
        // and a negative one would be a charge wearing the wrong label.
        in: 'body',
        isInt: {
            options: { min: 1 },
            errorMessage: 'Enter an amount greater than zero',
        },
        toInt: true,
    },
    reason: {
        in: 'body',
        optional: { options: { nullable: true } },
        isString: true,
        trim: true,
        errorMessage: 'Invalid reason',
    },
    allowOverpayment: {
        in: 'body',
        optional: true,
        isBoolean: true,
        toBoolean: true,
    },
};
