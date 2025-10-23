import { Router } from 'express';
import { AnalyticsController } from '../controllers/analyticsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/analytics/tenant - Relatório completo do tenant do usuário
router.get('/tenant', AnalyticsController.getTenantAnalytics);

// GET /api/analytics/system - Relatório consolidado do sistema (SuperAdmin only)
router.get('/system', AnalyticsController.getSystemAnalytics);

// GET /api/analytics/campaigns - Relatório de performance de campanhas
router.get('/campaigns', AnalyticsController.getCampaignAnalytics);

// GET /api/analytics/export/:type - Exporta dados em CSV (contacts, campaigns, analytics)
router.get('/export/:type', AnalyticsController.exportData);

// GET /api/analytics/tenant/:tenantId - Analytics de tenant específico (SuperAdmin only)
router.get('/tenant/:tenantId', AnalyticsController.getSpecificTenantAnalytics);

export default router;