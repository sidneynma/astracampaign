import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  getNotificationsSummary
} from '../controllers/notificationsController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/notifications - Get user notifications
router.get('/', getNotifications);

// GET /api/notifications/summary - Notifications summary
router.get('/summary', getNotificationsSummary);

// GET /api/notifications/unread-count - Get unread count
router.get('/unread-count', getUnreadCount);

// POST /api/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', markAllAsRead);

// POST /api/notifications/:id/mark-read - Mark notification as read
router.post('/:id/mark-read', markAsRead);

// DELETE /api/notifications/:id - Delete notification
router.delete('/:id', deleteNotification);

export default router;