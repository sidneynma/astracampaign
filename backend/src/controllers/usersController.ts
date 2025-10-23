import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth';
// import { auditService, AuditAction } from '../services/auditService';

const prisma = new PrismaClient();

interface UserResponse {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
  tenantId?: string | null;
  ultimoLogin?: Date | null;
  criadoEm: Date;
  atualizadoEm: Date;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    active: boolean;
  } | null;
}

const sanitizeUser = (user: any): UserResponse => {
  const { senha, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// Hierarchy validation - who can manage whom
const canManageRole = (managerRole: string, targetRole: string): boolean => {
  const hierarchy: { [key: string]: string[] } = {
    'SUPERADMIN': ['SUPERADMIN', 'ADMIN', 'USER'],
    'ADMIN': ['ADMIN', 'USER'],
    'USER': []
  };

  return hierarchy[managerRole]?.includes(targetRole) || false;
};

// Get allowed roles for user creation/update
const getAllowedRoles = (userRole: string): string[] => {
  switch (userRole) {
    case 'SUPERADMIN':
      return ['SUPERADMIN', 'ADMIN', 'USER'];
    case 'ADMIN':
      return ['ADMIN', 'USER']; // ADMIN cannot manage SUPERADMIN users
    case 'USER':
    default:
      return [];
  }
};

export const usersValidators = {
  create: [
    body('nome')
      .isLength({ min: 2 })
      .withMessage('Nome deve ter pelo menos 2 caracteres')
      .trim(),
    body('email')
      .isEmail()
      .withMessage('E-mail inválido')
      .normalizeEmail(),
    body('senha')
      .isLength({ min: 6 })
      .withMessage('Senha deve ter pelo menos 6 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número'),
    body('role')
      .isIn(['ADMIN', 'USER', 'SUPERADMIN'])
      .withMessage('Role deve ser ADMIN, USER ou SUPERADMIN'),
    body('tenantId')
      .optional()
      .isUUID()
      .withMessage('TenantId deve ser um UUID válido')
  ],
  update: [
    body('nome')
      .optional()
      .isLength({ min: 2 })
      .withMessage('Nome deve ter pelo menos 2 caracteres')
      .trim(),
    body('email')
      .optional()
      .isEmail()
      .withMessage('E-mail inválido')
      .normalizeEmail(),
    body('senha')
      .optional()
      .isLength({ min: 6 })
      .withMessage('Senha deve ter pelo menos 6 caracteres')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número'),
    body('role')
      .optional()
      .isIn(['ADMIN', 'USER', 'SUPERADMIN'])
      .withMessage('Role deve ser ADMIN, USER ou SUPERADMIN'),
    body('ativo')
      .optional()
      .isBoolean()
      .withMessage('Ativo deve ser um valor booleano'),
    body('tenantId')
      .optional()
      .isUUID()
      .withMessage('TenantId deve ser um UUID válido')
  ]
};

export const getUsers = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const tenantId = req.query.tenantId as string;
    const ativo = req.query.ativo ? req.query.ativo === 'true' : undefined;

    const skip = (page - 1) * pageSize;

    let where: any = {};

    // Role-based filtering
    if (req.user?.role === 'USER') {
      // USER can only see themselves
      where.id = req.user?.id;
    } else if (req.tenantId) {
      // ADMIN e SUPERADMIN (com tenant selecionado) veem usuários associados ao tenant
      // Buscar através da tabela UserTenant
      where.tenants = {
        some: {
          tenantId: req.tenantId
        }
      };

      // ADMIN não pode ver SUPERADMIN users
      if (req.user?.role === 'ADMIN') {
        where.role = {
          not: 'SUPERADMIN'
        };
      }
    } else if (req.user?.role === 'SUPERADMIN' && !req.tenantId) {
      // SUPERADMIN sem tenant selecionado vê todos
      // Não aplicar filtro de tenant
    }

    // Apply additional filters
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role && getAllowedRoles(req.user?.role || '').includes(role)) {
      // ADMIN cannot filter by SUPERADMIN role
      if (req.user?.role === 'ADMIN' && role === 'SUPERADMIN') {
        // Do nothing - ignore this filter
      } else {
        where.role = role;
      }
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              active: true
            }
          }
        },
        orderBy: { criadoEm: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    // Log audit - temporarily commented for build
    // await auditService.logUserAction(
    //   AuditAction.USER_CREATE, // This should be a "VIEW" action, but using existing enum
    //   req.user?.id || '',
    //   req.user?.tenantId || 'system',
    //   { action: 'list_users', filters: { search, role, tenantId, ativo } },
    //   req
    // );

    res.json({
      success: true,
      data: {
        users: users.map(user => sanitizeUser(user)),
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        },
        userRole: req.user?.role,
        allowedRoles: getAllowedRoles(req.user?.role || '')
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Get all users (SUPERADMIN only - visão global sem filtro de tenant)
export const getAllUsersGlobal = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Apenas SUPERADMIN pode acessar visão global
    if (req.user?.role !== 'SUPERADMIN') {
      res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
      return;
    }

    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;
    const ativo = req.query.ativo ? req.query.ativo === 'true' : undefined;

    const skip = (page - 1) * pageSize;

    let where: any = {};

    // Filtros opcionais
    if (search) {
      where.OR = [
        { nome: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (role) {
      where.role = role;
    }

    if (ativo !== undefined) {
      where.ativo = ativo;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          tenant: {
            select: {
              id: true,
              name: true,
              slug: true,
              active: true
            }
          },
          tenants: {
            include: {
              tenant: {
                select: {
                  id: true,
                  name: true,
                  slug: true
                }
              }
            }
          }
        },
        orderBy: { criadoEm: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      success: true,
      data: {
        users: users.map(user => sanitizeUser(user)),
        pagination: {
          page,
          pageSize,
          total,
          totalPages
        },
        userRole: req.user?.role,
        allowedRoles: getAllowedRoles(req.user?.role || '')
      }
    });
  } catch (error) {
    console.error('Erro ao buscar todos os usuários (global):', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const getUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Check if user can view this specific user
    let where: any = { id };

    if (req.user?.role === 'USER' && req.user?.id !== id) {
      res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
      return;
    }

    if (req.user?.role === 'ADMIN') {
      // Admin can only see users in their tenant
      const targetUser = await prisma.user.findUnique({ where: { id } });
      if (targetUser?.tenantId !== req.user?.tenantId) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
        return;
      }
    }

    const user = await prisma.user.findUnique({
      where,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            active: true
          }
        }
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
      return;
    }

    const { nome, email, senha, role, tenantId } = req.body;

    // Validate role hierarchy
    if (!canManageRole(req.user?.role || '', role)) {
      res.status(403).json({
        success: false,
        message: 'Você não tem permissão para criar usuários com este nível'
      });
      return;
    }

    // Validate tenant assignment
    let finalTenantId = null;

    if (role === 'SUPERADMIN') {
      // SUPERADMIN users don't have tenant
      finalTenantId = null;
    } else {
      if (req.user?.role === 'SUPERADMIN') {
        // SUPERADMIN can assign any tenant
        if (!tenantId) {
          res.status(400).json({
            success: false,
            message: 'TenantId é obrigatório para usuários não SUPERADMIN'
          });
          return;
        }

        // Verify tenant exists
        const tenant = await prisma.tenant.findUnique({
          where: { id: tenantId }
        });

        if (!tenant) {
          res.status(400).json({
            success: false,
            message: 'Tenant não encontrado'
          });
          return;
        }

        finalTenantId = tenantId;
      } else {
        // ADMIN can only assign users to their own tenant
        finalTenantId = req.user?.tenantId;
      }
    }

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      res.status(400).json({
        success: false,
        message: 'E-mail já está em uso'
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(senha, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        nome,
        email,
        senha: hashedPassword,
        role,
        tenantId: finalTenantId
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            active: true
          }
        }
      }
    });

    // Log audit - temporarily commented for build
    // await auditService.logUserAction(
    //   AuditAction.USER_CREATE,
    //   req.user?.id || '',
    //   req.user?.tenantId || 'system',
    //   {
    //     createdUserId: user.id,
    //     createdUserEmail: user.email,
    //     createdUserRole: user.role,
    //     assignedTenantId: finalTenantId
    //   },
    //   req
    // );

    res.status(201).json({
      success: true,
      message: 'Usuário criado com sucesso',
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        success: false,
        message: 'Dados inválidos',
        errors: errors.array()
      });
      return;
    }

    const { id } = req.params;
    const { nome, email, senha, role, ativo, tenantId } = req.body;

    // Get existing user
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: { tenant: true }
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
      return;
    }

    // Check permissions
    if (req.user?.role === 'USER' && req.user?.id !== id) {
      res.status(403).json({
        success: false,
        message: 'Você só pode editar seu próprio perfil'
      });
      return;
    }

    if (req.user?.role === 'ADMIN') {
      // Admin can only edit users in their tenant
      if (existingUser.tenantId !== req.user?.tenantId) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
        return;
      }

      // Admin cannot change their own role or status
      if (existingUser.id === req.user?.id && (role !== undefined || ativo !== undefined)) {
        res.status(403).json({
          success: false,
          message: 'Você não pode alterar seu próprio nível ou status'
        });
        return;
      }
    }

    // Validate role change
    if (role !== undefined && !canManageRole(req.user?.role || '', role)) {
      res.status(403).json({
        success: false,
        message: 'Você não tem permissão para definir este nível'
      });
      return;
    }

    // Check email uniqueness
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({
        where: { email }
      });

      if (emailInUse) {
        res.status(400).json({
          success: false,
          message: 'E-mail já está em uso por outro usuário'
        });
        return;
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (nome !== undefined) updateData.nome = nome;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (ativo !== undefined) updateData.ativo = ativo;

    // Handle tenant assignment
    if (req.user?.role === 'SUPERADMIN' && tenantId !== undefined) {
      if (role === 'SUPERADMIN') {
        updateData.tenantId = null;
      } else {
        updateData.tenantId = tenantId;
      }
    }

    // Hash new password if provided
    if (senha) {
      updateData.senha = await bcrypt.hash(senha, 12);
    }

    // Update user
    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            active: true
          }
        }
      }
    });

    // Log audit - temporarily commented for build
    // await auditService.logDataChange(
    //   AuditAction.USER_UPDATE,
    //   'User',
    //   id,
    //   req.user?.tenantId || 'system',
    //   req.user?.id || '',
    //   existingUser,
    //   user,
    //   req
    // );

    res.json({
      success: true,
      message: 'Usuário atualizado com sucesso',
      data: {
        user: sanitizeUser(user)
      }
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Get existing user
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      res.status(404).json({
        success: false,
        message: 'Usuário não encontrado'
      });
      return;
    }

    // Cannot delete yourself
    if (req.user?.id === id) {
      res.status(400).json({
        success: false,
        message: 'Você não pode deletar sua própria conta'
      });
      return;
    }

    // Check permissions
    if (!canManageRole(req.user?.role || '', existingUser.role)) {
      res.status(403).json({
        success: false,
        message: 'Você não tem permissão para deletar este usuário'
      });
      return;
    }

    if (req.user?.role === 'ADMIN' && existingUser.tenantId !== req.user?.tenantId) {
      res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
      return;
    }

    // Delete user
    await prisma.user.delete({
      where: { id }
    });

    // Log audit - temporarily commented for build
    // await auditService.logUserAction(
    //   AuditAction.USER_DELETE,
    //   req.user?.id || '',
    //   req.user?.tenantId || 'system',
    //   {
    //     deletedUserId: id,
    //     deletedUserEmail: existingUser.email,
    //     deletedUserRole: existingUser.role
    //   },
    //   req
    // );

    res.json({
      success: true,
      message: 'Usuário deletado com sucesso'
    });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Get available tenants for user assignment (SUPERADMIN only)
export const getAvailableTenants = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'SUPERADMIN') {
      res.status(403).json({
        success: false,
        message: 'Acesso negado'
      });
      return;
    }

    const tenants = await prisma.tenant.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        slug: true,
        active: true,
        _count: {
          select: {
            users: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      data: {
        tenants
      }
    });
  } catch (error) {
    console.error('Erro ao buscar tenants:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};

// Get user statistics for dashboard
export const getUserStats = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    let where: any = {};

    // Apply tenant filtering based on role
    if (req.user?.role === 'ADMIN') {
      where.tenantId = req.user?.tenantId;
    }

    const [
      totalUsers,
      activeUsers,
      roleStats,
      recentUsers
    ] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.count({ where: { ...where, ativo: true } }),
      prisma.user.groupBy({
        by: ['role'],
        where,
        _count: { role: true }
      }),
      prisma.user.findMany({
        where,
        take: 5,
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          nome: true,
          email: true,
          role: true,
          criadoEm: true,
          tenant: {
            select: {
              name: true,
              slug: true
            }
          }
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        roleStats,
        recentUsers,
        userRole: req.user?.role
      }
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas de usuários:', error);
    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor'
    });
  }
};