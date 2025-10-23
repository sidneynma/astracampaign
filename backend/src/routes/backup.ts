import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { BackupController } from '../controllers/backupController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Configurar multer para upload de backups
const backupStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/app/backups');
  },
  filename: (req, file, cb) => {
    // Manter o nome original do arquivo
    cb(null, file.originalname);
  }
});

const uploadBackup = multer({
  storage: backupStorage,
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.originalname.endsWith('.tar.gz')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .tar.gz são permitidos'));
    }
  }
});

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// GET /api/backup - Listar backups (usuário vê apenas do seu tenant, SuperAdmin vê stats se sem tenantId)
router.get('/', BackupController.listBackups);

// POST /api/backup - Criar backup manual
router.post('/', BackupController.createBackup);

// POST /api/backup/schedule - Configurar agendamento (apenas SuperAdmin)
router.post('/schedule', BackupController.scheduleBackup);

// POST /api/backup/restore - Restaurar backup (apenas SuperAdmin)
router.post('/restore', BackupController.restoreBackup);

// GET /api/backup/stats - Estatísticas completas (apenas SuperAdmin)
router.get('/stats', BackupController.getBackupStats);

// ========== ROTAS PARA BACKUP GLOBAL DO SISTEMA ==========

// POST /api/backup/system - Criar backup completo do sistema (apenas SuperAdmin)
router.post('/system', BackupController.createSystemBackup);

// GET /api/backup/system - Listar backups do sistema (apenas SuperAdmin)
router.get('/system', BackupController.listSystemBackups);

// POST /api/backup/system/restore - Restaurar backup do sistema (apenas SuperAdmin)
router.post('/system/restore', BackupController.restoreSystemBackup);

// POST /api/backup/system/configure - Configurar backup automático (apenas SuperAdmin)
router.post('/system/configure', BackupController.configureSystemBackup);

// GET /api/backup/system/config - Obter configuração de backup automático (apenas SuperAdmin)
router.get('/system/config', BackupController.getSystemBackupConfig);

// GET /api/backup/system/download/:fileName - Download de backup do sistema (apenas SuperAdmin)
router.get('/system/download/:fileName', BackupController.downloadSystemBackup);

// POST /api/backup/system/upload - Upload de backup para restauração (apenas SuperAdmin)
router.post('/system/upload', uploadBackup.single('backup'), BackupController.uploadSystemBackup);

export default router;