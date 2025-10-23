import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { automationService, TriggerType, ActionType, ConditionType } from '../services/automationService';

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Middleware para validar erros
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Dados inválidos',
      details: errors.array()
    });
  }
  next();
};

// GET /api/automation/flows - Listar fluxos de automação
router.get('/flows', [
  query('active').optional().isBoolean(),
  query('search').optional().isString(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const filters: any = {};
    if (req.query.active !== undefined) filters.active = req.query.active === 'true';
    if (req.query.search) {
      filters.OR = [
        { name: { contains: req.query.search, mode: 'insensitive' } },
        { description: { contains: req.query.search, mode: 'insensitive' } }
      ];
    }

    const flows = await automationService.getFlows(tenantId, filters);

    res.json({
      success: true,
      data: flows,
      count: flows.length
    });

  } catch (error) {
    console.error('Erro ao listar fluxos:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/automation/flows/:id - Obter fluxo específico
router.get('/flows/:id', [
  param('id').isUUID().withMessage('ID inválido')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const flows = await automationService.getFlows(tenantId, { id });
    const flow = flows[0];

    if (!flow) {
      return res.status(404).json({ error: 'Fluxo não encontrado' });
    }

    res.json({
      success: true,
      data: flow
    });

  } catch (error) {
    console.error('Erro ao buscar fluxo:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/automation/flows - Criar novo fluxo
router.post('/flows', [
  body('name').notEmpty().withMessage('Nome é obrigatório').isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),
  body('description').optional().isString(),
  body('active').isBoolean().withMessage('Campo ativo deve ser boolean'),
  body('trigger').isObject().withMessage('Trigger é obrigatório'),
  body('trigger.type').isIn(Object.values(TriggerType)).withMessage('Tipo de trigger inválido'),
  body('conditions').optional().isArray(),
  body('actions').isArray({ min: 1 }).withMessage('Pelo menos uma ação é obrigatória'),
  body('actions.*.type').isIn(Object.values(ActionType)).withMessage('Tipo de ação inválido'),
  body('actions.*.order').isInt({ min: 0 }).withMessage('Ordem da ação deve ser um número')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId, id: userId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const flowData = {
      ...req.body,
      tenantId,
      createdBy: userId
    };

    const flow = await automationService.createFlow(flowData);

    res.status(201).json({
      success: true,
      message: 'Fluxo de automação criado com sucesso',
      data: flow
    });

  } catch (error) {
    console.error('Erro ao criar fluxo:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// PUT /api/automation/flows/:id - Atualizar fluxo
router.put('/flows/:id', [
  param('id').isUUID().withMessage('ID inválido'),
  body('name').optional().isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),
  body('description').optional().isString(),
  body('active').optional().isBoolean(),
  body('trigger').optional().isObject(),
  body('conditions').optional().isArray(),
  body('actions').optional().isArray()
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const flow = await automationService.updateFlow(id, tenantId, req.body);

    res.json({
      success: true,
      message: 'Fluxo atualizado com sucesso',
      data: flow
    });

  } catch (error) {
    console.error('Erro ao atualizar fluxo:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// DELETE /api/automation/flows/:id - Excluir fluxo
router.delete('/flows/:id', [
  param('id').isUUID().withMessage('ID inválido')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    await automationService.deleteFlow(id, tenantId);

    res.json({
      success: true,
      message: 'Fluxo excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir fluxo:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/automation/flows/:id/executions - Listar execuções de um fluxo
router.get('/flows/:id/executions', [
  param('id').isUUID().withMessage('ID inválido'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['SUCCESS', 'FAILED', 'RUNNING'])
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const executions = await automationService.getFlowExecutions(id, tenantId);

    // Filtrar por status se fornecido
    let filteredExecutions = executions;
    if (req.query.status) {
      filteredExecutions = executions.filter((exec: any) => exec.status === req.query.status);
    }

    // Paginação
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const paginatedExecutions = filteredExecutions.slice(offset, offset + limit);

    res.json({
      success: true,
      data: paginatedExecutions,
      pagination: {
        page,
        limit,
        total: filteredExecutions.length,
        totalPages: Math.ceil(filteredExecutions.length / limit)
      }
    });

  } catch (error) {
    console.error('Erro ao listar execuções:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/automation/flows/:id/test - Testar fluxo manualmente
router.post('/flows/:id/test', [
  param('id').isUUID().withMessage('ID inválido'),
  body('testData').optional().isObject()
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const testData = req.body.testData || {
      testMode: true,
      timestamp: new Date(),
      triggerBy: 'manual_test'
    };

    const result = await automationService.testFlow(id, tenantId, testData);

    res.json({
      success: true,
      message: 'Teste executado com sucesso',
      data: result
    });

  } catch (error) {
    console.error('Erro ao testar fluxo:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/automation/triggers - Listar tipos de triggers disponíveis
router.get('/triggers', async (req: any, res: any) => {
  try {
    const triggers = Object.values(TriggerType).map(type => ({
      type,
      name: type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      description: getTriggerDescription(type)
    }));

    res.json({
      success: true,
      data: triggers
    });

  } catch (error) {
    console.error('Erro ao listar triggers:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/automation/actions - Listar tipos de ações disponíveis
router.get('/actions', async (req: any, res: any) => {
  try {
    const actions = Object.values(ActionType).map(type => ({
      type,
      name: type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      description: getActionDescription(type),
      configSchema: getActionConfigSchema(type)
    }));

    res.json({
      success: true,
      data: actions
    });

  } catch (error) {
    console.error('Erro ao listar ações:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/automation/conditions - Listar tipos de condições disponíveis
router.get('/conditions', async (req: any, res: any) => {
  try {
    const conditions = Object.values(ConditionType).map(type => ({
      type,
      name: type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase()),
      description: getConditionDescription(type)
    }));

    res.json({
      success: true,
      data: conditions
    });

  } catch (error) {
    console.error('Erro ao listar condições:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/automation/webhook/:flowId - Endpoint para receber webhooks
router.post('/webhook/:flowId', [
  param('flowId').isUUID().withMessage('ID do fluxo inválido')
], async (req: any, res: any) => {
  try {
    const { flowId } = req.params;
    const webhookData = {
      ...req.body,
      headers: req.headers,
      timestamp: new Date(),
      ip: req.ip
    };

    // Executar trigger de webhook
    await automationService.executeTrigger(TriggerType.WEBHOOK_RECEIVED, {
      flowId,
      webhookData
    });

    res.json({
      success: true,
      message: 'Webhook processado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao processar webhook:', error);
    res.status(500).json({
      error: 'Erro ao processar webhook',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Funções auxiliares para documentação
function getTriggerDescription(type: TriggerType): string {
  const descriptions: { [key in TriggerType]: string } = {
    [TriggerType.CONTACT_CREATED]: 'Disparado quando um novo contato é criado',
    [TriggerType.CONTACT_UPDATED]: 'Disparado quando um contato é atualizado',
    [TriggerType.CAMPAIGN_COMPLETED]: 'Disparado quando uma campanha é concluída',
    [TriggerType.MESSAGE_DELIVERED]: 'Disparado quando uma mensagem é entregue',
    [TriggerType.MESSAGE_READ]: 'Disparado quando uma mensagem é lida',
    [TriggerType.MESSAGE_FAILED]: 'Disparado quando uma mensagem falha',
    [TriggerType.TIME_BASED]: 'Disparado em horários específicos (cron)',
    [TriggerType.WEBHOOK_RECEIVED]: 'Disparado quando um webhook é recebido',
    [TriggerType.TAG_ADDED]: 'Disparado quando uma tag é adicionada a um contato',
    [TriggerType.TAG_REMOVED]: 'Disparado quando uma tag é removida de um contato'
  };

  return descriptions[type] || 'Descrição não disponível';
}

function getActionDescription(type: ActionType): string {
  const descriptions: { [key in ActionType]: string } = {
    [ActionType.SEND_MESSAGE]: 'Enviar mensagem para um contato',
    [ActionType.ADD_TAG]: 'Adicionar tag a um contato',
    [ActionType.REMOVE_TAG]: 'Remover tag de um contato',
    [ActionType.CREATE_CAMPAIGN]: 'Criar nova campanha',
    [ActionType.SEND_EMAIL]: 'Enviar email de notificação',
    [ActionType.WEBHOOK_CALL]: 'Fazer chamada para webhook externo',
    [ActionType.UPDATE_CONTACT]: 'Atualizar dados do contato',
    [ActionType.CREATE_NOTIFICATION]: 'Criar notificação no sistema',
    [ActionType.DELAY]: 'Aguardar um período de tempo',
    [ActionType.CONDITIONAL_BRANCH]: 'Executar ação condicional'
  };

  return descriptions[type] || 'Descrição não disponível';
}

function getConditionDescription(type: ConditionType): string {
  const descriptions: { [key in ConditionType]: string } = {
    [ConditionType.EQUALS]: 'Valor é igual a',
    [ConditionType.NOT_EQUALS]: 'Valor é diferente de',
    [ConditionType.CONTAINS]: 'Valor contém',
    [ConditionType.NOT_CONTAINS]: 'Valor não contém',
    [ConditionType.GREATER_THAN]: 'Valor é maior que',
    [ConditionType.LESS_THAN]: 'Valor é menor que',
    [ConditionType.IN_LIST]: 'Valor está na lista',
    [ConditionType.NOT_IN_LIST]: 'Valor não está na lista',
    [ConditionType.HAS_TAG]: 'Contato possui tag',
    [ConditionType.NOT_HAS_TAG]: 'Contato não possui tag',
    [ConditionType.DATE_RANGE]: 'Data está no intervalo'
  };

  return descriptions[type] || 'Descrição não disponível';
}

function getActionConfigSchema(type: ActionType): any {
  const schemas: { [key in ActionType]: any } = {
    [ActionType.SEND_MESSAGE]: {
      message: { type: 'string', required: true },
      template: { type: 'string', required: false }
    },
    [ActionType.ADD_TAG]: {
      tag: { type: 'string', required: true }
    },
    [ActionType.REMOVE_TAG]: {
      tag: { type: 'string', required: true }
    },
    [ActionType.CREATE_CAMPAIGN]: {
      name: { type: 'string', required: true },
      message: { type: 'string', required: true },
      targets: { type: 'array', required: true }
    },
    [ActionType.SEND_EMAIL]: {
      to: { type: 'string', required: true },
      subject: { type: 'string', required: true },
      body: { type: 'string', required: true }
    },
    [ActionType.WEBHOOK_CALL]: {
      url: { type: 'string', required: true },
      method: { type: 'string', required: false, default: 'POST' },
      headers: { type: 'object', required: false }
    },
    [ActionType.UPDATE_CONTACT]: {
      fields: { type: 'object', required: true }
    },
    [ActionType.CREATE_NOTIFICATION]: {
      title: { type: 'string', required: true },
      message: { type: 'string', required: true },
      type: { type: 'string', required: false, default: 'INFO' }
    },
    [ActionType.DELAY]: {
      minutes: { type: 'number', required: true }
    },
    [ActionType.CONDITIONAL_BRANCH]: {
      conditions: { type: 'array', required: true },
      trueActions: { type: 'array', required: true },
      falseActions: { type: 'array', required: false }
    }
  };

  return schemas[type] || {};
}

export default router;