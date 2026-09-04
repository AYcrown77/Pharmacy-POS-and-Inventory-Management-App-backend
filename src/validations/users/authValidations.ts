export const loginValidation = {
    username: {
        in: 'body',
        isString: true,
        trim: true,
        notEmpty: {
            errorMessage: 'Username is required',
        },
        errorMessage: 'Invalid username',
    },
    password: {
        in: 'body',
        isString: true,
        notEmpty: {
            errorMessage: 'Password is required',
        },
        errorMessage: 'Invalid password',
    },
    terminalId: {
        in: 'body',
        optional: true,
        isString: true,
        errorMessage: 'Invalid terminal',
    }
}
