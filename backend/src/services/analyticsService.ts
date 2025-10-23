import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface TenantAnalytics {
  tenantId: string;
  tenantName: string;
  period: string;
  metrics: {
    totalContacts: number;
    totalCampaigns: number;
    totalMessages: number;
    activeUsers: number;
    campaignsThisMonth: number;
    messagesThisMonth: number;
    contactsThisMonth: number;
    campaignSuccessRate: number;
    averageMessagesPerCampaign: number;
    topPerformingCampaigns: Array<{
      id: string;
      name: string;
      messagesSent: number;
      successRate: number;
    }>;
  };
}

interface SystemAnalytics {
  totalTenants: number;
  totalSystemContacts: number;
  totalSystemCampaigns: number;
  totalSystemMessages: number;
  systemGrowthRate: number;
  tenantUsageDistribution: Array<{
    tenantId: string;
    tenantName: string;
    contactsCount: number;
    campaignsCount: number;
    messagesCount: number;
    usagePercentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    tenants: number;
    contacts: number;
    campaigns: number;
    messages: number;
  }>;
}

export class AnalyticsService {
  private static instance: AnalyticsService;

  private constructor() {}

  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  // Gera relatórios completos para um tenant específico
  public async generateTenantAnalytics(tenantId: string, startDate?: Date, endDate?: Date): Promise<TenantAnalytics> {
    try {
      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true }
      });

      if (!tenant) {
        throw new Error(`Tenant não encontrado: ${tenantId}`);
      }

      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const start = startDate || new Date(now.getFullYear(), now.getMonth() - 11, 1); // Últimos 12 meses
      const end = endDate || now;

      // Busca dados básicos do tenant
      const [
        totalContacts,
        totalCampaigns,
        activeUsers,
        contactsThisMonth,
        campaignsThisMonth,
        campaigns
      ] = await Promise.all([
        // Total de contatos
        prisma.contact.count({ where: { tenantId } }),

        // Total de campanhas
        prisma.campaign.count({ where: { tenantId } }),

        // Usuários ativos
        prisma.user.count({
          where: {
            tenantId,
            ultimoLogin: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Últimos 30 dias
          }
        }),

        // Contatos criados este mês
        prisma.contact.count({
          where: {
            tenantId,
            criadoEm: { gte: thisMonth }
          }
        }),

        // Campanhas criadas este mês
        prisma.campaign.count({
          where: {
            tenantId,
            criadoEm: { gte: thisMonth }
          }
        }),

        // Campanhas completas para análise
        prisma.campaign.findMany({
          where: {
            tenantId,
            criadoEm: { gte: start, lte: end }
          },
          select: {
            id: true,
            nome: true,
            status: true,
            criadoEm: true,
            totalContacts: true,
            sentCount: true,
            failedCount: true
          }
        })
      ]);

      // Calcula métricas derivadas
      const totalMessages = campaigns.reduce((sum, campaign) => sum + (campaign.totalContacts || 0), 0);
      const messagesThisMonth = campaigns
        .filter(c => c.criadoEm >= thisMonth)
        .reduce((sum, campaign) => sum + (campaign.totalContacts || 0), 0);

      const successfulCampaigns = campaigns.filter(c => c.status === 'COMPLETED').length;
      const campaignSuccessRate = totalCampaigns > 0 ? (successfulCampaigns / totalCampaigns) * 100 : 0;
      const averageMessagesPerCampaign = totalCampaigns > 0 ? totalMessages / totalCampaigns : 0;

      // Top 5 campanhas com melhor performance
      const topPerformingCampaigns = campaigns
        .map(campaign => {
          const deliveryRate = campaign.totalContacts > 0
            ? ((campaign.sentCount || 0) / campaign.totalContacts) * 100
            : 0;

          return {
            id: campaign.id,
            name: campaign.nome,
            messagesSent: campaign.sentCount || 0,
            successRate: deliveryRate
          };
        })
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 5);

      return {
        tenantId,
        tenantName: tenant.name,
        period: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
        metrics: {
          totalContacts,
          totalCampaigns,
          totalMessages,
          activeUsers,
          campaignsThisMonth,
          messagesThisMonth,
          contactsThisMonth,
          campaignSuccessRate: Math.round(campaignSuccessRate * 100) / 100,
          averageMessagesPerCampaign: Math.round(averageMessagesPerCampaign * 100) / 100,
          topPerformingCampaigns
        }
      };

    } catch (error) {
      console.error(`❌ Erro ao gerar analytics para tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Gera relatórios consolidados do sistema (SuperAdmin)
  public async generateSystemAnalytics(startDate?: Date, endDate?: Date): Promise<SystemAnalytics> {
    try {
      const now = new Date();
      const start = startDate || new Date(now.getFullYear(), now.getMonth() - 11, 1); // Últimos 12 meses
      const end = endDate || now;

      // Busca dados de todos os tenants
      const tenants = await prisma.tenant.findMany({
        where: { active: true },
        select: { id: true, name: true, createdAt: true }
      });

      // Métricas gerais do sistema
      const [
        totalSystemContacts,
        totalSystemCampaigns,
        totalSystemMessages
      ] = await Promise.all([
        prisma.contact.count(),
        prisma.campaign.count(),
        prisma.campaign.aggregate({
          _sum: { totalContacts: true }
        }).then(result => result._sum.totalContacts || 0)
      ]);

      // Analytics por tenant para distribuição de uso
      const tenantUsagePromises = tenants.map(async (tenant) => {
        const [contactsCount, campaignsCount, campaignMessages] = await Promise.all([
          prisma.contact.count({ where: { tenantId: tenant.id } }),
          prisma.campaign.count({ where: { tenantId: tenant.id } }),
          prisma.campaign.aggregate({
            where: { tenantId: tenant.id },
            _sum: { totalContacts: true }
          }).then(result => result._sum.totalContacts || 0)
        ]);

        return {
          tenantId: tenant.id,
          tenantName: tenant.name,
          contactsCount,
          campaignsCount,
          messagesCount: campaignMessages,
          usagePercentage: totalSystemMessages > 0 ? (campaignMessages / totalSystemMessages) * 100 : 0
        };
      });

      const tenantUsageDistribution = await Promise.all(tenantUsagePromises);

      // Tendências mensais (últimos 12 meses)
      const monthlyTrends = [];
      for (let i = 11; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);

        const [monthContacts, monthCampaigns, monthMessages, monthTenants] = await Promise.all([
          prisma.contact.count({
            where: { criadoEm: { gte: monthStart, lte: monthEnd } }
          }),
          prisma.campaign.count({
            where: { criadoEm: { gte: monthStart, lte: monthEnd } }
          }),
          prisma.campaign.aggregate({
            where: { criadoEm: { gte: monthStart, lte: monthEnd } },
            _sum: { totalContacts: true }
          }).then(result => result._sum.totalContacts || 0),
          prisma.tenant.count({
            where: {
              active: true,
              createdAt: { lte: monthEnd }
            }
          })
        ]);

        monthlyTrends.push({
          month: monthStart.toISOString().slice(0, 7), // YYYY-MM format
          tenants: monthTenants,
          contacts: monthContacts,
          campaigns: monthCampaigns,
          messages: monthMessages
        });
      }

      // Taxa de crescimento (comparando com mês anterior)
      const lastMonth = monthlyTrends[monthlyTrends.length - 1];
      const previousMonth = monthlyTrends[monthlyTrends.length - 2];
      const systemGrowthRate = previousMonth?.contacts > 0
        ? ((lastMonth.contacts - previousMonth.contacts) / previousMonth.contacts) * 100
        : 0;

      return {
        totalTenants: tenants.length,
        totalSystemContacts,
        totalSystemCampaigns,
        totalSystemMessages,
        systemGrowthRate: Math.round(systemGrowthRate * 100) / 100,
        tenantUsageDistribution,
        monthlyTrends
      };

    } catch (error) {
      console.error('❌ Erro ao gerar analytics do sistema:', error);
      throw error;
    }
  }

  // Gera relatório de performance de campanhas para um tenant
  public async getCampaignPerformanceReport(tenantId: string, campaignId?: string): Promise<any> {
    try {
      const where = campaignId
        ? { tenantId, id: campaignId }
        : { tenantId };

      const campaigns = await prisma.campaign.findMany({
        where,
        select: {
          id: true,
          nome: true,
          status: true,
          criadoEm: true,
          scheduledFor: true,
          totalContacts: true,
          sentCount: true,
          failedCount: true
        },
        orderBy: { criadoEm: 'desc' }
      });

      return campaigns.map(campaign => {
        const deliveryRate = campaign.totalContacts > 0
          ? ((campaign.sentCount || 0) / campaign.totalContacts) * 100
          : 0;

        const failureRate = campaign.totalContacts > 0
          ? ((campaign.failedCount || 0) / campaign.totalContacts) * 100
          : 0;

        return {
          id: campaign.id,
          name: campaign.nome,
          status: campaign.status,
          createdAt: campaign.criadoEm,
          scheduledFor: campaign.scheduledFor,
          totalMessages: campaign.totalContacts,
          sentMessages: campaign.sentCount,
          failedMessages: campaign.failedCount,
          deliveryRate: Math.round(deliveryRate * 100) / 100,
          failureRate: Math.round(failureRate * 100) / 100
        };
      });

    } catch (error) {
      console.error(`❌ Erro ao gerar relatório de performance para tenant ${tenantId}:`, error);
      throw error;
    }
  }

  // Exporta dados em formato CSV
  public async exportTenantDataToCSV(tenantId: string, dataType: 'contacts' | 'campaigns' | 'analytics'): Promise<string> {
    try {
      switch (dataType) {
        case 'contacts':
          const contacts = await prisma.contact.findMany({
            where: { tenantId },
            select: {
              id: true,
              nome: true,
              telefone: true,
              email: true,
              tags: true,
              criadoEm: true
            }
          });

          const contactsCsv = [
            'ID,Nome,Telefone,Email,Tags,Data Criação',
            ...contacts.map(c =>
              `${c.id},"${c.nome}","${c.telefone}","${c.email || ''}","${c.tags?.join(';') || ''}","${c.criadoEm.toISOString()}"`
            )
          ].join('\n');

          return contactsCsv;

        case 'campaigns':
          const campaigns = await prisma.campaign.findMany({
            where: { tenantId },
            select: {
              id: true,
              nome: true,
              status: true,
              criadoEm: true,
              scheduledFor: true,
              totalContacts: true,
              sentCount: true,
              failedCount: true
            }
          });

          const campaignsCsv = [
            'ID,Nome,Status,Data Criação,Data Agendamento,Total Mensagens,Enviadas,Falharam',
            ...campaigns.map(c =>
              `${c.id},"${c.nome}","${c.status}","${c.criadoEm.toISOString()}","${c.scheduledFor?.toISOString() || ''}",${c.totalContacts || 0},${c.sentCount || 0},${c.failedCount || 0}`
            )
          ].join('\n');

          return campaignsCsv;

        case 'analytics':
          const analytics = await this.generateTenantAnalytics(tenantId);
          const analyticsCsv = [
            'Métrica,Valor',
            `Total Contatos,${analytics.metrics.totalContacts}`,
            `Total Campanhas,${analytics.metrics.totalCampaigns}`,
            `Total Mensagens,${analytics.metrics.totalMessages}`,
            `Usuários Ativos,${analytics.metrics.activeUsers}`,
            `Campanhas Este Mês,${analytics.metrics.campaignsThisMonth}`,
            `Mensagens Este Mês,${analytics.metrics.messagesThisMonth}`,
            `Contatos Este Mês,${analytics.metrics.contactsThisMonth}`,
            `Taxa Sucesso Campanhas,${analytics.metrics.campaignSuccessRate}%`,
            `Média Mensagens/Campanha,${analytics.metrics.averageMessagesPerCampaign}`
          ].join('\n');

          return analyticsCsv;

        default:
          throw new Error('Tipo de dados não suportado');
      }

    } catch (error) {
      console.error(`❌ Erro ao exportar dados ${dataType} para tenant ${tenantId}:`, error);
      throw error;
    }
  }
}

// Instância singleton
export const analyticsService = AnalyticsService.getInstance();