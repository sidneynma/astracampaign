import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    tenantId?: string;
    role: string;
  };
}

// GET /api/notifications - Get user notifications
export const getNotifications = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      read,
      method
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    let where: any = {
      userId: req.user?.id
    };

    // Apply filters
    if (read !== undefined && read !== 'all') {
      where.read = read === 'true';
    }
    if (method && method !== 'all') {
      where.method = method;
    }

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          alert: {
            include: {
              tenant: {
                select: { id: true, name: true, slug: true }
              }
            }
          }
        },
        orderBy: [
          { read: 'asc' },
          { createdAt: 'desc' }
        ],
        skip: offset,
        take: limitNum
      }),
      prisma.notification.count({ where })
    ]);

    const totalPages = Math.ceil(total / limitNum);

    res.json({
      notifications,
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
    console.error('Erro ao buscar notificações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/notifications/unread-count - Get unread notifications count
export const getUnreadCount = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const unreadCount = await prisma.notification.count({
      where: {
        userId: req.user?.id,
        read: false
      }
    });

    res.json({ unreadCount });
  } catch (error) {
    console.error('Erro ao buscar contagem de não lidas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/notifications/:id/mark-read - Mark notification as read
export const markAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true, read: true }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    if (notification.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    if (notification.read) {
      return res.json({ message: 'Notificação já foi marcada como lida' });
    }

    const updatedNotification = await prisma.notification.update({
      where: { id },
      data: {
        read: true,
        readAt: new Date()
      },
      include: {
        alert: {
          include: {
            tenant: {
              select: { id: true, name: true, slug: true }
            }
          }
        }
      }
    });

    res.json(updatedNotification);
  } catch (error) {
    console.error('Erro ao marcar notificação como lida:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// POST /api/notifications/mark-all-read - Mark all notifications as read
export const markAllAsRead = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId: req.user?.id,
        read: false
      },
      data: {
        read: true,
        readAt: new Date()
      }
    });

    res.json({ message: `${result.count} notificações marcadas como lidas` });
  } catch (error) {
    console.error('Erro ao marcar todas as notificações como lidas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// DELETE /api/notifications/:id - Delete notification
export const deleteNotification = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id },
      select: { userId: true }
    });

    if (!notification) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }

    if (notification.userId !== req.user?.id) {
      return res.status(403).json({ error: 'Acesso negado' });
    }

    await prisma.notification.delete({
      where: { id }
    });

    res.json({ message: 'Notificação excluída com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir notificação:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/notifications/summary - Notifications summary
export const getNotificationsSummary = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const [
      totalNotifications,
      unreadNotifications,
      recentNotifications
    ] = await Promise.all([
      prisma.notification.count({
        where: { userId: req.user?.id }
      }),
      prisma.notification.count({
        where: {
          userId: req.user?.id,
          read: false
        }
      }),
      prisma.notification.findMany({
        where: { userId: req.user?.id },
        include: {
          alert: {
            select: {
              type: true,
              severity: true,
              title: true,
              message: true,
              tenant: {
                select: { name: true }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      summary: {
        total: totalNotifications,
        unread: unreadNotifications,
        read: totalNotifications - unreadNotifications
      },
      recent: recentNotifications
    });
  } catch (error) {
    console.error('Erro ao buscar resumo de notificações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};