import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { messageTemplateService } from '../services/messageTemplateService';

const router = express.Router();

// Aplicar middleware de autenticação em todas as rotas
router.use(authMiddleware);

// Validações comuns
const templateValidation = [
  body('name').notEmpty().withMessage('Nome é obrigatório').isLength({ min: 3 }).withMessage('Nome deve ter pelo menos 3 caracteres'),
  body('category').notEmpty().withMessage('Categoria é obrigatória'),
  body('messageType').isIn(['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO']).withMessage('Tipo de mensagem inválido'),
  body('content').notEmpty().withMessage('Conteúdo é obrigatório'),
  body('active').isBoolean().withMessage('Campo ativo deve ser boolean'),
  body('tags').isArray().withMessage('Tags deve ser um array'),
  body('description').optional().isString(),
  body('mediaUrl').optional().isString()
];

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

// GET /api/templates - Listar templates do tenant
router.get('/', [
  query('category').optional().isString(),
  query('messageType').optional().isIn(['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO']),
  query('active').optional().isBoolean(),
  query('search').optional().isString(),
  query('tags').optional().isString()
], async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const filters: any = {};

    if (req.query.category) filters.category = req.query.category;
    if (req.query.messageType) filters.messageType = req.query.messageType;
    if (req.query.active !== undefined) filters.active = req.query.active === 'true';
    if (req.query.search) filters.search = req.query.search;
    if (req.query.tags) filters.tags = req.query.tags.split(',');

    const templates = await messageTemplateService.getTemplates(tenantId, filters);

    res.json({
      success: true,
      data: templates,
      count: templates.length
    });

  } catch (error) {
    console.error('Erro ao listar templates:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/templates/stats - Estatísticas dos templates
router.get('/stats', async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const stats = await messageTemplateService.getTemplateStats(tenantId);

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/templates/categories - Listar categorias
router.get('/categories', async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const categories = await messageTemplateService.getCategories(tenantId);

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    console.error('Erro ao listar categorias:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// GET /api/templates/:id - Obter template específico
router.get('/:id', [
  param('id').isUUID().withMessage('ID inválido')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const template = await messageTemplateService.getTemplate(id, tenantId);

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' });
    }

    res.json({
      success: true,
      data: template
    });

  } catch (error) {
    console.error('Erro ao buscar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/templates - Criar novo template
router.post('/', templateValidation, handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId, id: userId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    // Validar dados
    const validation = messageTemplateService.validateTemplate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Dados do template inválidos',
        details: validation.errors
      });
    }

    const templateData = {
      ...req.body,
      tenantId,
      createdBy: userId
    };

    const template = await messageTemplateService.createTemplate(templateData);

    res.status(201).json({
      success: true,
      message: 'Template criado com sucesso',
      data: template
    });

  } catch (error) {
    console.error('Erro ao criar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// PUT /api/templates/:id - Atualizar template
router.put('/:id', [
  param('id').isUUID().withMessage('ID inválido'),
  ...templateValidation
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    // Validar dados
    const validation = messageTemplateService.validateTemplate(req.body);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Dados do template inválidos',
        details: validation.errors
      });
    }

    const template = await messageTemplateService.updateTemplate(id, tenantId, req.body);

    res.json({
      success: true,
      message: 'Template atualizado com sucesso',
      data: template
    });

  } catch (error) {
    console.error('Erro ao atualizar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// DELETE /api/templates/:id - Excluir template
router.delete('/:id', [
  param('id').isUUID().withMessage('ID inválido')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    await messageTemplateService.deleteTemplate(id, tenantId);

    res.json({
      success: true,
      message: 'Template excluído com sucesso'
    });

  } catch (error) {
    console.error('Erro ao excluir template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/templates/:id/duplicate - Duplicar template
router.post('/:id/duplicate', [
  param('id').isUUID().withMessage('ID inválido'),
  body('name').notEmpty().withMessage('Nome para a cópia é obrigatório')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { name } = req.body;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const duplicate = await messageTemplateService.duplicateTemplate(id, tenantId, name);

    res.status(201).json({
      success: true,
      message: 'Template duplicado com sucesso',
      data: duplicate
    });

  } catch (error) {
    console.error('Erro ao duplicar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// POST /api/templates/:id/preview - Preview template com dados
router.post('/:id/preview', [
  param('id').isUUID().withMessage('ID inválido'),
  body('contactData').optional().isObject(),
  body('customVariables').optional().isObject()
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { id } = req.params;
    const { contactData, customVariables } = req.body;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const processedTemplate = await messageTemplateService.processTemplate(id, tenantId, contactData, customVariables);

    res.json({
      success: true,
      data: processedTemplate
    });

  } catch (error) {
    console.error('Erro ao processar template:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;