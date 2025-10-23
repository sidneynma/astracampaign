# API SUPERADMIN - Sistema Multi-Tenant

Este documento descreve as APIs exclusivas para usuários SUPERADMIN no sistema multi-tenant do Astra Campaign.

## Autenticação

Todas as rotas requerem autenticação JWT com role `SUPERADMIN`:

```bash
Authorization: Bearer <JWT_TOKEN>
```

## Endpoints Disponíveis

### 1. Listar Tenants

**GET** `/api/tenants`

Lista todos os tenants do sistema com informações resumidas.

**Response:**
```json
{
  "success": true,
  "tenants": [
    {
      "id": "tenant-uuid",
      "slug": "empresa-abc",
      "name": "Empresa ABC Ltda",
      "domain": "empresa-abc.com",
      "active": true,
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-01T00:00:00.000Z",
      "usersCount": 5,
      "contactsCount": 1250,
      "campaignsCount": 15,
      "sessionsCount": 3,
      "users": [
        {
          "id": "user-uuid",
          "nome": "Admin Empresa",
          "email": "admin@empresa-abc.com",
          "role": "TENANT_ADMIN",
          "ativo": true,
          "criadoEm": "2025-01-01T00:00:00.000Z"
        }
      ],
      "whatsappSessions": [
        {
          "id": "session-uuid",
          "name": "sessao-principal",
          "status": "WORKING",
          "provider": "EVOLUTION"
        }
      ]
    }
  ]
}
```

### 2. Criar Novo Tenant

**POST** `/api/tenants`

Cria um novo tenant com usuário administrador.

**Request Body:**
```json
{
  "slug": "nova-empresa",
  "name": "Nova Empresa Ltda",
  "domain": "nova-empresa.com", // opcional
  "adminUser": {
    "nome": "Administrador Principal",
    "email": "admin@nova-empresa.com",
    "senha": "SenhaSegura123"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tenant criado com sucesso",
  "tenant": {
    "id": "tenant-uuid",
    "slug": "nova-empresa",
    "name": "Nova Empresa Ltda",
    "domain": "nova-empresa.com",
    "active": true,
    "createdAt": "2025-01-01T00:00:00.000Z"
  },
  "adminUser": {
    "id": "user-uuid",
    "nome": "Administrador Principal",
    "email": "admin@nova-empresa.com",
    "role": "TENANT_ADMIN"
  }
}
```

### 3. Obter Detalhes de Tenant

**GET** `/api/tenants/:tenantId`

Retorna informações detalhadas de um tenant específico.

**Response:**
```json
{
  "success": true,
  "tenant": {
    "id": "tenant-uuid",
    "slug": "empresa-abc",
    "name": "Empresa ABC Ltda",
    "domain": "empresa-abc.com",
    "active": true,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z",
    "contactsCount": 1250,
    "campaignsCount": 15,
    "sessionsCount": 3,
    "users": [
      {
        "id": "user-uuid",
        "nome": "Admin Empresa",
        "email": "admin@empresa-abc.com",
        "role": "TENANT_ADMIN",
        "ativo": true,
        "ultimoLogin": "2025-01-01T12:00:00.000Z",
        "criadoEm": "2025-01-01T00:00:00.000Z"
      }
    ],
    "quotas": {
      "id": "quota-uuid",
      "maxUsers": 10,
      "maxContacts": 1000,
      "maxCampaigns": 50,
      "maxConnections": 5
    },
    "settings": {
      "id": "settings-uuid",
      "openaiApiKey": null,
      "groqApiKey": null,
      "customBranding": null
    }
  }
}
```

### 4. Atualizar Tenant

**PUT** `/api/tenants/:tenantId`

Atualiza informações de um tenant existente.

**Request Body:**
```json
{
  "name": "Empresa ABC S.A.", // opcional
  "domain": "empresaabc.com.br", // opcional
  "active": false // opcional
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tenant atualizado com sucesso",
  "tenant": {
    "id": "tenant-uuid",
    "slug": "empresa-abc",
    "name": "Empresa ABC S.A.",
    "domain": "empresaabc.com.br",
    "active": false,
    "updatedAt": "2025-01-01T12:00:00.000Z"
  }
}
```

### 5. Deletar Tenant

**DELETE** `/api/tenants/:tenantId`

Remove um tenant e todos os dados associados (CUIDADO: Operação irreversível).

**Request Body (opcional):**
```json
{
  "force": true // obrigatório se o tenant tiver dados
}
```

**Response (tenant com dados sem force):**
```json
{
  "success": false,
  "message": "Tenant possui dados associados. Use force=true para deletar mesmo assim.",
  "data": {
    "users": 5,
    "contacts": 1250,
    "campaigns": 15,
    "sessions": 3
  }
}
```

**Response (sucesso):**
```json
{
  "success": true,
  "message": "Tenant deletado com sucesso"
}
```

## Códigos de Status HTTP

- `200` - Operação realizada com sucesso
- `201` - Recurso criado com sucesso
- `400` - Erro de validação ou dados inválidos
- `401` - Token de autenticação inválido ou expirado
- `403` - Acesso negado (usuário não é SUPERADMIN)
- `404` - Tenant não encontrado
- `500` - Erro interno do servidor

## Exemplos de Uso

### Criar um novo tenant com curl

```bash
curl -X POST "http://localhost:3001/api/tenants" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "minha-empresa",
    "name": "Minha Empresa Ltda",
    "adminUser": {
      "nome": "João Administrador",
      "email": "admin@minha-empresa.com",
      "senha": "MinhaSenh@123"
    }
  }'
```

### Listar todos os tenants

```bash
curl -X GET "http://localhost:3001/api/tenants" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT_TOKEN"
```

### Deletar tenant com dados (forçado)

```bash
curl -X DELETE "http://localhost:3001/api/tenants/tenant-uuid" \
  -H "Authorization: Bearer YOUR_SUPERADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

## Notas Importantes

1. **Segurança**: Apenas usuários com role `SUPERADMIN` podem acessar estas APIs
2. **Slug único**: O campo `slug` deve ser único no sistema
3. **Deleção em cascata**: Deletar um tenant remove todos os dados relacionados
4. **Backup recomendado**: Sempre faça backup antes de deletar tenants
5. **Quotas padrão**: Novos tenants recebem quotas padrão configuráveis
6. **Email único**: Email do administrador deve ser único no sistema

## Troubleshooting

### Erro 403 - Acesso Negado
Verifique se o token JWT contém `"role": "SUPERADMIN"`

### Erro 400 - Slug já existe
Use um slug diferente, pois cada tenant deve ter um identificador único

### Erro 400 - Email já existe
O email do administrador já está sendo usado por outro usuário

### Erro 500 - Erro interno
Verifique os logs do servidor para detalhes específicos