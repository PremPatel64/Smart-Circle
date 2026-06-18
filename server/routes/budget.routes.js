import express from 'express';
import {
  getBudget,
  setBudget,
  getBudgetStatus
} from '../controllers/budget.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all budget routes

router.get('/status/:month?', getBudgetStatus);
router.get('/:month?', getBudget);
router.post('/', setBudget);

export default router;
