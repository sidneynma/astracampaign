-- =============================================
-- Scripts SQL para Migração Multi-Tenant
-- =============================================
-- ATENÇÃO: Execute estes scripts em ambiente de desenvolvimento primeiro!
-- Sempre faça backup antes de executar em produção!

-- =============================================
-- 1. ANÁLISE DE DADOS
-- =============================================

-- Verificar dados órfãos (sem tenant)
SELECT
    'users' as table_name,
    COUNT(*) as orphan_records
FROM users WHERE tenant_id IS NULL
UNION ALL
SELECT
    'contacts' as table_name,
    COUNT(*) as orphan_records
FROM contacts WHERE tenant_id IS NULL
UNION ALL
SELECT
    'campaigns' as table_name,
    COUNT(*) as orphan_records
FROM campaigns WHERE tenant_id IS NULL
UNION ALL
SELECT
    'whatsapp_sessions' as table_name,
    COUNT(*) as orphan_records
FROM whatsapp_sessions WHERE tenant_id IS NULL
UNION ALL
SELECT
    'campaign_messages' as table_name,
    COUNT(*) as orphan_records
FROM campaign_messages WHERE tenant_id IS NULL;

-- Verificar tenants existentes e seus dados
SELECT
    t.id,
    t.slug,
    t.name,
    t.active,
    COUNT(DISTINCT u.id) as users_count,
    COUNT(DISTINCT c.id) as contacts_count,
    COUNT(DISTINCT camp.id) as campaigns_count,
    COUNT(DISTINCT ws.id) as sessions_count
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN contacts c ON t.id = c.tenant_id
LEFT JOIN campaigns camp ON t.id = camp.tenant_id
LEFT JOIN whatsapp_sessions ws ON t.id = ws.tenant_id
GROUP BY t.id, t.slug, t.name, t.active
ORDER BY t.created_at;

-- =============================================
-- 2. MIGRAÇÃO BÁSICA
-- =============================================

-- TEMPLATE: Migrar todos os dados órfãos para um tenant específico
-- SUBSTITUIR 'YOUR_TENANT_ID_HERE' pelo ID real do tenant

-- Migrar usuários
UPDATE users
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    atualizado_em = NOW()
WHERE tenant_id IS NULL;

-- Migrar contatos
UPDATE contacts
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    "atualizadoEm" = NOW()
WHERE tenant_id IS NULL;

-- Migrar campanhas
UPDATE campaigns
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    atualizado_em = NOW()
WHERE tenant_id IS NULL;

-- Migrar mensagens de campanha
UPDATE campaign_messages
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    atualizado_em = NOW()
WHERE tenant_id IS NULL;

-- Migrar sessões WhatsApp
UPDATE whatsapp_sessions
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    atualizado_em = NOW()
WHERE tenant_id IS NULL;

-- =============================================
-- 3. MIGRAÇÃO SELETIVA
-- =============================================

-- Migrar apenas contatos criados após uma data específica
UPDATE contacts
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    "atualizadoEm" = NOW()
WHERE tenant_id IS NULL
AND "criadoEm" > '2024-01-01'::timestamp;

-- Migrar apenas campanhas ativas
UPDATE campaigns
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    atualizado_em = NOW()
WHERE tenant_id IS NULL
AND status NOT IN ('COMPLETED', 'FAILED');

-- Migrar usuários exceto SUPERADMINs
UPDATE users
SET tenant_id = 'YOUR_TENANT_ID_HERE',
    atualizado_em = NOW()
WHERE tenant_id IS NULL
AND role != 'SUPERADMIN';

-- =============================================
-- 4. MIGRAÇÃO POR DOMÍNIO DE EMAIL
-- =============================================

-- Migrar usuários por domínio de email
-- Exemplo: migrar todos os usuários @empresa.com para o tenant da empresa
UPDATE users
SET tenant_id = (
    SELECT id FROM tenants WHERE slug = 'empresa-abc' LIMIT 1
),
atualizado_em = NOW()
WHERE tenant_id IS NULL
AND email LIKE '%@empresa.com';

-- =============================================
-- 5. VALIDAÇÃO PÓS-MIGRAÇÃO
-- =============================================

-- Verificar se ainda existem dados órfãos
SELECT
    'Dados órfãos restantes' as status,
    (SELECT COUNT(*) FROM users WHERE tenant_id IS NULL) as users,
    (SELECT COUNT(*) FROM contacts WHERE tenant_id IS NULL) as contacts,
    (SELECT COUNT(*) FROM campaigns WHERE tenant_id IS NULL) as campaigns,
    (SELECT COUNT(*) FROM whatsapp_sessions WHERE tenant_id IS NULL) as sessions,
    (SELECT COUNT(*) FROM campaign_messages WHERE tenant_id IS NULL) as messages;

-- Verificar integridade referencial
SELECT
    'Verificação de integridade' as status,
    COUNT(*) as invalid_references
FROM campaigns c
LEFT JOIN tenants t ON c.tenant_id = t.id
WHERE c.tenant_id IS NOT NULL AND t.id IS NULL;

-- Verificar usuários sem tenant (devem ser apenas SUPERADMINs)
SELECT
    id, nome, email, role, tenant_id
FROM users
WHERE tenant_id IS NULL
ORDER BY role, nome;

-- =============================================
-- 6. ROLLBACK (EMERGÊNCIA)
-- =============================================

-- CUIDADO: Estes comandos removem as associações de tenant
-- Use apenas em caso de emergência e com backup!

-- Remover tenant_id de todos os contatos (ROLLBACK)
-- UPDATE contacts SET tenant_id = NULL WHERE tenant_id = 'TENANT_ID_TO_ROLLBACK';

-- Remover tenant_id de todas as campanhas (ROLLBACK)
-- UPDATE campaigns SET tenant_id = NULL WHERE tenant_id = 'TENANT_ID_TO_ROLLBACK';

-- Remover tenant_id de todas as sessões (ROLLBACK)
-- UPDATE whatsapp_sessions SET tenant_id = NULL WHERE tenant_id = 'TENANT_ID_TO_ROLLBACK';

-- =============================================
-- 7. LIMPEZA E MANUTENÇÃO
-- =============================================

-- Limpar campanhas muito antigas sem tenant
DELETE FROM campaign_messages
WHERE tenant_id IS NULL
AND criado_em < NOW() - INTERVAL '1 year';

DELETE FROM campaigns
WHERE tenant_id IS NULL
AND criado_em < NOW() - INTERVAL '1 year'
AND status IN ('COMPLETED', 'FAILED');

-- Limpar sessões inativas sem tenant
DELETE FROM whatsapp_sessions
WHERE tenant_id IS NULL
AND criado_em < NOW() - INTERVAL '6 months'
AND status IN ('STOPPED', 'FAILED');

-- =============================================
-- 8. RELATÓRIOS DE MIGRAÇÃO
-- =============================================

-- Relatório completo por tenant
SELECT
    t.name as tenant_name,
    t.slug,
    t.active,
    tq.max_users,
    tq.max_contacts,
    tq.max_campaigns,
    tq.max_connections,
    COUNT(DISTINCT u.id) as current_users,
    COUNT(DISTINCT c.id) as current_contacts,
    COUNT(DISTINCT camp.id) as current_campaigns,
    COUNT(DISTINCT ws.id) as current_sessions,
    CASE
        WHEN COUNT(DISTINCT c.id) > tq.max_contacts THEN '⚠️ Quota Exceeded'
        WHEN COUNT(DISTINCT c.id) > tq.max_contacts * 0.8 THEN '⚠️ Near Limit'
        ELSE '✅ OK'
    END as quota_status
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN contacts c ON t.id = c.tenant_id
LEFT JOIN campaigns camp ON t.id = camp.tenant_id
LEFT JOIN whatsapp_sessions ws ON t.id = ws.tenant_id
LEFT JOIN tenant_quotas tq ON t.id = tq.tenant_id
GROUP BY t.id, t.name, t.slug, t.active, tq.max_users, tq.max_contacts, tq.max_campaigns, tq.max_connections
ORDER BY t.name;

-- Relatório de uso de storage por tenant
SELECT
    t.name as tenant_name,
    COUNT(DISTINCT c.id) as contacts,
    COUNT(DISTINCT cm.id) as campaign_messages,
    COALESCE(SUM(LENGTH(cm.message_content)), 0) as total_message_content_size,
    COALESCE(AVG(LENGTH(cm.message_content)), 0) as avg_message_size
FROM tenants t
LEFT JOIN contacts c ON t.id = c.tenant_id
LEFT JOIN campaigns camp ON t.id = camp.tenant_id
LEFT JOIN campaign_messages cm ON camp.id = cm.campaign_id
GROUP BY t.id, t.name
ORDER BY total_message_content_size DESC;

-- =============================================
-- 9. ÍNDICES PARA PERFORMANCE
-- =============================================

-- Criar índices para otimizar queries multi-tenant
-- (Estes índices já devem existir se o schema foi aplicado corretamente)

-- Verificar se os índices existem
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('users', 'contacts', 'campaigns', 'whatsapp_sessions', 'campaign_messages')
AND indexdef LIKE '%tenant_id%'
ORDER BY tablename, indexname;

-- Criar índices se não existirem (exemplo)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tenant_id ON contacts(tenant_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_sessions_tenant_id ON whatsapp_sessions(tenant_id);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_messages_tenant_id ON campaign_messages(tenant_id);

-- =============================================
-- 10. BACKUP ANTES DA MIGRAÇÃO
-- =============================================

/*
Execute estes comandos no terminal antes de fazer a migração:

# Backup completo do banco
pg_dump -h postgres -U postgres -d contacts > backup_pre_migration.sql

# Backup apenas das tabelas que serão alteradas
pg_dump -h postgres -U postgres -d contacts \
  -t users -t contacts -t campaigns -t whatsapp_sessions -t campaign_messages \
  > backup_multitenant_tables.sql

# Verificar o backup
ls -la backup_*.sql

# Para restaurar em caso de emergência:
# psql -h postgres -U postgres -d contacts < backup_pre_migration.sql
*/