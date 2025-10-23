import { Router } from 'express';
import { UserTenantController } from '../controllers/userTenantController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Obter tenants disponíveis para o usuário
router.get('/', UserTenantController.getUserTenants);

// Obter tenant atual
router.get('/current', UserTenantController.getCurrentTenant);

// Trocar tenant ativo
router.post('/switch', UserTenantController.switchTenant);

// Gerenciar associações user-tenant (SUPERADMIN only)
router.post('/associations', UserTenantController.addUserToTenant);
router.delete('/associations/:userId/:tenantId', UserTenantController.removeUserFromTenant);
router.patch('/associations/:userId/:tenantId/role', UserTenantController.updateUserTenantRole);

// Listar usuários de um tenant (SUPERADMIN only)
router.get('/tenants/:tenantId/users', UserTenantController.getTenantUsers);

// Listar tenants de um usuário específico (SUPERADMIN only)
router.get('/users/:userId/tenants', UserTenantController.getUserTenantsById);

export default router;