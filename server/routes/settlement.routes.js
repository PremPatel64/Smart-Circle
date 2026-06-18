import express from 'express';
import {
  getOptimization,
  confirmOptimization,
  createSettlement,
  confirmSettlement,
  getGroupSettlements
} from '../controllers/settlement.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all settlement routes

router.get('/optimize/:groupId', getOptimization);
router.post('/optimize/:groupId', confirmOptimization);
router.post('/pay', createSettlement);
router.post('/', createSettlement);
router.put('/:id/confirm', confirmSettlement);
router.get('/group/:groupId', getGroupSettlements);

export default router;
