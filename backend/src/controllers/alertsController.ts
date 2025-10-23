import { Request, Response } from 'express';
import { PrismaClient, AlertType, AlertSeverity, NotificationMethod } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId?: string;
    role: string;
  };
}

// GET /api/alerts - List alerts with filtering
export const getAlerts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      type,
      severity,
      resolved,
      tenantId
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    // Build where clause based on user role and filters
    let where: any = {};

    // Role-based access control
    if (req.user?.role === 'SUPERADMIN') {
      // SuperAdmin can see all alerts
      if (tenantId && tenantId !== 'all') {
        where.tenantId = tenantId as string;
      }
    } else if (req.user?.role === 'TENANT_ADMIN' || req.user?.role === 'ADMIN') {
      // Tenant admin can only see their tenant's alerts
      where.tenantId = req.user.tenantId;
    } else {
      // Regular users can only see their own alerts
      where.userId = req.user?.id;
    }

    // Apply filters
    if (type && type !== 'all') {
      where.type = type as AlertType;
    }
    if (severity && severity !== 'all') {
      where.severity = severity as AlertSeverity;
    }
    if (resolved !== undefined && resolved !== 'all') {
      where.resolved = resolved === 'true';
    }

    const [alerts, total] = await Promise.all([
      prisma.alert.findMany({
        where,
        include: {
          tenant: {
            select: { id: true, name: true, slug: true }
          },
          user: {
            select: { id: true, nome: true, email: true }
          },
          _count: {
            select: { notifications: true }
          }
        },
        orderBy: [
          { resolved: 'asc' },
          { severity: 'desc' },
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: limitNum
      }),
      prisma.alert.count({ where })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      alerts,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalItems: total,
        itemsPerPage: limitNum,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      }
    });
  } catch (error) {
    console.error('Erro ao buscar alertas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/alerts - Create new alert
export const createAlert = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      type,
      severity,
      title,
      message,
      tenantId,
      userId,
      metadata
    } = req.body;

    // Validation
    if (!type || !severity || !title || !message) {
      return res.status(400).json({
        error: 'Campos obrigatórios: type, severity, title, message'
      });
    }

    // Role-based access control for creating alerts
    if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const alert = await prisma.alert.create({
      data: {
        type: type as AlertType,
        severity: severity as AlertSeverity,
        title,
        message,
        tenantId,
        userId,
        metadata: metadata || null
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        user: {
          select: { id: true, nome: true, email: true }
        }
      }
    });

    // Create notifications for relevant users
    await createNotificationsForAlert(alert.id, alert.tenantId || undefined);

    res.status(201).json(alert);
  } catch (error) {
    console.error('Erro ao criar alerta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// PUT /api/alerts/:id/resolve - Resolve alert
export const resolveAlert = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { resolvedBy } = req.body;

    // Check if user can resolve this alert
    const alert = await prisma.alert.findUnique({
      where: { id },
      include: { tenant: true }
    });

    if (!alert) {
      return res.status(404).json({ error: 'Alerta não encontrado' });
    }

    // Role-based access control
    if (req.user?.role !== 'SUPERADMIN' &&
        req.user?.role !== 'ADMIN' &&
        alert.tenantId !== req.user?.tenantId) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    const updatedAlert = await prisma.alert.update({
      where: { id },
      data: {
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy: resolvedBy || req.user?.id
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true }
        },
        user: {
          select: { id: true, nome: true, email: true }
        }
      }
    });

    res.json(updatedAlert);
  } catch (error) {
    console.error('Erro ao resolver alerta:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/alerts/summary - Alert summary for dashboard
export const getAlertsSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    let where: any = {};

    // Role-based access control
    if (req.user?.role === 'SUPERADMIN') {
      // SuperAdmin can see all alerts
    } else if (req.user?.role === 'TENANT_ADMIN' || req.user?.role === 'ADMIN') {
      // Tenant admin can only see their tenant's alerts
      where.tenantId = req.user.tenantId;
    } else {
      // Regular users can only see their own alerts
      where.userId = req.user?.id;
    }

    const [
      totalAlerts,
      unresolvedAlerts,
      criticalAlerts,
      alertsBySeverity,
      alertsByType,
      recentAlerts
    ] = await Promise.all([
      prisma.alert.count({ where }),
      prisma.alert.count({ where: { ...where, resolved: false } }),
      prisma.alert.count({
        where: { ...where, resolved: false, severity: 'CRITICAL' }
      }),
      prisma.alert.groupBy({
        by: ['severity'],
        where: { ...where, resolved: false },
        _count: true
      }),
      prisma.alert.groupBy({
        by: ['type'],
        where: { ...where, resolved: false },
        _count: true
      }),
      prisma.alert.findMany({
        where,
        include: {
          tenant: {
            select: { id: true, name: true, slug: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const severityData = {
      LOW: 0,
      MEDIUM: 0,
      HIGH: 0,
      CRITICAL: 0
    };

    alertsBySeverity.forEach(item => {
      severityData[item.severity] = item._count;
    });

    const typeData: Record<string, number> = {};
    alertsByType.forEach(item => {
      typeData[item.type] = item._count;
    });

    res.json({
      summary: {
        total: totalAlerts,
        unresolved: unresolvedAlerts,
        critical: criticalAlerts
      },
      bySeverity: severityData,
      byType: typeData,
      recent: recentAlerts
    });
  } catch (error) {
    console.error('Erro ao buscar resumo de alertas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// Helper function to create notifications for an alert
async function createNotificationsForAlert(alertId: string, tenantId?: string) {
  try {
    // Get users to notify based on alert context
    let usersToNotify: any[] = [];

    if (tenantId) {
      // Notify tenant admins and superadmins
      usersToNotify = await prisma.user.findMany({
        where: {
          AND: [
            { ativo: true },
            {
              OR: [
                { role: 'SUPERADMIN' },
                { AND: [{ tenantId }, { role: { in: ['ADMIN', 'TENANT_ADMIN'] } }] }
              ]
            }
          ]
        },
        select: { id: true }
      });
    } else {
      // System-wide alert - notify only superadmins
      usersToNotify = await prisma.user.findMany({
        where: {
          role: 'SUPERADMIN',
          ativo: true
        },
        select: { id: true }
      });
    }

    // Create notifications
    const notifications = usersToNotify.map(user => ({
      alertId,
      userId: user.id,
      method: 'IN_APP' as NotificationMethod
    }));

    if (notifications.length > 0) {
      await prisma.notification.createMany({
        data: notifications
      });
    }
  } catch (error) {
    console.error('Erro ao criar notificações:', error);
  }
}

// Utility function to create system alerts programmatically
export async function createSystemAlert(
  type: AlertType,
  severity: AlertSeverity,
  title: string,
  message: string,
  metadata?: any,
  tenantId?: string,
  userId?: string
) {
  try {
    const alert = await prisma.alert.create({
      data: {
        type,
        severity,
        title,
        message,
        metadata,
        tenantId,
        userId
      }
    });

    // Create notifications
    await createNotificationsForAlert(alert.id, tenantId);

    return alert;
  } catch (error) {
    console.error('Erro ao criar alerta do sistema:', error);
    throw error;
  }
}