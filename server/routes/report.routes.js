import express from 'express';
import {
  getDashboardSummary,
  getAnalytics,
  getMonthlyReport
} from '../controllers/report.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all report routes

router.get('/dashboard', getDashboardSummary);
router.get('/analytics', getAnalytics);
router.get('/monthly', getMonthlyReport);

export default router;
