import { settingsService } from './settingsService';
import { tenantSettingsService } from './tenantSettingsService';

export interface GroqMessage {
  model: string;
  system: string;
  user: string;
}

export interface GroqResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export class GroqService {
  private static instance: GroqService;
  private baseURL = 'https://api.groq.com/openai/v1/chat/completions';

  public static getInstance(): GroqService {
    if (!GroqService.instance) {
      GroqService.instance = new GroqService();
    }
    return GroqService.instance;
  }

  async generateMessage(messageConfig: GroqMessage, contactData: any = {}, tenantId?: string): Promise<GroqResponse> {
    try {
      // Obter chave API das configurações do tenant
      if (!tenantId) {
        return {
          success: false,
          error: 'TenantId é obrigatório para usar Groq.'
        };
      }

      const tenantSettings = await tenantSettingsService.getTenantSettings(tenantId);

      if (!tenantSettings.groqApiKey) {
        return {
          success: false,
          error: 'Groq API Key não configurada para este tenant. Configure a chave nas configurações.'
        };
      }

      // Substituir variáveis no prompt do usuário
      let userPrompt = messageConfig.user;
      const variables = {
        '{{nome}}': contactData.nome || '',
        '{{email}}': contactData.email || '',
        '{{telefone}}': contactData.telefone || '',
        '{{categoria}}': contactData.categoria || '',
        '{{observacoes}}': contactData.observacoes || ''
      };

      // Aplicar substituições de variáveis
      Object.entries(variables).forEach(([variable, value]) => {
        userPrompt = userPrompt.replace(new RegExp(variable, 'g'), value);
      });

      // Preparar mensagens para a API do Groq
      const messages = [
        {
          role: 'system',
          content: messageConfig.system
        },
        {
          role: 'user',
          content: userPrompt
        }
      ];

      console.log('Enviando requisição para Groq:', {
        model: messageConfig.model,
        messages: messages
      });

      // Fazer chamada para a API do Groq
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tenantSettings.groqApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: messageConfig.model,
          messages: messages,
          max_tokens: 1000,
          temperature: 0.5
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro da API Groq:', response.status, errorData);

        let errorMessage = 'Erro ao gerar mensagem com Groq';
        if (response.status === 401) {
          errorMessage = 'API Key da Groq inválida ou não autorizada';
        } else if (response.status === 429) {
          errorMessage = 'Limite de requisições da Groq excedido. Tente novamente mais tarde.';
        } else if (response.status === 400) {
          errorMessage = 'Erro nos parâmetros enviados para a Groq';
        } else {
          errorMessage = `Erro da API Groq: ${response.status}`;
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      const data: any = await response.json();

      if (data && data.choices && data.choices.length > 0) {
        const generatedMessage = data.choices[0].message.content.trim();

        console.log('Resposta gerada pela Groq:', generatedMessage);

        return {
          success: true,
          message: generatedMessage
        };
      } else {
        return {
          success: false,
          error: 'Resposta inválida da Groq'
        };
      }

    } catch (error: any) {
      console.error('Erro ao chamar API da Groq:', error);

      let errorMessage = 'Erro ao gerar mensagem com Groq';

      if (error.name === 'AbortError') {
        errorMessage = 'Timeout na requisição para Groq. Tente novamente.';
      } else if (error.message && error.message.includes('fetch')) {
        errorMessage = 'Erro de conexão com a API da Groq';
      }

      return {
        success: false,
        error: errorMessage
      };
    }
  }

  // Método para validar se a API Key está configurada para um tenant
  async validateApiKey(tenantId: string): Promise<boolean> {
    try {
      const tenantSettings = await tenantSettingsService.getTenantSettings(tenantId);
      return !!tenantSettings.groqApiKey && tenantSettings.groqApiKey.length > 0;
    } catch (error) {
      return false;
    }
  }
}

export const groqService = GroqService.getInstance();