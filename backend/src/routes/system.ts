import { Router } from 'express';
import {
  getSystemStats,
  getTenantStats,
  getSystemHealth,
  refreshStats,
  getQuotasAlerts
} from '../controllers/systemController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Aplicar middleware de autenticação para todas as rotas
router.use(authMiddleware);

// Estatísticas gerais do sistema
router.get('/stats', getSystemStats);

// Estatísticas detalhadas por tenant
router.get('/tenant-stats', getTenantStats);

// Status de saúde do sistema
router.get('/health', getSystemHealth);

// Alertas de quotas excedidas
router.get('/quotas-alerts', getQuotasAlerts);

// Atualizar estatísticas materializadas
router.post('/refresh-stats', refreshStats);

export { router as systemRoutes };