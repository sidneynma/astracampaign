import { Router } from 'express';
import { WahaSyncService } from '../services/wahaSyncService';
import { WhatsAppSessionService } from '../services/whatsappSessionService';

const fetch = require('node-fetch');

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || 'https://waha.trecofantastico.com.br';
const WAHA_API_KEY = process.env.WAHA_API_KEY || '7cf698ac74c6bc3cb3fe34a3131a3927';

const wahaRequest = async (endpoint: string, options: any = {}) => {
  const url = `${WAHA_BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': WAHA_API_KEY,
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`WAHA API Error: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
};

const router = Router();

// Listar todas as sessões sincronizadas com WAHA API
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await WahaSyncService.syncAllSessions();
    res.json(sessions);
  } catch (error) {
    console.error('Erro ao listar sessões:', error);
    res.status(500).json({ error: 'Erro ao listar sessões WhatsApp' });
  }
});

// Obter informações de uma sessão específica
router.get('/sessions/:sessionName', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const session = await WahaSyncService.syncSession(sessionName);
    res.json(session);
  } catch (error) {
    console.error('Erro ao obter sessão:', error);
    res.status(500).json({ error: 'Erro ao obter informações da sessão' });
  }
});

// Criar nova sessão
router.post('/sessions', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nome da sessão é obrigatório' });
    }

    const result = await WahaSyncService.createSession(name);
    res.json(result);
  } catch (error) {
    console.error('Erro ao criar sessão:', error);
    res.status(500).json({ error: 'Erro ao criar sessão WhatsApp' });
  }
});

// Iniciar sessão
router.post('/sessions/:sessionName/start', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const result = await WahaSyncService.startSession(sessionName);
    res.json(result);
  } catch (error) {
    console.error('Erro ao iniciar sessão:', error);
    res.status(500).json({ error: 'Erro ao iniciar sessão WhatsApp' });
  }
});

// Parar sessão
router.post('/sessions/:sessionName/stop', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const result = await WahaSyncService.stopSession(sessionName);
    res.json(result);
  } catch (error) {
    console.error('Erro ao parar sessão:', error);
    res.status(500).json({ error: 'Erro ao parar sessão WhatsApp' });
  }
});

// Reiniciar sessão
router.post('/sessions/:sessionName/restart', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const result = await WahaSyncService.restartSession(sessionName);
    res.json(result);
  } catch (error) {
    console.error('Erro ao reiniciar sessão:', error);
    res.status(500).json({ error: 'Erro ao reiniciar sessão WhatsApp' });
  }
});

// Deletar sessão
router.delete('/sessions/:sessionName', async (req, res) => {
  try {
    const { sessionName } = req.params;
    await WahaSyncService.deleteSession(sessionName);
    res.json({ success: true, message: 'Sessão removida com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar sessão:', error);
    res.status(500).json({ error: 'Erro ao remover sessão WhatsApp' });
  }
});

// Obter QR Code da sessão
router.get('/sessions/:sessionName/auth/qr', async (req, res) => {
  try {
    const { sessionName } = req.params;

    // QR code agora disponível para todas as sessões

    // Por enquanto, retornar um QR code mockado para demonstração
    // Em uma implementação real, você precisaria verificar a documentação da WAHA
    // para o endpoint correto de QR code

    // QR code simples 200x200 em base64 (branco com pontos pretos - padrão QR)
    const mockQrBase64 = "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"; // Um QR code demo válido

    res.json({
      qr: mockQrBase64,
      expiresAt: new Date(Date.now() + 60000) // 60 segundos
    });
  } catch (error) {
    console.error('Erro ao obter QR Code:', error);
    res.status(500).json({ error: 'Erro ao obter QR Code' });
  }
});

// Obter status da sessão
router.get('/sessions/:sessionName/status', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const status = await wahaRequest(`/api/sessions/${sessionName}/status`);
    res.json(status);
  } catch (error) {
    console.error('Erro ao obter status:', error);
    res.status(500).json({ error: 'Erro ao obter status da sessão' });
  }
});

// Obter informações "me" da sessão
router.get('/sessions/:sessionName/me', async (req, res) => {
  try {
    const { sessionName } = req.params;
    const me = await wahaRequest(`/api/sessions/${sessionName}/me`);
    res.json(me);
  } catch (error) {
    console.error('Erro ao obter informações do usuário:', error);
    res.status(500).json({ error: 'Erro ao obter informações do usuário' });
  }
});

export default router;