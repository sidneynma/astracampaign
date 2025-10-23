import { Router } from 'express';
import {
  getSettings,
  getPublicSettings,
  updateSettings,
  uploadLogo,
  removeLogo,
  uploadFavicon,
  removeFavicon,
  uploadIcon,
  removeIcon,
  settingsValidation
} from '../controllers/settingsController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// GET /api/settings/public - Buscar configurações públicas (sem auth)
router.get('/public', getPublicSettings);

// GET /api/settings - Buscar configurações (protegida)
router.get('/', authMiddleware, getSettings);

// PUT /api/settings - Atualizar configurações (protegida)
router.put('/', authMiddleware, settingsValidation, updateSettings);

// POST /api/settings/logo - Upload de logo (protegida)
router.post('/logo', authMiddleware, uploadLogo);

// DELETE /api/settings/logo - Remover logo (protegida)
router.delete('/logo', authMiddleware, removeLogo);

// POST /api/settings/favicon - Upload de favicon (protegida)
router.post('/favicon', authMiddleware, uploadFavicon);

// DELETE /api/settings/favicon - Remover favicon (protegida)
router.delete('/favicon', authMiddleware, removeFavicon);

// POST /api/settings/icon - Upload de ícone geral (protegida)
router.post('/icon', authMiddleware, uploadIcon);

// DELETE /api/settings/icon - Remover ícone geral (protegida)
router.delete('/icon', authMiddleware, removeIcon);

export default router;