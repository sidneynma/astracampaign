# Guia Completo - Sistema Multi-Tenant Astra Campaign

Este guia apresenta como configurar, usar e gerenciar o sistema multi-tenant do Astra Campaign.

## Índice
1. [Visão Geral](#visão-geral)
2. [Arquitetura Multi-Tenant](#arquitetura-multi-tenant)
3. [Configuração Inicial](#configuração-inicial)
4. [Gerenciamento de Tenants](#gerenciamento-de-tenants)
5. [Isolamento de Dados](#isolamento-de-dados)
6. [Roles e Permissões](#roles-e-permissões)
7. [APIs Multi-Tenant](#apis-multi-tenant)
8. [Migração de Dados](#migração-de-dados)
9. [Monitoramento](#monitoramento)
10. [Troubleshooting](#troubleshooting)

## Visão Geral

O Astra Campaign agora suporta múltiplos tenants (clientes/organizações) em uma única instalação, proporcionando:

- **Isolamento completo de dados** entre tenants
- **Gestão centralizada** via SUPERADMIN
- **Escalabilidade** para SaaS
- **Segurança** com RBAC robusto
- **Flexibilidade** na configuração por tenant

## Arquitetura Multi-Tenant

### Modelo de Dados
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   TENANT A  │    │   TENANT B  │    │   TENANT C  │
├─────────────┤    ├─────────────┤    ├─────────────┤
│ Users       │    │ Users       │    │ Users       │
│ Contacts    │    │ Contacts    │    │ Contacts    │
│ Campaigns   │    │ Campaigns   │    │ Campaigns   │
│ Sessions    │    │ Sessions    │    │ Sessions    │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                  ┌─────────────┐
                  │ SUPERADMIN  │
                  │   (Global)  │
                  └─────────────┘
```

### Níveis de Acesso
- **SUPERADMIN**: Acesso total ao sistema e todos os tenants
- **TENANT_ADMIN**: Administrador de um tenant específico
- **USER**: Usuário regular dentro de um tenant

## Configuração Inicial

### 1. Primeiro SUPERADMIN

O sistema cria automaticamente um usuário SUPERADMIN na primeira inicialização:

```
Email: admin@astra.com.br
Senha: admin123
Role: SUPERADMIN
```

⚠️ **IMPORTANTE**: Altere esta senha imediatamente após o primeiro login!

### 2. Obter Token SUPERADMIN

```bash
# Login como SUPERADMIN
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@astra.com.br",
    "password": "admin123"
  }'
```

Resposta:
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "nome": "Super Admin",
    "email": "admin@astra.com.br",
    "role": "SUPERADMIN"
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Gerenciamento de Tenants

### Criar Novo Tenant

```bash
curl -X POST "http://localhost:3001/api/tenants" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "empresa-exemplo",
    "name": "Empresa Exemplo Ltda",
    "domain": "exemplo.com",
    "adminUser": {
      "nome": "João Silva",
      "email": "admin@exemplo.com",
      "senha": "SenhaSegura123"
    }
  }'
```

### Estrutura Criada Automaticamente

Ao criar um tenant, o sistema automaticamente cria:

1. **Tenant** com configurações padrão
2. **Usuário TENANT_ADMIN** com acesso completo ao tenant
3. **TenantQuota** com limites padrão:
   - 10 usuários máximo
   - 1000 contatos máximo
   - 50 campanhas máximo
   - 5 conexões WhatsApp máximo
4. **TenantSettings** para configurações específicas

### Quotas e Limites

```json
{
  "maxUsers": 10,        // Máximo de usuários no tenant
  "maxContacts": 1000,   // Máximo de contatos
  "maxCampaigns": 50,    // Máximo de campanhas
  "maxConnections": 5    // Máximo de sessões WhatsApp
}
```

## Isolamento de Dados

### Como Funciona

1. **JWT com tenantId**: Cada token contém o ID do tenant
2. **Filtros automáticos**: Todas as queries incluem filtro por tenant
3. **Middleware de autenticação**: Valida tenant ativo e permissões
4. **SUPERADMIN bypass**: SUPERADMIN pode acessar dados de qualquer tenant

### Exemplo de Isolamento

```javascript
// Usuário TENANT_ADMIN ou USER - vê apenas seus dados
GET /api/contatos
// Retorna apenas contatos do tenant do usuário

// SUPERADMIN - pode ver todos os dados
GET /api/contatos
// Retorna contatos de todos os tenants
```

## Roles e Permissões

### SUPERADMIN
- ✅ Criar, editar, deletar tenants
- ✅ Ver dados de todos os tenants
- ✅ Gerenciar usuários de qualquer tenant
- ✅ Configurar sistema global
- ✅ Monitorar todas as atividades

### TENANT_ADMIN
- ✅ Gerenciar usuários do seu tenant
- ✅ Ver todos os dados do tenant
- ✅ Configurar sessões WhatsApp
- ✅ Criar e gerenciar campanhas
- ❌ Acessar dados de outros tenants
- ❌ Gerenciar tenants

### USER
- ✅ Ver contatos do tenant
- ✅ Executar campanhas autorizada
- ✅ Ver relatórios básicos
- ❌ Gerenciar usuários
- ❌ Configurar sistema
- ❌ Acessar outros tenants

## APIs Multi-Tenant

### Contatos
```bash
# Criar contato (automaticamente associado ao tenant do usuário)
POST /api/contatos
{
  "nome": "Cliente Exemplo",
  "telefone": "11999999999",
  "email": "cliente@exemplo.com",
  "tags": ["cliente", "premium"]
}
```

### Campanhas
```bash
# Criar campanha (isolada por tenant)
POST /api/campaigns
{
  "nome": "Campanha Black Friday",
  "targetTags": "cliente,premium",
  "messageContent": "Oferta especial só hoje!",
  "sessionName": "sessao-principal"
}
```

### Sessões WhatsApp
```bash
# Criar sessão (associada ao tenant)
POST /api/waha/sessions
{
  "name": "sessao-vendas",
  "provider": "EVOLUTION"
}
```

## Migração de Dados

### Dados Existentes (Pré Multi-Tenant)

Os dados existentes antes da implementação multi-tenant ficam:
- **Sem tenantId** (null) no banco de dados
- **Acessíveis apenas pelo SUPERADMIN**
- **Podem ser migrados** para tenants específicos

### Script de Migração (Exemplo)

```sql
-- Migrar contatos para um tenant específico
UPDATE contacts
SET tenant_id = 'tenant-uuid'
WHERE tenant_id IS NULL;

-- Migrar campanhas
UPDATE campaigns
SET tenant_id = 'tenant-uuid'
WHERE tenant_id IS NULL;

-- Migrar sessões WhatsApp
UPDATE whatsapp_sessions
SET tenant_id = 'tenant-uuid'
WHERE tenant_id IS NULL;
```

## Monitoramento

### Métricas por Tenant

```bash
# Ver estatísticas detalhadas de um tenant
GET /api/tenants/tenant-uuid
```

Retorna:
- Número de usuários
- Número de contatos
- Número de campanhas ativas
- Sessões WhatsApp conectadas
- Uso vs. quotas configuradas

### Logs e Auditoria

O sistema registra automaticamente:
- Logins por tenant
- Operações CRUD com tenantId
- Criação/modificação de tenants
- Violações de quota

## Troubleshooting

### Problemas Comuns

#### 1. Erro 403 - Acesso Negado
**Causa**: Usuário tentando acessar dados de outro tenant

**Solução**: Verificar se o usuário pertence ao tenant correto

#### 2. Contatos/Campanhas não aparecem
**Causa**: Dados não associados a nenhum tenant (legacy)

**Solução**: Migrar dados ou acessar como SUPERADMIN

#### 3. Quota excedida
**Causa**: Tenant tentou criar mais recursos que o permitido

**Solução**: Aumentar quota ou fazer limpeza de dados

### Comandos de Debug

```bash
# Ver logs do backend
docker service logs work_backend

# Verificar status dos tenants
curl -X GET "http://localhost:3001/api/tenants" \
  -H "Authorization: Bearer SUPERADMIN_TOKEN"

# Testar isolamento
# 1. Login como TENANT_ADMIN
# 2. Tentar acessar dados - deve ver apenas do seu tenant
# 3. Login como SUPERADMIN
# 4. Acessar dados - deve ver todos os tenants
```

### Banco de Dados

```sql
-- Verificar tenants ativos
SELECT id, slug, name, active FROM tenants;

-- Verificar usuários por tenant
SELECT u.nome, u.email, u.role, t.name as tenant_name
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id;

-- Verificar dados órfãos (sem tenant)
SELECT COUNT(*) FROM contacts WHERE tenant_id IS NULL;
SELECT COUNT(*) FROM campaigns WHERE tenant_id IS NULL;
```

## Backup e Segurança

### Backup por Tenant

```bash
# Backup específico de um tenant
pg_dump -h postgres -U postgres -d contacts \
  --where="tenant_id='tenant-uuid'" \
  -t contacts -t campaigns -t whatsapp_sessions > tenant_backup.sql
```

### Segurança

- **Tokens JWT** com expiração configurável
- **Rate limiting** por IP e por tenant
- **Validação** de permissões em todas as rotas
- **Logs de auditoria** para operações sensíveis
- **Backup automático** recomendado

## Próximos Passos

1. **Interface Web SUPERADMIN**: Dashboard para gestão visual de tenants
2. **Relatórios Multi-Tenant**: Analytics consolidados e por tenant
3. **API Webhooks**: Notificações de eventos por tenant
4. **Integrations**: Conectores específicos por tenant
5. **Billing**: Sistema de cobrança baseado em uso

---

Para mais informações técnicas, consulte:
- [API SUPERADMIN](./SUPERADMIN_API.md)
- [Documentação da API](./API_DOCUMENTATION.md)
- Logs do sistema em `/var/log/astra-campaign/`