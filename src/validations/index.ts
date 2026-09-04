import { validationResult, checkSchema } from 'express-validator';

export const validate = (validations: any) => {
    return async (req: any, res: any, next: any) => {
        let chains;
        if (Array.isArray(validations)) {
            chains = validations;
        } else if (typeof validations === 'object') {
            chains = checkSchema(validations);
        } else {
            throw new Error('Invalid validations format');
        }
        await Promise.all(chains.map((validation: any) => validation.run(req)));
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(422).json({ errors: errors.array() });
        }
        next();
    }
}