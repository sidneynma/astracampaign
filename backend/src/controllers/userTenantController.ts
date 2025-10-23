import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export class UserTenantController {
  // Listar tenants aos quais o usuário tem acesso
  static async getUserTenants(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📋 UserTenantController.getUserTenants - user:', req.user?.email);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      // Buscar todos os tenants onde o usuário tem acesso via UserTenant
      // Isso vale para TODOS os usuários, incluindo SUPERADMIN
      const userTenants = await prisma.userTenant.findMany({
        where: {
          userId: req.user.id,
          tenant: { active: true }
        },
        include: {
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
              active: true
            }
          }
        },
        orderBy: {
          tenant: { name: 'asc' }
        }
      });

      res.json({
        success: true,
        tenants: userTenants.map(ut => ({
          ...ut.tenant,
          role: ut.role,
          current: req.tenantId === ut.tenantId
        }))
      });

    } catch (error) {
      console.error('❌ UserTenantController.getUserTenants - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Trocar tenant ativo
  static async switchTenant(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId } = req.body;
      console.log('🔄 UserTenantController.switchTenant - user:', req.user?.email, 'tenantId:', tenantId);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      // Verificar se o tenantId foi fornecido
      if (!tenantId) {
        return res.status(400).json({
          success: false,
          message: 'ID do tenant é obrigatório'
        });
      }

      // Verificar se o tenant existe e está ativo
      const tenant = await prisma.tenant.findUnique({
        where: {
          id: tenantId,
          active: true
        },
        select: {
          id: true,
          slug: true,
          name: true,
          active: true
        }
      });

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado ou inativo'
        });
      }

      // SUPERADMIN pode acessar qualquer tenant
      if (req.user.role === 'SUPERADMIN') {
        // Gerar novo token com o novo tenantId
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
          throw new Error('JWT_SECRET não configurado');
        }

        const newToken = jwt.sign(
          {
            userId: req.user.id,
            email: req.user.email,
            role: req.user.role,
            tenantId: tenantId
          },
          jwtSecret,
          { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
        );

        return res.json({
          success: true,
          message: 'Tenant alterado com sucesso',
          tenant: tenant,
          token: newToken
        });
      }

      // Para usuários normais, verificar se têm acesso ao tenant via UserTenant
      const userTenantAccess = await prisma.userTenant.findFirst({
        where: {
          userId: req.user.id,
          tenantId: tenantId
        }
      });

      if (!userTenantAccess) {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado ao tenant solicitado'
        });
      }

      // Gerar novo token com o novo tenantId
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET não configurado');
      }

      const newToken = jwt.sign(
        {
          userId: req.user.id,
          email: req.user.email,
          role: req.user.role,
          tenantId: tenantId
        },
        jwtSecret,
        { expiresIn: process.env.JWT_EXPIRES_IN || '24h' } as jwt.SignOptions
      );

      res.json({
        success: true,
        message: 'Tenant alterado com sucesso',
        tenant: tenant,
        token: newToken
      });

    } catch (error) {
      console.error('❌ UserTenantController.switchTenant - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Obter tenant atual
  static async getCurrentTenant(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔍 UserTenantController.getCurrentTenant - user:', req.user?.email, 'tenantId:', req.tenantId);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      // Se não há tenantId, usuário é SUPERADMIN sem tenant selecionado
      if (!req.tenantId) {
        return res.json({
          success: true,
          tenant: null,
          user: {
            id: req.user.id,
            nome: req.user.nome,
            email: req.user.email,
            role: req.user.role
          }
        });
      }

      // Buscar dados do tenant atual
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: {
          id: true,
          slug: true,
          name: true,
          active: true
        }
      });

      res.json({
        success: true,
        tenant: tenant,
        user: {
          id: req.user.id,
          nome: req.user.nome,
          email: req.user.email,
          role: req.user.role
        }
      });

    } catch (error) {
      console.error('❌ UserTenantController.getCurrentTenant - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Associar usuário a um tenant (SUPERADMIN only)
  static async addUserToTenant(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, tenantId, role = 'USER' } = req.body;
      console.log('➕ UserTenantController.addUserToTenant - userId:', userId, 'tenantId:', tenantId, 'role:', role);

      // Apenas SUPERADMIN pode associar usuários a tenants
      if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. Apenas SUPERADMIN pode gerenciar associações.'
        });
      }

      if (!userId || !tenantId) {
        return res.status(400).json({
          success: false,
          message: 'userId e tenantId são obrigatórios'
        });
      }

      // Verificar se usuário existe
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'Usuário não encontrado'
        });
      }

      // Verificar se tenant existe
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId }
      });

      if (!tenant) {
        return res.status(404).json({
          success: false,
          message: 'Tenant não encontrado'
        });
      }

      // Verificar se já existe a associação
      const existingAssociation = await prisma.userTenant.findFirst({
        where: {
          userId,
          tenantId
        }
      });

      if (existingAssociation) {
        return res.status(400).json({
          success: false,
          message: 'Usuário já está associado a este tenant'
        });
      }

      // Criar associação
      const userTenant = await prisma.userTenant.create({
        data: {
          userId,
          tenantId,
          role: role || 'USER'
        },
        include: {
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
              active: true
            }
          }
        }
      });

      console.log('✅ UserTenantController.addUserToTenant - associação criada');

      res.status(201).json({
        success: true,
        message: 'Usuário associado ao tenant com sucesso',
        userTenant
      });

    } catch (error) {
      console.error('❌ UserTenantController.addUserToTenant - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Remover usuário de um tenant (SUPERADMIN only)
  static async removeUserFromTenant(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, tenantId } = req.params;
      console.log('➖ UserTenantController.removeUserFromTenant - userId:', userId, 'tenantId:', tenantId);

      // Apenas SUPERADMIN pode remover associações
      if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado. Apenas SUPERADMIN pode gerenciar associações.'
        });
      }

      // Verificar se a associação existe
      const userTenant = await prisma.userTenant.findFirst({
        where: {
          userId,
          tenantId
        }
      });

      if (!userTenant) {
        return res.status(404).json({
          success: false,
          message: 'Associação não encontrada'
        });
      }

      // Remover associação
      await prisma.userTenant.delete({
        where: { id: userTenant.id }
      });

      console.log('✅ UserTenantController.removeUserFromTenant - associação removida');

      res.json({
        success: true,
        message: 'Usuário removido do tenant com sucesso'
      });

    } catch (error) {
      console.error('❌ UserTenantController.removeUserFromTenant - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Listar todos os usuários de um tenant (SUPERADMIN only)
  static async getTenantUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const { tenantId } = req.params;
      console.log('📋 UserTenantController.getTenantUsers - tenantId:', tenantId);

      // Apenas SUPERADMIN pode listar usuários de qualquer tenant
      if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      const userTenants = await prisma.userTenant.findMany({
        where: { tenantId },
        include: {
          user: {
            select: {
              id: true,
              nome: true,
              email: true,
              role: true,
              ativo: true,
              criadoEm: true
            }
          }
        },
        orderBy: {
          user: { nome: 'asc' }
        }
      });

      res.json({
        success: true,
        users: userTenants.map(ut => ({
          ...ut.user,
          tenantRole: ut.role
        }))
      });

    } catch (error) {
      console.error('❌ UserTenantController.getTenantUsers - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Listar tenants de um usuário específico (SUPERADMIN only)
  static async getUserTenantsById(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId } = req.params;
      console.log('📋 UserTenantController.getUserTenantsById - userId:', userId);

      // Apenas SUPERADMIN pode buscar tenants de outros usuários
      if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      const userTenants = await prisma.userTenant.findMany({
        where: {
          userId,
          tenant: { active: true }
        },
        include: {
          tenant: {
            select: {
              id: true,
              slug: true,
              name: true,
              active: true
            }
          }
        },
        orderBy: {
          tenant: { name: 'asc' }
        }
      });

      res.json({
        success: true,
        tenants: userTenants.map(ut => ({
          ...ut.tenant,
          role: ut.role
        }))
      });

    } catch (error) {
      console.error('❌ UserTenantController.getUserTenantsById - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Atualizar role do usuário em um tenant específico (SUPERADMIN only)
  static async updateUserTenantRole(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, tenantId } = req.params;
      const { role } = req.body;
      console.log('🔄 UserTenantController.updateUserTenantRole - userId:', userId, 'tenantId:', tenantId, 'role:', role);

      // Apenas SUPERADMIN pode atualizar roles
      if (req.user?.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
      }

      if (!role || !['USER', 'ADMIN'].includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Role inválida. Use USER ou ADMIN'
        });
      }

      // Buscar associação
      const userTenant = await prisma.userTenant.findFirst({
        where: {
          userId,
          tenantId
        }
      });

      if (!userTenant) {
        return res.status(404).json({
          success: false,
          message: 'Associação não encontrada'
        });
      }

      // Atualizar role
      const updated = await prisma.userTenant.update({
        where: { id: userTenant.id },
        data: { role },
        include: {
          user: {
            select: {
              id: true,
              nome: true,
              email: true
            }
          },
          tenant: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      console.log('✅ UserTenantController.updateUserTenantRole - role atualizada');

      res.json({
        success: true,
        message: 'Role atualizada com sucesso',
        userTenant: updated
      });

    } catch (error) {
      console.error('❌ UserTenantController.updateUserTenantRole - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}