-- =============================================
-- Script de Otimização de Performance Multi-Tenant
-- =============================================

-- ANÁLISE DE PERFORMANCE
-- =============================================

-- 1. Verificar uso de índices nas consultas multi-tenant
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM contacts WHERE tenant_id = 'example-tenant-id' LIMIT 100;

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM campaigns WHERE tenant_id = 'example-tenant-id' AND status = 'ACTIVE';

EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM whatsapp_sessions WHERE tenant_id = 'example-tenant-id' AND status = 'WORKING';

-- 2. Análise de distribuição de dados por tenant
SELECT
    'contacts' as table_name,
    tenant_id,
    COUNT(*) as record_count,
    AVG(LENGTH(nome)) as avg_name_length,
    AVG(array_length(tags, 1)) as avg_tags_count
FROM contacts
GROUP BY tenant_id
ORDER BY record_count DESC;

SELECT
    'campaigns' as table_name,
    tenant_id,
    COUNT(*) as record_count,
    AVG(LENGTH(message_content)) as avg_message_length,
    COUNT(DISTINCT status) as distinct_statuses
FROM campaigns
GROUP BY tenant_id
ORDER BY record_count DESC;

-- 3. Identificar consultas lentas
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
WHERE query LIKE '%tenant_id%'
ORDER BY mean_exec_time DESC
LIMIT 10;

-- OTIMIZAÇÕES DE ÍNDICES
-- =============================================

-- 4. Criar índices compostos para queries frequentes
-- Índice para consultas de contatos com filtro e ordenação
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tenant_search_created
ON contacts(tenant_id, nome, "criadoEm" DESC)
WHERE tenant_id IS NOT NULL;

-- Índice para campanhas por tenant e status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaigns_tenant_status_created
ON campaigns(tenant_id, status, criado_em DESC)
WHERE tenant_id IS NOT NULL;

-- Índice para mensagens de campanha por tenant
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_campaign_messages_tenant_status
ON campaign_messages(tenant_id, status, sent_at DESC)
WHERE tenant_id IS NOT NULL;

-- Índice para sessões WhatsApp por tenant e provider
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_whatsapp_sessions_tenant_provider
ON whatsapp_sessions(tenant_id, provider, status)
WHERE tenant_id IS NOT NULL;

-- Índices para consultas de busca (ILIKE/GIN)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tenant_name_gin
ON contacts USING gin(tenant_id, nome gin_trgm_ops)
WHERE tenant_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tenant_email_gin
ON contacts USING gin(tenant_id, email gin_trgm_ops)
WHERE tenant_id IS NOT NULL AND email IS NOT NULL;

-- 5. Índices para tags (array operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contacts_tenant_tags_gin
ON contacts USING gin(tenant_id, tags)
WHERE tenant_id IS NOT NULL;

-- PARTICIONAMENTO (Para grandes volumes)
-- =============================================

-- 6. Preparar particionamento por tenant (se necessário)
-- Exemplo para tabela de mensagens de campanha (histórico grande)

/*
-- Criar tabela particionada por tenant_id
CREATE TABLE campaign_messages_partitioned (
    LIKE campaign_messages INCLUDING ALL
) PARTITION BY HASH (tenant_id);

-- Criar partições (exemplo para 4 partições)
CREATE TABLE campaign_messages_part_0 PARTITION OF campaign_messages_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 0);

CREATE TABLE campaign_messages_part_1 PARTITION OF campaign_messages_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 1);

CREATE TABLE campaign_messages_part_2 PARTITION OF campaign_messages_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 2);

CREATE TABLE campaign_messages_part_3 PARTITION OF campaign_messages_partitioned
    FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- Migração de dados (cuidadoso!)
-- INSERT INTO campaign_messages_partitioned SELECT * FROM campaign_messages;
*/

-- OTIMIZAÇÕES DE CONSULTAS
-- =============================================

-- 7. Views materializadas para estatísticas por tenant
CREATE MATERIALIZED VIEW IF NOT EXISTS tenant_stats AS
SELECT
    t.id as tenant_id,
    t.name as tenant_name,
    t.slug,
    COUNT(DISTINCT u.id) as users_count,
    COUNT(DISTINCT c.id) as contacts_count,
    COUNT(DISTINCT camp.id) as campaigns_count,
    COUNT(DISTINCT ws.id) as sessions_count,
    COUNT(DISTINCT cm.id) as messages_count,
    SUM(CASE WHEN camp.status = 'ACTIVE' THEN 1 ELSE 0 END) as active_campaigns,
    SUM(CASE WHEN ws.status = 'WORKING' THEN 1 ELSE 0 END) as working_sessions,
    MAX(c."criadoEm") as last_contact_created,
    MAX(camp.criado_em) as last_campaign_created
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN contacts c ON t.id = c.tenant_id
LEFT JOIN campaigns camp ON t.id = camp.tenant_id
LEFT JOIN whatsapp_sessions ws ON t.id = ws.tenant_id
LEFT JOIN campaign_messages cm ON t.id = cm.tenant_id
WHERE t.active = true
GROUP BY t.id, t.name, t.slug;

-- Índice para a view materializada
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_stats_tenant_id
ON tenant_stats(tenant_id);

-- Refresh automático da view (criar job se necessário)
-- SELECT cron.schedule('refresh-tenant-stats', '*/30 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_stats;');

-- 8. Função para refresh das estatísticas
CREATE OR REPLACE FUNCTION refresh_tenant_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tenant_stats;
    INSERT INTO system_logs (type, message, created_at)
    VALUES ('INFO', 'Tenant stats refreshed', NOW());
EXCEPTION
    WHEN OTHERS THEN
        INSERT INTO system_logs (type, message, created_at)
        VALUES ('ERROR', 'Failed to refresh tenant stats: ' || SQLERRM, NOW());
END;
$$ LANGUAGE plpgsql;

-- CONFIGURAÇÕES DO POSTGRESQL
-- =============================================

-- 9. Verificar configurações importantes
SHOW shared_preload_libraries; -- Deve incluir 'pg_stat_statements'
SHOW max_connections;
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW work_mem;

-- 10. Configurações recomendadas para multi-tenant

/*
# postgresql.conf recomendações

# Memória
shared_buffers = 256MB                    # 25% da RAM total
effective_cache_size = 1GB                # 75% da RAM total
work_mem = 4MB                           # Por operação de sort/hash
maintenance_work_mem = 64MB              # Para VACUUM, CREATE INDEX

# Conexões
max_connections = 100                    # Ajustar baseado no uso

# WAL e Checkpoints
wal_buffers = 16MB
checkpoint_completion_target = 0.9
checkpoint_timeout = 10min

# Logging para análise
log_min_duration_statement = 1000ms      # Log queries > 1 segundo
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on

# Extensões para performance
shared_preload_libraries = 'pg_stat_statements, pg_trgm'

# pg_stat_statements config
pg_stat_statements.max = 10000
pg_stat_statements.track = all
*/

-- MONITORAMENTO
-- =============================================

-- 11. Query para monitorar performance das queries multi-tenant
SELECT
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename IN ('contacts', 'campaigns', 'whatsapp_sessions', 'campaign_messages')
AND attname = 'tenant_id';

-- 12. Monitor de locks por tenant
SELECT
    t.schemaname,
    t.tablename,
    l.mode,
    l.granted,
    l.pid,
    a.usename,
    a.query,
    a.query_start
FROM pg_locks l
JOIN pg_stat_all_tables t ON l.relation = t.relid
LEFT JOIN pg_stat_activity a ON l.pid = a.pid
WHERE t.tablename IN ('contacts', 'campaigns', 'whatsapp_sessions', 'campaign_messages')
AND l.mode != 'AccessShareLock'
ORDER BY t.tablename, l.granted;

-- 13. Estatísticas de uso por tenant
SELECT
    ts.tenant_name,
    ts.contacts_count,
    ts.campaigns_count,
    ts.messages_count,
    ts.active_campaigns,
    ts.working_sessions,
    tq.max_contacts,
    tq.max_campaigns,
    ROUND(ts.contacts_count::numeric / tq.max_contacts * 100, 2) as contacts_usage_pct,
    ROUND(ts.campaigns_count::numeric / tq.max_campaigns * 100, 2) as campaigns_usage_pct,
    CASE
        WHEN ts.contacts_count > tq.max_contacts THEN '🔴 Quota exceeded'
        WHEN ts.contacts_count > tq.max_contacts * 0.9 THEN '🟡 Near limit'
        ELSE '🟢 OK'
    END as quota_status
FROM tenant_stats ts
JOIN tenant_quotas tq ON ts.tenant_id = tq.tenant_id
ORDER BY contacts_usage_pct DESC;

-- LIMPEZA E MANUTENÇÃO
-- =============================================

-- 14. Vacuum e análise automáticos
VACUUM (ANALYZE, VERBOSE) contacts;
VACUUM (ANALYZE, VERBOSE) campaigns;
VACUUM (ANALYZE, VERBOSE) whatsapp_sessions;
VACUUM (ANALYZE, VERBOSE) campaign_messages;

-- 15. Reindexação periódica (se necessário)
REINDEX INDEX CONCURRENTLY idx_contacts_tenant_id;
REINDEX INDEX CONCURRENTLY idx_campaigns_tenant_id;
REINDEX INDEX CONCURRENTLY idx_whatsapp_sessions_tenant_id;
REINDEX INDEX CONCURRENTLY idx_campaign_messages_tenant_id;

-- 16. Limpeza de dados antigos por tenant
-- Exemplo: remover mensagens de campanha antigas (> 1 ano)
DELETE FROM campaign_messages
WHERE tenant_id IS NOT NULL
AND criado_em < NOW() - INTERVAL '1 year'
AND status IN ('SENT', 'DELIVERED', 'FAILED')
-- Execute em batches para evitar lock longo
LIMIT 1000;

-- 17. Análise de fragmentação de índices
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('contacts', 'campaigns', 'whatsapp_sessions', 'campaign_messages')
ORDER BY pg_relation_size(indexrelid) DESC;

-- ALERTAS E NOTIFICAÇÕES
-- =============================================

-- 18. Função para verificar quotas excedidas
CREATE OR REPLACE FUNCTION check_tenant_quotas()
RETURNS TABLE(tenant_id uuid, tenant_name text, quota_type text, current_value bigint, max_value integer, usage_pct numeric) AS $$
BEGIN
    RETURN QUERY
    WITH tenant_usage AS (
        SELECT
            t.id,
            t.name,
            COUNT(DISTINCT u.id) as users_count,
            COUNT(DISTINCT c.id) as contacts_count,
            COUNT(DISTINCT camp.id) as campaigns_count,
            COUNT(DISTINCT ws.id) as sessions_count
        FROM tenants t
        LEFT JOIN users u ON t.id = u.tenant_id
        LEFT JOIN contacts c ON t.id = c.tenant_id
        LEFT JOIN campaigns camp ON t.id = camp.tenant_id
        LEFT JOIN whatsapp_sessions ws ON t.id = ws.tenant_id
        GROUP BY t.id, t.name
    )
    SELECT tu.id, tu.name, 'contacts'::text, tu.contacts_count, tq.max_contacts, ROUND(tu.contacts_count::numeric / tq.max_contacts * 100, 2)
    FROM tenant_usage tu
    JOIN tenant_quotas tq ON tu.id = tq.tenant_id
    WHERE tu.contacts_count > tq.max_contacts * 0.8

    UNION ALL

    SELECT tu.id, tu.name, 'campaigns'::text, tu.campaigns_count, tq.max_campaigns, ROUND(tu.campaigns_count::numeric / tq.max_campaigns * 100, 2)
    FROM tenant_usage tu
    JOIN tenant_quotas tq ON tu.id = tq.tenant_id
    WHERE tu.campaigns_count > tq.max_campaigns * 0.8;
END;
$$ LANGUAGE plpgsql;

-- Executar verificação de quotas
SELECT * FROM check_tenant_quotas();

-- 19. Query final de resumo de otimizações aplicadas
SELECT
    'Performance Optimization Summary' as title,
    COUNT(*) FILTER (WHERE indexname LIKE '%tenant%') as tenant_indexes_created,
    COUNT(*) FILTER (WHERE indexname LIKE '%gin%') as fulltext_indexes,
    COUNT(*) as total_indexes
FROM pg_indexes
WHERE tablename IN ('contacts', 'campaigns', 'whatsapp_sessions', 'campaign_messages');