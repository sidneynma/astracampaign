import { PrismaClient, AlertType, AlertSeverity } from '@prisma/client';
import { createSystemAlert } from '../controllers/alertsController';

const prisma = new PrismaClient();

// Check for quota violations and create alerts
export async function checkQuotaAlerts() {
  try {
    console.log('🔍 Verificando quotas dos tenants...');

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

    for (const tenant of tenants) {
      if (!tenant.quotas) continue;

      const quotas = tenant.quotas;
      const counts = tenant._count;

      // Check contacts quota
      const contactsUsage = (counts.contacts / quotas.maxContacts) * 100;
      if (contactsUsage >= 90 && !await hasRecentAlert(tenant.id, 'QUOTA_WARNING', 'contacts')) {
        await createSystemAlert(
          'QUOTA_EXCEEDED',
          contactsUsage >= 100 ? 'CRITICAL' : 'HIGH',
          `Quota de contatos ${contactsUsage >= 100 ? 'excedida' : 'próxima do limite'}`,
          `Tenant ${tenant.name}: ${counts.contacts}/${quotas.maxContacts} contatos (${Math.round(contactsUsage)}%)`,
          {
            tenantSlug: tenant.slug,
            quotaType: 'contacts',
            currentValue: counts.contacts,
            maxValue: quotas.maxContacts,
            usagePercentage: Math.round(contactsUsage)
          },
          tenant.id
        );
      }

      // Check campaigns quota
      const campaignsUsage = (counts.campaigns / quotas.maxCampaigns) * 100;
      if (campaignsUsage >= 90 && !await hasRecentAlert(tenant.id, 'QUOTA_WARNING', 'campaigns')) {
        await createSystemAlert(
          'QUOTA_EXCEEDED',
          campaignsUsage >= 100 ? 'CRITICAL' : 'HIGH',
          `Quota de campanhas ${campaignsUsage >= 100 ? 'excedida' : 'próxima do limite'}`,
          `Tenant ${tenant.name}: ${counts.campaigns}/${quotas.maxCampaigns} campanhas (${Math.round(campaignsUsage)}%)`,
          {
            tenantSlug: tenant.slug,
            quotaType: 'campaigns',
            currentValue: counts.campaigns,
            maxValue: quotas.maxCampaigns,
            usagePercentage: Math.round(campaignsUsage)
          },
          tenant.id
        );
      }

      // Check users quota
      const usersUsage = (counts.users / quotas.maxUsers) * 100;
      if (usersUsage >= 90 && !await hasRecentAlert(tenant.id, 'QUOTA_WARNING', 'users')) {
        await createSystemAlert(
          'QUOTA_EXCEEDED',
          usersUsage >= 100 ? 'CRITICAL' : 'HIGH',
          `Quota de usuários ${usersUsage >= 100 ? 'excedida' : 'próxima do limite'}`,
          `Tenant ${tenant.name}: ${counts.users}/${quotas.maxUsers} usuários (${Math.round(usersUsage)}%)`,
          {
            tenantSlug: tenant.slug,
            quotaType: 'users',
            currentValue: counts.users,
            maxValue: quotas.maxUsers,
            usagePercentage: Math.round(usersUsage)
          },
          tenant.id
        );
      }

      // Check sessions quota
      const sessionsUsage = (counts.whatsappSessions / quotas.maxConnections) * 100;
      if (sessionsUsage >= 90 && !await hasRecentAlert(tenant.id, 'QUOTA_WARNING', 'sessions')) {
        await createSystemAlert(
          'QUOTA_EXCEEDED',
          sessionsUsage >= 100 ? 'CRITICAL' : 'HIGH',
          `Quota de sessões ${sessionsUsage >= 100 ? 'excedida' : 'próxima do limite'}`,
          `Tenant ${tenant.name}: ${counts.whatsappSessions}/${quotas.maxConnections} sessões (${Math.round(sessionsUsage)}%)`,
          {
            tenantSlug: tenant.slug,
            quotaType: 'sessions',
            currentValue: counts.whatsappSessions,
            maxValue: quotas.maxConnections,
            usagePercentage: Math.round(sessionsUsage)
          },
          tenant.id
        );
      }
    }

    console.log('✅ Verificação de quotas concluída');
  } catch (error) {
    console.error('❌ Erro ao verificar quotas:', error);
    await createSystemAlert(
      'SYSTEM_ERROR',
      'MEDIUM',
      'Erro na verificação de quotas',
      `Falha ao executar verificação automática de quotas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

// Check for failed campaigns and sessions
export async function checkSystemHealth() {
  try {
    console.log('🏥 Verificando saúde do sistema...');

    // Check for failed campaigns in the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const failedCampaigns = await prisma.campaign.findMany({
      where: {
        status: 'FAILED',
        atualizadoEm: { gte: oneHourAgo }
      },
      include: {
        tenant: { select: { name: true, slug: true } }
      }
    });

    for (const campaign of failedCampaigns) {
      if (!await hasRecentAlert(campaign.tenantId || undefined, 'CAMPAIGN_FAILED', campaign.id)) {
        await createSystemAlert(
          'CAMPAIGN_FAILED',
          'HIGH',
          'Campanha falhou',
          `Campanha "${campaign.nome}" falhou${campaign.tenant ? ` - Tenant: ${campaign.tenant.name}` : ''}`,
          {
            campaignId: campaign.id,
            campaignName: campaign.nome,
            tenantSlug: campaign.tenant?.slug
          },
          campaign.tenantId || undefined
        );
      }
    }

    // Check for sessions in FAILED status
    const failedSessions = await prisma.whatsAppSession.findMany({
      where: {
        status: 'FAILED',
        atualizadoEm: { gte: oneHourAgo }
      },
      include: {
        tenant: { select: { name: true, slug: true } }
      }
    });

    for (const session of failedSessions) {
      if (!await hasRecentAlert(session.tenantId || undefined, 'SESSION_FAILED', session.id)) {
        await createSystemAlert(
          'SESSION_FAILED',
          'HIGH',
          'Sessão WhatsApp falhou',
          `Sessão "${session.name}" está com falha${session.tenant ? ` - Tenant: ${session.tenant.name}` : ''}`,
          {
            sessionId: session.id,
            sessionName: session.name,
            tenantSlug: session.tenant?.slug
          },
          session.tenantId || undefined
        );
      }
    }

    // Check database connectivity
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbError) {
      await createSystemAlert(
        'DATABASE_ERROR',
        'CRITICAL',
        'Erro de conectividade com banco',
        `Falha ao conectar com o banco de dados: ${dbError instanceof Error ? dbError.message : 'Erro desconhecido'}`
      );
    }

    console.log('✅ Verificação de saúde concluída');
  } catch (error) {
    console.error('❌ Erro ao verificar saúde do sistema:', error);
    await createSystemAlert(
      'SYSTEM_ERROR',
      'HIGH',
      'Erro na verificação de saúde',
      `Falha ao executar verificação de saúde: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    );
  }
}

// Check if there's a recent alert of the same type to avoid spam
async function hasRecentAlert(
  tenantId: string | undefined,
  type: AlertType,
  resourceId?: string
): Promise<boolean> {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

  const where: any = {
    type,
    createdAt: { gte: fifteenMinutesAgo },
    resolved: false
  };

  if (tenantId) {
    where.tenantId = tenantId;
  } else {
    where.tenantId = null;
  }

  if (resourceId) {
    where.metadata = {
      path: ['$.resourceId'],
      equals: resourceId
    };
  }

  const count = await prisma.alert.count({ where });
  return count > 0;
}

// Auto-resolve old alerts of certain types
export async function autoResolveOldAlerts() {
  try {
    console.log('🔄 Auto-resolvendo alertas antigos...');

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Auto-resolve old quota warnings if the quota usage has improved
    const oldQuotaAlerts = await prisma.alert.findMany({
      where: {
        type: { in: ['QUOTA_WARNING', 'QUOTA_EXCEEDED'] },
        resolved: false,
        createdAt: { lt: oneDayAgo }
      }
    });

    for (const alert of oldQuotaAlerts) {
      // Check if quota situation has improved
      if (alert.metadata && typeof alert.metadata === 'object' && alert.metadata !== null) {
        const metadata = alert.metadata as any;
        if (metadata.tenantId && metadata.quotaType) {
          const tenant = await prisma.tenant.findUnique({
            where: { id: metadata.tenantId },
            include: {
              _count: { select: { contacts: true, campaigns: true, users: true, whatsappSessions: true } },
              quotas: true
            }
          });

          if (tenant && tenant.quotas) {
            let currentUsage = 0;
            const quotas = tenant.quotas;
            const counts = tenant._count;

            switch (metadata.quotaType) {
              case 'contacts':
                currentUsage = (counts.contacts / quotas.maxContacts) * 100;
                break;
              case 'campaigns':
                currentUsage = (counts.campaigns / quotas.maxCampaigns) * 100;
                break;
              case 'users':
                currentUsage = (counts.users / quotas.maxUsers) * 100;
                break;
              case 'sessions':
                currentUsage = (counts.whatsappSessions / quotas.maxConnections) * 100;
                break;
            }

            // Auto-resolve if usage dropped below 85%
            if (currentUsage < 85) {
              await prisma.alert.update({
                where: { id: alert.id },
                data: {
                  resolved: true,
                  resolvedAt: new Date(),
                  resolvedBy: 'system_auto_resolve'
                }
              });
              console.log(`✅ Auto-resolvido: ${alert.title} - Uso atual: ${Math.round(currentUsage)}%`);
            }
          }
        }
      }
    }

    console.log('✅ Auto-resolução concluída');
  } catch (error) {
    console.error('❌ Erro na auto-resolução:', error);
  }
}

// Initialize monitoring service with intervals
export function initializeAlertsMonitoring() {
  console.log('🚀 Iniciando serviço de monitoramento de alertas...');

  // Check quotas every 15 minutes
  setInterval(checkQuotaAlerts, 15 * 60 * 1000);

  // Check system health every 5 minutes
  setInterval(checkSystemHealth, 5 * 60 * 1000);

  // Auto-resolve old alerts every hour
  setInterval(autoResolveOldAlerts, 60 * 60 * 1000);

  // Run initial checks after 30 seconds
  setTimeout(() => {
    checkQuotaAlerts();
    checkSystemHealth();
    autoResolveOldAlerts();
  }, 30 * 1000);

  console.log('✅ Serviço de monitoramento iniciado');
}