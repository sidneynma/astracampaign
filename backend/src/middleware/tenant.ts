import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';

export const attachTenant = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    if (req.user.role === 'SUPERADMIN' && req.user.tenantId === undefined) {
      next();
      return;
    }

    if (!req.user.tenantId) {
      res.status(401).json({
        success: false,
        message: 'Tenant não definido para o usuário'
      });
      return;
    }

    if (!req.tenant) {
      res.status(500).json({
        success: false,
        message: 'Erro ao carregar informações do tenant'
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Erro no middleware attachTenant:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Usuário não autenticado'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Acesso negado. Permissão insuficiente.'
      });
      return;
    }

    next();
  };
};

export const superAdminOnly = requireRole(['SUPERADMIN']);
export const tenantAdminOnly = requireRole(['TENANT_ADMIN', 'SUPERADMIN']);
export const authenticatedOnly = requireRole(['USER', 'TENANT_ADMIN', 'SUPERADMIN']);