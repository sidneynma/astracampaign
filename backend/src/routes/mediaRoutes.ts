import { Router } from 'express';
import {
  uploadMediaFile,
  listMediaFiles,
  deleteMediaFile
} from '../controllers/mediaController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Todas as rotas de mídia requerem autenticação
router.use(authMiddleware);

// POST /api/media/upload - Upload de arquivo de mídia
router.post('/upload', uploadMediaFile);

// GET /api/media - Listar arquivos de mídia
router.get('/', listMediaFiles);

// DELETE /api/media/:filename - Deletar arquivo de mídia
router.delete('/:filename', deleteMediaFile);

export default router;