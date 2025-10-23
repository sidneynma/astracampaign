import { Request, Response } from 'express';
import { getBackupService } from '../services/backupService';
import { AuthenticatedRequest } from '../middleware/auth';

export class BackupController {
  // Listar backups de um tenant (ou todos se SuperAdmin)
  static async listBackups(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📋 BackupController.listBackups - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      const backupService = getBackupService();

      // Se é SuperAdmin, pode listar backups de qualquer tenant
      if (req.user.role === 'SUPERADMIN') {
        const { tenantId } = req.query;

        if (tenantId && typeof tenantId === 'string') {
          const backups = await backupService.listBackups(tenantId);
          return res.json({
            success: true,
            backups: backups.map(backup => ({
              ...backup,
              backupPath: undefined // Não expor path completo
            }))
          });
        } else {
          // Listar estatísticas de todos os tenants
          const stats = await backupService.getBackupStats();
          return res.json({
            success: true,
            stats
          });
        }
      }

      // Usuário normal só pode ver backups do seu tenant
      if (!req.tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      const backups = await backupService.listBackups(req.tenantId);
      res.json({
        success: true,
        backups: backups.map(backup => ({
          ...backup,
          backupPath: undefined // Não expor path completo
        }))
      });

    } catch (error) {
      console.error('❌ BackupController.listBackups - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Criar backup manual
  static async createBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔄 BackupController.createBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      const backupService = getBackupService();

      // Se é SuperAdmin, pode fazer backup de qualquer tenant
      if (req.user.role === 'SUPERADMIN') {
        const { tenantId, all } = req.body;

        if (all) {
          console.log('🔄 Iniciando backup de todos os tenants');
          const results = await backupService.backupAllTenants();

          const successful = results.filter(r => r.status === 'success').length;
          const failed = results.filter(r => r.status === 'failed').length;

          return res.json({
            success: true,
            message: `Backup concluído: ${successful} sucessos, ${failed} falhas`,
            results: results.map(result => ({
              ...result,
              backupPath: undefined
            }))
          });
        } else if (tenantId && typeof tenantId === 'string') {
          const result = await backupService.createBackup(tenantId);
          return res.json({
            success: result.status === 'success',
            message: result.status === 'success' ? 'Backup criado com sucesso' : 'Falha no backup',
            backup: {
              ...result,
              backupPath: undefined
            }
          });
        } else {
          return res.status(400).json({
            success: false,
            message: 'TenantId é obrigatório ou use all: true para backup completo'
          });
        }
      }

      // Usuário normal só pode fazer backup do seu tenant
      if (!req.tenantId) {
        return res.status(400).json({
          success: false,
          message: 'Tenant não identificado'
        });
      }

      const result = await backupService.createBackup(req.tenantId);
      res.json({
        success: result.status === 'success',
        message: result.status === 'success' ? 'Backup criado com sucesso' : 'Falha no backup',
        backup: {
          ...result,
          backupPath: undefined
        }
      });

    } catch (error) {
      console.error('❌ BackupController.createBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Configurar agendamento de backup
  static async scheduleBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📅 BackupController.scheduleBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      const { tenantId, enabled, schedule, retentionDays, storageType } = req.body;

      // Validação básica
      if (!tenantId || typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'TenantId e enabled são obrigatórios'
        });
      }

      // Apenas SuperAdmin pode configurar agendamentos
      if (req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode configurar agendamentos de backup'
        });
      }

      const backupService = getBackupService();

      await backupService.scheduleBackup(tenantId, {
        enabled,
        schedule: schedule || '0 2 * * *', // Default: diariamente às 2h
        retentionDays: retentionDays || 30,
        storageType: storageType || 'local'
      });

      res.json({
        success: true,
        message: enabled
          ? `Backup agendado para tenant ${tenantId}`
          : `Agendamento removido para tenant ${tenantId}`
      });

    } catch (error) {
      console.error('❌ BackupController.scheduleBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // Restaurar backup (apenas SuperAdmin)
  static async restoreBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('⚠️ BackupController.restoreBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      // Apenas SuperAdmin pode restaurar backups
      if (req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode restaurar backups'
        });
      }

      const { tenantId, backupFileName } = req.body;

      if (!tenantId || !backupFileName) {
        return res.status(400).json({
          success: false,
          message: 'TenantId e backupFileName são obrigatórios'
        });
      }

      const backupService = getBackupService();

      // Lista backups para encontrar o caminho completo
      const backups = await backupService.listBackups(tenantId);
      const backup = backups.find(b => b.backupPath.includes(backupFileName));

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup não encontrado'
        });
      }

      await backupService.restoreBackup(tenantId, backup.backupPath);

      res.json({
        success: true,
        message: 'Backup restaurado com sucesso'
      });

    } catch (error) {
      console.error('❌ BackupController.restoreBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro interno do servidor'
      });
    }
  }

  // Obter estatísticas de backup (apenas SuperAdmin)
  static async getBackupStats(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📊 BackupController.getBackupStats - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
      }

      // Apenas SuperAdmin pode ver estatísticas completas
      if (req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode ver estatísticas de backup'
        });
      }

      const backupService = getBackupService();
      const stats = await backupService.getBackupStats();

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('❌ BackupController.getBackupStats - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  // ========== NOVOS MÉTODOS PARA BACKUP GLOBAL DO SISTEMA ==========

  // Criar backup completo do sistema
  static async createSystemBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('🔄 BackupController.createSystemBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode criar backups do sistema'
        });
      }

      const backupService = getBackupService();
      const result = await backupService.createSystemBackup();

      res.json({
        success: true,
        message: 'Backup do sistema criado com sucesso',
        backup: {
          fileName: result.fileName,
          size: result.size,
          createdAt: result.createdAt,
          type: result.type
        }
      });

    } catch (error) {
      console.error('❌ BackupController.createSystemBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao criar backup do sistema'
      });
    }
  }

  // Listar backups do sistema
  static async listSystemBackups(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📋 BackupController.listSystemBackups - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode listar backups do sistema'
        });
      }

      const backupService = getBackupService();
      const backups = await backupService.listSystemBackups();

      res.json({
        success: true,
        backups: backups.map(backup => ({
          fileName: backup.fileName,
          size: backup.size,
          createdAt: backup.createdAt,
          status: backup.status,
          type: backup.type
        }))
      });

    } catch (error) {
      console.error('❌ BackupController.listSystemBackups - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao listar backups do sistema'
      });
    }
  }

  // Restaurar backup do sistema
  static async restoreSystemBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('⚠️ BackupController.restoreSystemBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode restaurar backups do sistema'
        });
      }

      const { fileName } = req.body;

      if (!fileName) {
        return res.status(400).json({
          success: false,
          message: 'Nome do arquivo de backup é obrigatório'
        });
      }

      const backupService = getBackupService();
      const backups = await backupService.listSystemBackups();
      const backup = backups.find(b => b.fileName === fileName);

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup não encontrado'
        });
      }

      await backupService.restoreSystemBackup(backup.backupPath);

      res.json({
        success: true,
        message: 'Backup do sistema restaurado com sucesso. Recomenda-se reiniciar os serviços.'
      });

    } catch (error) {
      console.error('❌ BackupController.restoreSystemBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao restaurar backup do sistema'
      });
    }
  }

  // Configurar backup automático do sistema
  static async configureSystemBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📅 BackupController.configureSystemBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode configurar backup automático'
        });
      }

      const { enabled, schedule, retentionDays } = req.body;

      if (typeof enabled !== 'boolean') {
        return res.status(400).json({
          success: false,
          message: 'O campo enabled é obrigatório'
        });
      }

      const backupService = getBackupService();
      backupService.configureSystemBackup({
        enabled,
        schedule: schedule || '0 2 * * *',
        retentionDays: retentionDays || 30,
        storageType: 'local'
      });

      res.json({
        success: true,
        message: enabled
          ? 'Backup automático do sistema configurado com sucesso'
          : 'Backup automático do sistema desabilitado'
      });

    } catch (error) {
      console.error('❌ BackupController.configureSystemBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao configurar backup automático'
      });
    }
  }

  // Obter configuração atual de backup automático
  static async getSystemBackupConfig(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📋 BackupController.getSystemBackupConfig - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode ver configurações de backup'
        });
      }

      const backupService = getBackupService();
      const config = backupService.getSystemBackupConfig();

      res.json({
        success: true,
        config: config || {
          enabled: false,
          schedule: '0 2 * * *',
          retentionDays: 30,
          storageType: 'local'
        }
      });

    } catch (error) {
      console.error('❌ BackupController.getSystemBackupConfig - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao obter configuração de backup'
      });
    }
  }

  // Download de backup do sistema
  static async downloadSystemBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📥 BackupController.downloadSystemBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode fazer download de backups'
        });
      }

      const { fileName } = req.params;

      if (!fileName) {
        return res.status(400).json({
          success: false,
          message: 'Nome do arquivo de backup é obrigatório'
        });
      }

      const backupService = getBackupService();
      const backups = await backupService.listSystemBackups();
      const backup = backups.find(b => b.fileName === fileName);

      if (!backup) {
        return res.status(404).json({
          success: false,
          message: 'Backup não encontrado'
        });
      }

      res.download(backup.backupPath, fileName);

    } catch (error) {
      console.error('❌ BackupController.downloadSystemBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao fazer download do backup'
      });
    }
  }

  // Upload de backup para restauração
  static async uploadSystemBackup(req: AuthenticatedRequest, res: Response) {
    try {
      console.log('📤 BackupController.uploadSystemBackup - user:', req.user?.email, 'role:', req.user?.role);

      if (!req.user || req.user.role !== 'SUPERADMIN') {
        return res.status(403).json({
          success: false,
          message: 'Apenas SuperAdmin pode fazer upload de backups'
        });
      }

      const file = (req as any).file;

      if (!file) {
        return res.status(400).json({
          success: false,
          message: 'Arquivo de backup não fornecido'
        });
      }

      // Validar extensão
      if (!file.originalname.endsWith('.tar.gz')) {
        return res.status(400).json({
          success: false,
          message: 'Arquivo deve ser um backup válido (.tar.gz)'
        });
      }

      res.json({
        success: true,
        message: 'Backup enviado com sucesso',
        fileName: file.filename
      });

    } catch (error) {
      console.error('❌ BackupController.uploadSystemBackup - erro:', error);
      res.status(500).json({
        success: false,
        message: 'Erro ao fazer upload do backup'
      });
    }
  }
}