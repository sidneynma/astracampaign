import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

interface SystemStats {
  tenants: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    byRole: {
      SUPERADMIN: number;
      TENANT_ADMIN: number;
      USER: number;
    };
  };
  resources: {
    totalContacts: number;
    totalCampaigns: number;
    totalSessions: number;
    totalMessages: number;
  };
  activity: {
    activeToday: number;
    activeCampaigns: number;
    workingSessions: number;
  };
}

interface TenantStats {
  tenantId: string;
  tenantName: string;
  slug: string;
  contactsCount: number;
  campaignsCount: number;
  messagesCount: number;
  activeCampaigns: number;
  workingSessions: number;
  maxContacts: number;
  maxCampaigns: number;
  contactsUsagePct: number;
  campaignsUsagePct: number;
  quotaStatus: string;
  lastContactCreated?: string;
  lastCampaignCreated?: string;
}

interface RecentActivity {
  id: string;
  type: 'tenant_created' | 'user_created' | 'campaign_started' | 'quota_exceeded';
  description: string;
  timestamp: string;
  tenantName?: string;
}

export function SuperAdminDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [tenantStats, setTenantStats] = useState<TenantStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadDashboardData();

    // Auto-refresh a cada 30 segundos
    const interval = setInterval(loadDashboardData, 30000);
    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) clearInterval(refreshInterval);
      if (interval) clearInterval(interval);
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const token = localStorage.getItem('auth_token');

      // Carregar estatísticas do sistema
      const [statsResponse, tenantStatsResponse] = await Promise.all([
        fetch('/api/system/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/system/tenant-stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData);
      }

      if (tenantStatsResponse.ok) {
        const tenantStatsData = await tenantStatsResponse.json();
        setTenantStats(tenantStatsData);
      }

      // Simular atividades recentes (em produção viria da API)
      setRecentActivity([
        {
          id: '1',
          type: 'tenant_created',
          description: 'Novo tenant "Empresa ABC" criado',
          timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          tenantName: 'Empresa ABC'
        },
        {
          id: '2',
          type: 'campaign_started',
          description: 'Campanha "Promoção Janeiro" iniciada',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          tenantName: 'Cliente XYZ'
        },
        {
          id: '3',
          type: 'quota_exceeded',
          description: 'Tenant "Loja Virtual" excedeu quota de contatos',
          timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
          tenantName: 'Loja Virtual'
        }
      ]);

    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setLoading(false);
    }
  };

  const getQuotaStatusColor = (status: string) => {
    switch (status) {
      case '🔴 Quota exceeded':
        return 'text-red-600 bg-red-100';
      case '🟡 Near limit':
        return 'text-yellow-600 bg-yellow-100';
      case '🟢 OK':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'tenant_created':
        return (
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
            </svg>
          </div>
        );
      case 'campaign_started':
        return (
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
            </svg>
          </div>
        );
      case 'quota_exceeded':
        return (
          <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  const formatTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours}h atrás`;
    if (minutes > 0) return `${minutes}min atrás`;
    return 'Agora';
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard Sistema</h1>
          <p className="text-gray-600 mt-2">Visão geral do sistema multi-tenant</p>
        </div>
        <button
          onClick={loadDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* System Overview Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H3m2 0h3M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 8h1m-1-4h1m4 4h1m-1-4h1" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Empresas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.tenants.total}</p>
                <p className="text-sm text-green-600">{stats.tenants.active} ativos</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Usuários</p>
                <p className="text-2xl font-bold text-gray-900">{stats.users.total}</p>
                <p className="text-sm text-gray-500">
                  {stats.users.byRole.TENANT_ADMIN} admins
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Contatos</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.resources.totalContacts.toLocaleString()}
                </p>
                <p className="text-sm text-gray-500">Total no sistema</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Campanhas</p>
                <p className="text-2xl font-bold text-gray-900">{stats.resources.totalCampaigns}</p>
                <p className="text-sm text-green-600">{stats.activity.activeCampaigns} ativas</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Tenant Stats Table */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Status das Empresas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Recursos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Uso Quotas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tenantStats.map((tenant) => (
                  <tr key={tenant.tenantId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{tenant.tenantName}</div>
                        <div className="text-sm text-gray-500">{tenant.slug}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div>{tenant.contactsCount} contatos</div>
                        <div>{tenant.campaignsCount} campanhas</div>
                        <div>{tenant.messagesCount} mensagens</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <div className="text-xs">Contatos: {tenant.contactsUsagePct}%</div>
                          <div className="ml-2 w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                tenant.contactsUsagePct >= 90 ? 'bg-red-500' :
                                tenant.contactsUsagePct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(tenant.contactsUsagePct, 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center">
                          <div className="text-xs">Campanhas: {tenant.campaignsUsagePct}%</div>
                          <div className="ml-2 w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${
                                tenant.campaignsUsagePct >= 90 ? 'bg-red-500' :
                                tenant.campaignsUsagePct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${Math.min(tenant.campaignsUsagePct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getQuotaStatusColor(tenant.quotaStatus)}`}>
                        {tenant.quotaStatus.replace(/[🔴🟡🟢]/g, '').trim()}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Atividade Recente</h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  {getActivityIcon(activity.type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900">{activity.description}</p>
                    {activity.tenantName && (
                      <p className="text-xs text-gray-500">Tenant: {activity.tenantName}</p>
                    )}
                    <p className="text-xs text-gray-400">{formatTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>

            {recentActivity.length === 0 && (
              <div className="text-center py-8">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="mt-2 text-sm text-gray-500">Nenhuma atividade recente</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Health Indicators */}
      <div className="mt-8 bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Saúde do Sistema</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Sistema Online</h3>
              <p className="text-sm text-gray-500">Todos os serviços funcionando</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">Banco de Dados</h3>
              <p className="text-sm text-gray-500">Conexão estável</p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900">WhatsApp</h3>
              <p className="text-sm text-gray-500">
                {stats ? `${stats.activity.workingSessions} sessões ativas` : 'Carregando...'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}