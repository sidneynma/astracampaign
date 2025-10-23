"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantController = void 0;
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
class TenantController {
    // Listar todos os tenants (SUPERADMIN only)
    static async listTenants(req, res) {
        try {
            console.log('📋 TenantController.listTenants - user:', req.user?.email, 'role:', req.user?.role);
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado. Apenas SUPERADMIN pode listar tenants.'
                });
            }
            const tenants = await prisma.tenant.findMany({
                include: {
                    users: {
                        select: {
                            id: true,
                            nome: true,
                            email: true,
                            role: true,
                            ativo: true,
                            criadoEm: true
                        }
                    },
                    contacts: {
                        select: {
                            id: true
                        }
                    },
                    campaigns: {
                        select: {
                            id: true
                        }
                    },
                    whatsappSessions: {
                        select: {
                            id: true,
                            name: true,
                            status: true,
                            provider: true
                        }
                    },
                    _count: {
                        select: {
                            users: true,
                            contacts: true,
                            campaigns: true,
                            whatsappSessions: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            });
            console.log('✅ TenantController.listTenants - tenants encontrados:', tenants.length);
            res.json({
                success: true,
                tenants: tenants.map(tenant => ({
                    ...tenant,
                    usersCount: tenant._count.users,
                    contactsCount: tenant._count.contacts,
                    campaignsCount: tenant._count.campaigns,
                    sessionsCount: tenant._count.whatsappSessions
                }))
            });
        }
        catch (error) {
            console.error('❌ TenantController.listTenants - erro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    // Criar novo tenant (SUPERADMIN only)
    static async createTenant(req, res) {
        try {
            console.log('➕ TenantController.createTenant - user:', req.user?.email, 'data:', req.body);
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado. Apenas SUPERADMIN pode criar tenants.'
                });
            }
            const { name, adminUser, quotas } = req.body;
            if (!name || !adminUser || !quotas) {
                return res.status(400).json({
                    success: false,
                    message: 'Nome, dados do usuário administrador e quotas são obrigatórios'
                });
            }
            // Gerar slug automaticamente a partir do nome
            let baseSlug = name
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '') // Remove acentos
                .replace(/[^a-z0-9\s-]/g, '') // Remove caracteres especiais
                .replace(/\s+/g, '-') // Substitui espaços por hífens
                .replace(/-+/g, '-') // Remove hífens duplicados
                .replace(/^-|-$/g, ''); // Remove hífens do início e fim
            // Garantir que o slug é único
            let slug = baseSlug;
            let counter = 1;
            while (true) {
                const existingTenant = await prisma.tenant.findUnique({
                    where: { slug }
                });
                if (!existingTenant)
                    break;
                slug = `${baseSlug}-${counter}`;
                counter++;
            }
            // Verificar se email do admin já existe
            const existingUser = await prisma.user.findUnique({
                where: { email: adminUser.email }
            });
            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Email do administrador já existe'
                });
            }
            // Criar tenant e usuário admin em uma transação
            const result = await prisma.$transaction(async (tx) => {
                // Criar tenant
                const newTenant = await tx.tenant.create({
                    data: {
                        slug,
                        name,
                        active: true
                    }
                });
                // Criar usuário administrador do tenant
                const hashedPassword = await bcryptjs_1.default.hash(adminUser.senha, 12);
                const newUser = await tx.user.create({
                    data: {
                        nome: adminUser.nome,
                        email: adminUser.email,
                        senha: hashedPassword,
                        role: 'ADMIN',
                        ativo: true,
                        tenantId: newTenant.id
                    }
                });
                // Criar configurações de quota do tenant
                await tx.tenantQuota.create({
                    data: {
                        tenantId: newTenant.id,
                        maxUsers: parseInt(quotas.maxUsers) || 10,
                        maxContacts: parseInt(quotas.maxContacts) || 1000,
                        maxCampaigns: parseInt(quotas.maxCampaigns) || 50,
                        maxConnections: parseInt(quotas.maxConnections) || 5
                    }
                });
                await tx.tenantSettings.create({
                    data: {
                        tenantId: newTenant.id
                    }
                });
                return { tenant: newTenant, user: newUser };
            });
            console.log('✅ TenantController.createTenant - tenant criado:', result.tenant.id);
            res.status(201).json({
                success: true,
                message: 'Tenant criado com sucesso',
                tenant: result.tenant,
                adminUser: {
                    id: result.user.id,
                    nome: result.user.nome,
                    email: result.user.email,
                    role: result.user.role
                }
            });
        }
        catch (error) {
            console.error('❌ TenantController.createTenant - erro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    // Obter detalhes de um tenant específico (SUPERADMIN only)
    static async getTenant(req, res) {
        try {
            const { tenantId } = req.params;
            console.log('🔍 TenantController.getTenant - tenantId:', tenantId, 'user:', req.user?.email);
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado. Apenas SUPERADMIN pode visualizar detalhes de tenants.'
                });
            }
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: {
                    users: {
                        select: {
                            id: true,
                            nome: true,
                            email: true,
                            role: true,
                            ativo: true,
                            ultimoLogin: true,
                            criadoEm: true
                        }
                    },
                    quotas: true,
                    settings: true,
                    _count: {
                        select: {
                            contacts: true,
                            campaigns: true,
                            whatsappSessions: true
                        }
                    }
                }
            });
            if (!tenant) {
                return res.status(404).json({
                    success: false,
                    message: 'Tenant não encontrado'
                });
            }
            console.log('✅ TenantController.getTenant - tenant encontrado:', tenant.id);
            res.json({
                success: true,
                tenant: {
                    ...tenant,
                    contactsCount: tenant._count.contacts,
                    campaignsCount: tenant._count.campaigns,
                    sessionsCount: tenant._count.whatsappSessions
                }
            });
        }
        catch (error) {
            console.error('❌ TenantController.getTenant - erro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    // Atualizar tenant (SUPERADMIN only)
    static async updateTenant(req, res) {
        try {
            const { tenantId } = req.params;
            const { name, active, quotas } = req.body;
            console.log('🔄 TenantController.updateTenant - tenantId:', tenantId, 'data:', req.body);
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado. Apenas SUPERADMIN pode atualizar tenants.'
                });
            }
            // Usar transação para atualizar tenant e quotas
            const result = await prisma.$transaction(async (tx) => {
                const updatedTenant = await tx.tenant.update({
                    where: { id: tenantId },
                    data: {
                        ...(name && { name }),
                        ...(active !== undefined && { active })
                    }
                });
                // Atualizar quotas se fornecidas
                if (quotas) {
                    await tx.tenantQuota.upsert({
                        where: { tenantId },
                        update: {
                            ...(quotas.maxUsers && { maxUsers: parseInt(quotas.maxUsers) }),
                            ...(quotas.maxContacts && { maxContacts: parseInt(quotas.maxContacts) }),
                            ...(quotas.maxCampaigns && { maxCampaigns: parseInt(quotas.maxCampaigns) }),
                            ...(quotas.maxConnections && { maxConnections: parseInt(quotas.maxConnections) })
                        },
                        create: {
                            tenantId,
                            maxUsers: parseInt(quotas.maxUsers) || 10,
                            maxContacts: parseInt(quotas.maxContacts) || 1000,
                            maxCampaigns: parseInt(quotas.maxCampaigns) || 50,
                            maxConnections: parseInt(quotas.maxConnections) || 5
                        }
                    });
                }
                return updatedTenant;
            });
            console.log('✅ TenantController.updateTenant - tenant atualizado:', tenantId);
            res.json({
                success: true,
                message: 'Tenant atualizado com sucesso',
                tenant: result
            });
        }
        catch (error) {
            console.error('❌ TenantController.updateTenant - erro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
    // Deletar tenant (SUPERADMIN only) - cuidado com cascata
    static async deleteTenant(req, res) {
        try {
            const { tenantId } = req.params;
            console.log('🗑️ TenantController.deleteTenant - tenantId:', tenantId, 'user:', req.user?.email);
            if (req.user?.role !== 'SUPERADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'Acesso negado. Apenas SUPERADMIN pode deletar tenants.'
                });
            }
            // Verificar se tenant existe e obter contadores
            const tenant = await prisma.tenant.findUnique({
                where: { id: tenantId },
                include: {
                    _count: {
                        select: {
                            users: true,
                            contacts: true,
                            campaigns: true,
                            whatsappSessions: true
                        }
                    }
                }
            });
            if (!tenant) {
                return res.status(404).json({
                    success: false,
                    message: 'Tenant não encontrado'
                });
            }
            // Verificar se há dados importantes
            const hasData = tenant._count.contacts > 0 ||
                tenant._count.campaigns > 0 ||
                tenant._count.whatsappSessions > 0;
            if (hasData && !req.body.force) {
                return res.status(400).json({
                    success: false,
                    message: 'Tenant possui dados associados. Use force=true para deletar mesmo assim.',
                    data: {
                        users: tenant._count.users,
                        contacts: tenant._count.contacts,
                        campaigns: tenant._count.campaigns,
                        sessions: tenant._count.whatsappSessions
                    }
                });
            }
            // Deletar tenant (cascata remove todos os dados relacionados)
            await prisma.tenant.delete({
                where: { id: tenantId }
            });
            console.log('✅ TenantController.deleteTenant - tenant deletado:', tenantId);
            res.json({
                success: true,
                message: 'Tenant deletado com sucesso'
            });
        }
        catch (error) {
            console.error('❌ TenantController.deleteTenant - erro:', error);
            res.status(500).json({
                success: false,
                message: 'Erro interno do servidor'
            });
        }
    }
}
exports.TenantController = TenantController;
