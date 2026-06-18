import express from 'express';
import {
  getNotifications,
  markNotificationsRead,
  markSingleNotificationRead
} from '../controllers/notification.controller.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // Secure all notification routes

router.get('/', getNotifications);
router.put('/read', markNotificationsRead);
router.patch('/:id/read', markSingleNotificationRead);

export default router;
