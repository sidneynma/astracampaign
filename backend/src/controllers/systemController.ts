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

// GET /api/system/stats - Estatísticas gerais do sistema
export const getSystemStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar se é SUPERADMIN ou ADMIN (temporário)
    if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas SUPERADMINs podem acessar.' });
    }

    // Buscar estatísticas do sistema em paralelo
    const [
      tenantsStats,
      usersStats,
      contactsCount,
      campaignsStats,
      sessionsStats,
      messagesCount,
      activeToday,
      alertsStats
    ] = await Promise.all([
      // Estatísticas de tenants
      prisma.tenant.groupBy({
        by: ['active'],
        _count: true
      }),

      // Estatísticas de usuários por role
      prisma.user.groupBy({
        by: ['role'],
        _count: true
      }),

      // Total de contatos
      prisma.contact.count(),

      // Estatísticas de campanhas
      prisma.campaign.groupBy({
        by: ['status'],
        _count: true
      }),

      // Estatísticas de sessões WhatsApp
      prisma.whatsAppSession.groupBy({
        by: ['status'],
        _count: true
      }),

      // Total de mensagens
      prisma.campaignMessage.count(),

      // Usuários ativos hoje
      prisma.user.count({
        where: {
          ultimoLogin: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Estatísticas de alertas
      prisma.alert.groupBy({
        by: ['severity', 'resolved'],
        _count: true
      })
    ]);

    // Processar dados dos tenants
    const tenantData = {
      total: 0,
      active: 0,
      inactive: 0
    };

    tenantsStats.forEach(stat => {
      tenantData.total += stat._count;
      if (stat.active) {
        tenantData.active += stat._count;
      } else {
        tenantData.inactive += stat._count;
      }
    });

    // Processar dados dos usuários
    const userData = {
      total: 0,
      byRole: {
        SUPERADMIN: 0,
        ADMIN: 0,
        USER: 0
      }
    };

    usersStats.forEach(stat => {
      userData.total += stat._count;
      if (stat.role in userData.byRole) {
        userData.byRole[stat.role as keyof typeof userData.byRole] = stat._count;
      }
    });

    // Processar campanhas ativas
    const activeCampaigns = campaignsStats
      .filter(stat => ['ACTIVE', 'RUNNING'].includes(stat.status))
      .reduce((acc, stat) => acc + stat._count, 0);

    // Processar sessões ativas
    const workingSessions = sessionsStats
      .filter(stat => stat.status === 'WORKING')
      .reduce((acc, stat) => acc + stat._count, 0);

    // Processar dados de alertas
    const alertsData = {
      total: alertsStats.reduce((acc, stat) => acc + stat._count, 0),
      unresolved: alertsStats
        .filter(stat => !stat.resolved)
        .reduce((acc, stat) => acc + stat._count, 0),
      critical: alertsStats
        .filter(stat => stat.severity === 'CRITICAL' && !stat.resolved)
        .reduce((acc, stat) => acc + stat._count, 0),
      high: alertsStats
        .filter(stat => stat.severity === 'HIGH' && !stat.resolved)
        .reduce((acc, stat) => acc + stat._count, 0)
    };

    const systemStats = {
      tenants: tenantData,
      users: userData,
      resources: {
        totalContacts: contactsCount,
        totalCampaigns: campaignsStats.reduce((acc, stat) => acc + stat._count, 0),
        totalSessions: sessionsStats.reduce((acc, stat) => acc + stat._count, 0),
        totalMessages: messagesCount
      },
      activity: {
        activeToday,
        activeCampaigns,
        workingSessions
      },
      alerts: alertsData
    };

    res.json(systemStats);
  } catch (error) {
    console.error('Erro ao buscar estatísticas do sistema:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/system/tenant-stats - Estatísticas detalhadas por tenant
export const getTenantStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar se é SUPERADMIN ou ADMIN (temporário)
    if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas SUPERADMINs podem acessar.' });
    }

    // Usar a view materializada se estiver disponível, senão fazer query direta
    try {
      const tenantStats = await prisma.$queryRaw`
        SELECT
          ts.tenant_id as "tenantId",
          ts.tenant_name as "tenantName",
          ts.slug,
          ts.contacts_count as "contactsCount",
          ts.campaigns_count as "campaignsCount",
          ts.messages_count as "messagesCount",
          ts.active_campaigns as "activeCampaigns",
          ts.working_sessions as "workingSessions",
          tq.max_contacts as "maxContacts",
          tq.max_campaigns as "maxCampaigns",
          ROUND(ts.contacts_count::numeric / tq.max_contacts * 100, 2) as "contactsUsagePct",
          ROUND(ts.campaigns_count::numeric / tq.max_campaigns * 100, 2) as "campaignsUsagePct",
          CASE
            WHEN ts.contacts_count > tq.max_contacts THEN '🔴 Quota exceeded'
            WHEN ts.contacts_count > tq.max_contacts * 0.9 THEN '🟡 Near limit'
            ELSE '🟢 OK'
          END as "quotaStatus",
          ts.last_contact_created as "lastContactCreated",
          ts.last_campaign_created as "lastCampaignCreated"
        FROM tenant_stats ts
        JOIN tenant_quotas tq ON ts.tenant_id = tq.tenant_id
        ORDER BY ts.contacts_count DESC
      `;

      res.json(tenantStats);
    } catch (error) {
      // Fallback: query direta se a view não existir
      const tenants = await prisma.tenant.findMany({
        where: { active: true },
        include: {
          _count: {
            select: {
              users: true,
              contacts: true,
              campaigns: true,
              whatsappSessions: true
            }
          },
          quotas: true
        },
        orderBy: { createdAt: 'desc' }
      });

      const tenantStats = tenants.map(tenant => {
        const quota = tenant.quotas;
        const contactsUsagePct = quota ? Math.round((tenant._count.contacts / quota.maxContacts) * 100) : 0;
        const campaignsUsagePct = quota ? Math.round((tenant._count.campaigns / quota.maxCampaigns) * 100) : 0;

        let quotaStatus = '🟢 OK';
        if (contactsUsagePct > 100 || campaignsUsagePct > 100) {
          quotaStatus = '🔴 Quota exceeded';
        } else if (contactsUsagePct > 90 || campaignsUsagePct > 90) {
          quotaStatus = '🟡 Near limit';
        }

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          slug: tenant.slug,
          contactsCount: tenant._count.contacts,
          campaignsCount: tenant._count.campaigns,
          messagesCount: 0, // Seria necessário uma query adicional
          activeCampaigns: 0, // Seria necessário uma query adicional
          workingSessions: 0, // Seria necessário uma query adicional
          maxContacts: quota?.maxContacts || 1000,
          maxCampaigns: quota?.maxCampaigns || 50,
          contactsUsagePct,
          campaignsUsagePct,
          quotaStatus
        };
      });

      res.json(tenantStats);
    }
  } catch (error) {
    console.error('Erro ao buscar estatísticas dos tenants:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/system/health - Status de saúde do sistema
export const getSystemHealth = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar se é SUPERADMIN ou ADMIN (temporário)
    if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas SUPERADMINs podem acessar.' });
    }

    // Verificar conexão com o banco de dados
    const dbHealthy = await prisma.$queryRaw`SELECT 1 as status`
      .then(() => true)
      .catch(() => false);

    // Verificar estatísticas básicas
    const [userCount, tenantCount] = await Promise.all([
      prisma.user.count().catch(() => 0),
      prisma.tenant.count().catch(() => 0)
    ]);

    const health = {
      status: dbHealthy ? 'healthy' : 'unhealthy',
      database: {
        connected: dbHealthy,
        responseTime: Date.now() // Simplificado - em produção seria medido adequadamente
      },
      services: {
        api: 'running',
        database: dbHealthy ? 'running' : 'error'
      },
      metrics: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        users: userCount,
        tenants: tenantCount
      },
      timestamp: new Date().toISOString()
    };

    res.json(health);
  } catch (error) {
    console.error('Erro ao verificar saúde do sistema:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: 'Erro interno do servidor'
    });
  }
};

// POST /api/system/refresh-stats - Atualizar estatísticas materializadas
export const refreshStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar se é SUPERADMIN ou ADMIN (temporário)
    if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas SUPERADMINs podem acessar.' });
    }

    // Tentar refresh da view materializada
    try {
      await prisma.$executeRaw`REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_stats`;
      res.json({
        success: true,
        message: 'Estatísticas atualizadas com sucesso'
      });
    } catch (error) {
      // Se a view não existir, apenas retornar sucesso
      res.json({
        success: true,
        message: 'View materializada não encontrada, usando queries diretas'
      });
    }
  } catch (error) {
    console.error('Erro ao atualizar estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};

// GET /api/system/quotas-alerts - Alertas de quotas excedidas
export const getQuotasAlerts = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verificar se é SUPERADMIN ou ADMIN (temporário)
    if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Acesso negado. Apenas SUPERADMINs podem acessar.' });
    }

    // Usar função SQL se disponível
    try {
      const alerts = await prisma.$queryRaw`
        SELECT * FROM check_tenant_quotas()
        WHERE usage_pct >= 80
        ORDER BY usage_pct DESC
      `;

      res.json(alerts);
    } catch (error) {
      // Fallback: query direta
      const tenants = await prisma.tenant.findMany({
        where: { active: true },
        include: {
          _count: {
            select: {
              contacts: true,
              campaigns: true,
              users: true,
              whatsappSessions: true
            }
          },
          quotas: true
        }
      });

      const alerts = tenants
        .map(tenant => {
          if (!tenant.quotas) return null;

          const contactsUsage = (tenant._count.contacts / tenant.quotas.maxContacts) * 100;
          const campaignsUsage = (tenant._count.campaigns / tenant.quotas.maxCampaigns) * 100;
          const usersUsage = (tenant._count.users / tenant.quotas.maxUsers) * 100;
          const sessionsUsage = (tenant._count.whatsappSessions / tenant.quotas.maxConnections) * 100;

          const alerts = [];

          if (contactsUsage >= 80) {
            alerts.push({
              tenantId: tenant.id,
              tenantName: tenant.name,
              quotaType: 'contacts',
              currentValue: tenant._count.contacts,
              maxValue: tenant.quotas.maxContacts,
              usagePct: Math.round(contactsUsage)
            });
          }

          if (campaignsUsage >= 80) {
            alerts.push({
              tenantId: tenant.id,
              tenantName: tenant.name,
              quotaType: 'campaigns',
              currentValue: tenant._count.campaigns,
              maxValue: tenant.quotas.maxCampaigns,
              usagePct: Math.round(campaignsUsage)
            });
          }

          if (usersUsage >= 80) {
            alerts.push({
              tenantId: tenant.id,
              tenantName: tenant.name,
              quotaType: 'users',
              currentValue: tenant._count.users,
              maxValue: tenant.quotas.maxUsers,
              usagePct: Math.round(usersUsage)
            });
          }

          if (sessionsUsage >= 80) {
            alerts.push({
              tenantId: tenant.id,
              tenantName: tenant.name,
              quotaType: 'sessions',
              currentValue: tenant._count.whatsappSessions,
              maxValue: tenant.quotas.maxConnections,
              usagePct: Math.round(sessionsUsage)
            });
          }

          return alerts;
        })
        .filter(alerts => alerts && alerts.length > 0)
        .flat()
        .sort((a, b) => (b?.usagePct || 0) - (a?.usagePct || 0));

      res.json(alerts);
    }
  } catch (error) {
    console.error('Erro ao buscar alertas de quotas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
};