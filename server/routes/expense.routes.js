import express from 'express';
import {
  addExpense,
  getGroupExpenses,
  updateExpense,
  deleteExpense,
  searchExpenses
} from '../controllers/expense.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all expense routes

router.post('/', addExpense);
router.get('/group/:groupId', getGroupExpenses);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);
router.get('/search', searchExpenses);

export default router;
