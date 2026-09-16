import { Request, Response } from "express";
import {
    getExpenseSummaryService,
    listExpensesService,
    recordExpenseService,
    voidExpenseService,
} from "../../services/expenses/expenseService.js";
import { ExpenseInput, ExpenseListQuery, VoidExpenseInput } from "../../types/expenses/expense.js";
import { AuthenticatedUser } from "../../types/users/auth.js";

export const listExpensesController = async (req: Request, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await listExpensesService(req.query as ExpenseListQuery, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const recordExpenseController = async (req: Request<{}, {}, ExpenseInput>, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await recordExpenseService(req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const voidExpenseController = async (
    req: Request<{ id: string }, {}, VoidExpenseInput>,
    res: Response
) => {
    const user = (req as any).user as AuthenticatedUser;

    await voidExpenseService(req.params.id, req.body, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};

export const getExpenseSummaryController = async (req: Request, res: Response) => {
    const user = (req as any).user as AuthenticatedUser;

    await getExpenseSummaryService(req.query as ExpenseListQuery, user, (result) => {
        return res.status(result.statusCode).json(result);
    });
};
