import express from 'express';
import { body, query, validationResult } from 'express-validator';
import { authMiddleware } from '../middleware/auth';
import { reportingService } from '../services/reportingService';

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

// GET /api/reports/performance - Relatório de performance
router.get('/performance', [
  query('startDate').optional().isISO8601().withMessage('Data de início inválida'),
  query('endDate').optional().isISO8601().withMessage('Data de fim inválida'),
  query('campaignIds').optional().isString(),
  query('sessionNames').optional().isString(),
  query('status').optional().isString(),
  query('tags').optional().isString()
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    // Construir filtros
    const filters: any = {};

    if (req.query.startDate) filters.startDate = new Date(req.query.startDate);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate);
    if (req.query.campaignIds) filters.campaignIds = req.query.campaignIds.split(',');
    if (req.query.sessionNames) filters.sessionNames = req.query.sessionNames.split(',');
    if (req.query.status) filters.status = req.query.status.split(',');
    if (req.query.tags) filters.tags = req.query.tags.split(',');

    const report = await reportingService.generatePerformanceReport(tenantId, filters);

    res.json({
      success: true,
      data: report,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de performance:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/reports/comparison - Relatório de comparação de períodos
router.get('/comparison', [
  query('currentStart').isISO8601().withMessage('Data de início do período atual é obrigatória'),
  query('currentEnd').isISO8601().withMessage('Data de fim do período atual é obrigatória'),
  query('previousStart').isISO8601().withMessage('Data de início do período anterior é obrigatória'),
  query('previousEnd').isISO8601().withMessage('Data de fim do período anterior é obrigatória')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const currentPeriod = {
      startDate: new Date(req.query.currentStart),
      endDate: new Date(req.query.currentEnd)
    };

    const previousPeriod = {
      startDate: new Date(req.query.previousStart),
      endDate: new Date(req.query.previousEnd)
    };

    const report = await reportingService.generateComparisonReport(tenantId, currentPeriod, previousPeriod);

    res.json({
      success: true,
      data: report,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de comparação:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/reports/contacts-analysis - Análise de contatos
router.get('/contacts-analysis', [
  query('startDate').optional().isISO8601().withMessage('Data de início inválida'),
  query('endDate').optional().isISO8601().withMessage('Data de fim inválida'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limite deve ser entre 1 e 1000')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const filters: any = {};
    if (req.query.startDate) filters.startDate = new Date(req.query.startDate);
    if (req.query.endDate) filters.endDate = new Date(req.query.endDate);

    const analysis = await reportingService.generateContactAnalysis(tenantId, filters);

    res.json({
      success: true,
      data: analysis,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Erro ao gerar análise de contatos:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/reports/custom - Gerar relatório personalizado
router.post('/custom', [
  body('name').notEmpty().withMessage('Nome do relatório é obrigatório'),
  body('description').optional().isString(),
  body('metrics').isArray().withMessage('Métricas devem ser um array'),
  body('groupBy').isArray().withMessage('Agrupamento deve ser um array'),
  body('filters').isObject().withMessage('Filtros devem ser um objeto'),
  body('chartType').optional().isIn(['line', 'bar', 'pie', 'area']).withMessage('Tipo de gráfico inválido')
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const reportConfig = {
      ...req.body,
      filters: {
        ...req.body.filters,
        startDate: req.body.filters.startDate ? new Date(req.body.filters.startDate) : undefined,
        endDate: req.body.filters.endDate ? new Date(req.body.filters.endDate) : undefined
      }
    };

    const report = await reportingService.generateCustomReport(tenantId, reportConfig);

    res.json({
      success: true,
      data: report,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Erro ao gerar relatório personalizado:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// POST /api/reports/export - Exportar relatório
router.post('/export', [
  body('data').notEmpty().withMessage('Dados para exportação são obrigatórios'),
  body('format').isIn(['json', 'csv']).withMessage('Formato deve ser json ou csv'),
  body('filename').optional().isString()
], handleValidationErrors, async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;
    const { data, format, filename } = req.body;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const exportedData = await reportingService.exportReport(tenantId, data, format);

    // Configurar headers para download
    const timestamp = new Date().toISOString().split('T')[0];
    const defaultFilename = `relatorio_${timestamp}.${format}`;
    const finalFilename = filename || defaultFilename;

    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${finalFilename}"`);

    res.send(exportedData);

  } catch (error) {
    console.error('Erro ao exportar relatório:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/reports/quick-stats - Estatísticas rápidas para dashboard
router.get('/quick-stats', async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    // Calcular estatísticas dos últimos 30 dias
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const filters = { startDate, endDate };
    const report = await reportingService.generatePerformanceReport(tenantId, filters);

    // Estatísticas rápidas
    const quickStats = {
      totalCampaigns: report.summary.totalCampaigns,
      totalMessages: report.summary.totalMessages,
      successRate: report.summary.successRate,
      deliveryRate: report.summary.deliveryRate,
      readRate: report.summary.readRate,
      activeSessions: report.sessionPerformance.filter(s => s.status === 'connected').length,
      recentCampaigns: report.campaigns.slice(0, 5).map(c => ({
        name: c.campaignName,
        successRate: c.successRate,
        totalContacts: c.totalContacts,
        status: c.status,
        createdAt: c.createdAt
      })),
      dailyTrend: report.timeSeries.slice(-7) // Últimos 7 dias
    };

    res.json({
      success: true,
      data: quickStats,
      period: report.summary.period,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Erro ao gerar estatísticas rápidas:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// GET /api/reports/dashboard - Dados completos para dashboard
router.get('/dashboard', [
  query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Período inválido')
], async (req: any, res: any) => {
  try {
    const { tenantId } = req.user;

    if (!tenantId) {
      return res.status(403).json({ error: 'Acesso negado. Usuário deve estar associado a um tenant.' });
    }

    const period = req.query.period || '30d';
    const endDate = new Date();
    const startDate = new Date();

    // Calcular data de início baseada no período
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    const filters = { startDate, endDate };

    // Gerar relatórios em paralelo
    const [performanceReport, contactAnalysis] = await Promise.all([
      reportingService.generatePerformanceReport(tenantId, filters),
      reportingService.generateContactAnalysis(tenantId, filters)
    ]);

    const dashboardData = {
      summary: performanceReport.summary,
      campaigns: performanceReport.campaigns.slice(0, 10), // Top 10 campanhas
      timeSeries: performanceReport.timeSeries,
      sessionPerformance: performanceReport.sessionPerformance,
      topContacts: contactAnalysis.topResponsiveContacts.slice(0, 10),
      period,
      lastUpdate: new Date()
    };

    res.json({
      success: true,
      data: dashboardData,
      generatedAt: new Date()
    });

  } catch (error) {
    console.error('Erro ao gerar dados do dashboard:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;