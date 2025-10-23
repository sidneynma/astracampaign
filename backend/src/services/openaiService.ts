import { settingsService } from './settingsService';
import { tenantSettingsService } from './tenantSettingsService';

export interface OpenAIMessage {
  model: string;
  system: string;
  user: string;
}

export interface OpenAIResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export class OpenAIService {
  private static instance: OpenAIService;
  private baseURL = 'https://api.openai.com/v1/chat/completions';

  public static getInstance(): OpenAIService {
    if (!OpenAIService.instance) {
      OpenAIService.instance = new OpenAIService();
    }
    return OpenAIService.instance;
  }

  async generateMessage(messageConfig: OpenAIMessage, contactData: any = {}, tenantId?: string): Promise<OpenAIResponse> {
    try {
      // Obter chave API das configurações do tenant
      if (!tenantId) {
        return {
          success: false,
          error: 'TenantId é obrigatório para usar OpenAI.'
        };
      }

      const tenantSettings = await tenantSettingsService.getTenantSettings(tenantId);

      if (!tenantSettings.openaiApiKey) {
        return {
          success: false,
          error: 'OpenAI API Key não configurada para este tenant. Configure a chave nas configurações.'
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

      // Preparar mensagens para a API da OpenAI
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

      console.log('Enviando requisição para OpenAI:', {
        model: messageConfig.model,
        messages: messages
      });

      // Fazer chamada para a API da OpenAI
      const response = await fetch(this.baseURL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tenantSettings.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: messageConfig.model,
          messages: messages,
          max_tokens: 1000,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('Erro da API OpenAI:', response.status, errorData);

        let errorMessage = 'Erro ao gerar mensagem com OpenAI';
        if (response.status === 401) {
          errorMessage = 'API Key da OpenAI inválida ou não autorizada';
        } else if (response.status === 429) {
          errorMessage = 'Limite de requisições da OpenAI excedido. Tente novamente mais tarde.';
        } else if (response.status === 400) {
          errorMessage = 'Erro nos parâmetros enviados para a OpenAI';
        } else {
          errorMessage = `Erro da API OpenAI: ${response.status}`;
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      const data: any = await response.json();

      if (data && data.choices && data.choices.length > 0) {
        const generatedMessage = data.choices[0].message.content.trim();

        console.log('Resposta gerada pela OpenAI:', generatedMessage);

        return {
          success: true,
          message: generatedMessage
        };
      } else {
        return {
          success: false,
          error: 'Resposta inválida da OpenAI'
        };
      }

    } catch (error: any) {
      console.error('Erro ao chamar API da OpenAI:', error);

      let errorMessage = 'Erro ao gerar mensagem com OpenAI';

      if (error.name === 'AbortError') {
        errorMessage = 'Timeout na requisição para OpenAI. Tente novamente.';
      } else if (error.message && error.message.includes('fetch')) {
        errorMessage = 'Erro de conexão com a API da OpenAI';
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
      return !!tenantSettings.openaiApiKey && tenantSettings.openaiApiKey.length > 0;
    } catch (error) {
      return false;
    }
  }
}

export const openaiService = OpenAIService.getInstance();