import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  getAlerts,
  createAlert,
  resolveAlert,
  getAlertsSummary
} from '../controllers/alertsController';

const router = Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// GET /api/alerts - List alerts
router.get('/', getAlerts);

// GET /api/alerts/summary - Alert summary for dashboard
router.get('/summary', getAlertsSummary);

// POST /api/alerts - Create new alert (Admin+ only)
router.post('/', createAlert);

// PUT /api/alerts/:id/resolve - Resolve alert
router.put('/:id/resolve', resolveAlert);

export default router;