import { PrismaClient } from '@prisma/client';
import { websocketService } from './websocketService';

const prisma = new PrismaClient();

interface MessageTemplate {
  id?: string;
  name: string;
  tenantId: string;
  category: string;
  messageType: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'AUDIO';
  content: string;
  variables: string[]; // Lista de variáveis no template como ['nome', 'empresa']
  mediaUrl?: string;
  active: boolean;
  tags: string[];
  description?: string;
  createdBy: string;
}

interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'contact_field';
  required: boolean;
  defaultValue?: string;
  description?: string;
}

interface ProcessedTemplate {
  content: string;
  mediaUrl?: string;
  variables: { [key: string]: string };
}

export class MessageTemplateService {
  private static instance: MessageTemplateService;

  private constructor() {}

  public static getInstance(): MessageTemplateService {
    if (!MessageTemplateService.instance) {
      MessageTemplateService.instance = new MessageTemplateService();
    }
    return MessageTemplateService.instance;
  }

  // Criar novo template
  public async createTemplate(templateData: MessageTemplate): Promise<any> {
    try {
      // Extrair variáveis do conteúdo (formato {{variavel}})
      const extractedVariables = this.extractVariables(templateData.content);

      const template = await prisma.messageTemplate.create({
        data: {
          name: templateData.name,
          tenantId: templateData.tenantId,
          category: templateData.category,
          messageType: templateData.messageType,
          content: templateData.content,
          variables: extractedVariables,
          mediaUrl: templateData.mediaUrl,
          active: templateData.active,
          tags: templateData.tags,
          description: templateData.description,
          createdBy: templateData.createdBy
        }
      });

      // Notificar usuários do tenant sobre novo template
      await websocketService.notifyTenant(templateData.tenantId, {
        title: 'Novo Template Criado',
        message: `O template "${templateData.name}" foi criado com sucesso.`,
        type: 'SUCCESS',
        data: { templateId: template.id, templateName: template.name }
      });

      console.log(`✅ Template criado: ${template.name} (${template.id})`);
      return template;

    } catch (error) {
      console.error('❌ Erro ao criar template:', error);
      throw error;
    }
  }

  // Listar templates de um tenant
  public async getTemplates(tenantId: string, filters?: {
    category?: string;
    messageType?: string;
    active?: boolean;
    search?: string;
    tags?: string[];
  }): Promise<any[]> {
    try {
      const where: any = { tenantId };

      if (filters?.category) where.category = filters.category;
      if (filters?.messageType) where.messageType = filters.messageType;
      if (filters?.active !== undefined) where.active = filters.active;
      if (filters?.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
          { content: { contains: filters.search, mode: 'insensitive' } }
        ];
      }
      if (filters?.tags && filters.tags.length > 0) {
        where.tags = { hasSome: filters.tags };
      }

      return await prisma.messageTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { name: true, slug: true } },
          creator: { select: { nome: true, email: true } }
        }
      });

    } catch (error) {
      console.error('❌ Erro ao listar templates:', error);
      return [];
    }
  }

  // Obter template por ID
  public async getTemplate(templateId: string, tenantId: string): Promise<any | null> {
    try {
      return await prisma.messageTemplate.findFirst({
        where: { id: templateId, tenantId },
        include: {
          tenant: { select: { name: true, slug: true } },
          creator: { select: { nome: true, email: true } }
        }
      });
    } catch (error) {
      console.error('❌ Erro ao buscar template:', error);
      return null;
    }
  }

  // Atualizar template
  public async updateTemplate(templateId: string, tenantId: string, updateData: Partial<MessageTemplate>): Promise<any> {
    try {
      // Se o conteúdo foi alterado, extrair novas variáveis
      if (updateData.content) {
        updateData.variables = this.extractVariables(updateData.content);
      }

      const template = await prisma.messageTemplate.update({
        where: { id: templateId, tenantId },
        data: updateData as any
      });

      // Notificar usuários do tenant sobre atualização
      await websocketService.notifyTenant(tenantId, {
        title: 'Template Atualizado',
        message: `O template "${template.name}" foi atualizado.`,
        type: 'INFO',
        data: { templateId: template.id, templateName: template.name }
      });

      console.log(`✅ Template atualizado: ${template.name} (${template.id})`);
      return template;

    } catch (error) {
      console.error('❌ Erro ao atualizar template:', error);
      throw error;
    }
  }

  // Excluir template
  public async deleteTemplate(templateId: string, tenantId: string): Promise<boolean> {
    try {
      const template = await prisma.messageTemplate.findFirst({
        where: { id: templateId, tenantId }
      });

      if (!template) {
        throw new Error('Template não encontrado');
      }

      await prisma.messageTemplate.delete({
        where: { id: templateId }
      });

      // Notificar usuários do tenant sobre exclusão
      await websocketService.notifyTenant(tenantId, {
        title: 'Template Excluído',
        message: `O template "${template.name}" foi excluído.`,
        type: 'WARNING',
        data: { templateId, templateName: template.name }
      });

      console.log(`🗑️ Template excluído: ${template.name} (${templateId})`);
      return true;

    } catch (error) {
      console.error('❌ Erro ao excluir template:', error);
      throw error;
    }
  }

  // Processar template com dados de contato
  public async processTemplate(templateId: string, tenantId: string, contactData: any, customVariables?: { [key: string]: string }): Promise<ProcessedTemplate> {
    try {
      const template = await this.getTemplate(templateId, tenantId);

      if (!template) {
        throw new Error('Template não encontrado');
      }

      if (!template.active) {
        throw new Error('Template está inativo');
      }

      // Processar variáveis do template
      let processedContent = template.content;
      const variablesUsed: { [key: string]: string } = {};

      // Substituir variáveis do contato
      if (contactData) {
        processedContent = processedContent.replace(/\{\{(\w+)\}\}/g, (match: string, varName: string) => {
          const contactField = this.getContactField(contactData, varName);
          if (contactField !== null) {
            variablesUsed[varName] = contactField;
            return contactField;
          }
          return match; // Manter original se não encontrou
        });
      }

      // Substituir variáveis customizadas
      if (customVariables) {
        processedContent = processedContent.replace(/\{\{(\w+)\}\}/g, (match: string, varName: string) => {
          if (customVariables[varName] !== undefined) {
            variablesUsed[varName] = customVariables[varName];
            return customVariables[varName];
          }
          return match; // Manter original se não encontrou
        });
      }

      return {
        content: processedContent,
        mediaUrl: template.mediaUrl,
        variables: variablesUsed
      };

    } catch (error) {
      console.error('❌ Erro ao processar template:', error);
      throw error;
    }
  }

  // Duplicar template
  public async duplicateTemplate(templateId: string, tenantId: string, newName: string): Promise<any> {
    try {
      const original = await this.getTemplate(templateId, tenantId);

      if (!original) {
        throw new Error('Template não encontrado');
      }

      const duplicate = await this.createTemplate({
        name: newName,
        tenantId,
        category: original.category,
        messageType: original.messageType,
        content: original.content,
        variables: original.variables,
        mediaUrl: original.mediaUrl,
        active: false, // Criar como inativo por segurança
        tags: [...original.tags],
        description: `Cópia de: ${original.description || original.name}`,
        createdBy: original.createdBy
      });

      console.log(`📋 Template duplicado: ${original.name} -> ${newName}`);
      return duplicate;

    } catch (error) {
      console.error('❌ Erro ao duplicar template:', error);
      throw error;
    }
  }

  // Obter categorias de templates de um tenant
  public async getCategories(tenantId: string): Promise<string[]> {
    try {
      const categories = await prisma.messageTemplate.findMany({
        where: { tenantId },
        select: { category: true },
        distinct: ['category']
      });

      return categories.map(c => c.category).filter(Boolean);

    } catch (error) {
      console.error('❌ Erro ao buscar categorias:', error);
      return [];
    }
  }

  // Validar template antes de salvar
  public validateTemplate(template: Partial<MessageTemplate>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!template.name || template.name.trim().length < 3) {
      errors.push('Nome deve ter pelo menos 3 caracteres');
    }

    if (!template.content || template.content.trim().length < 1) {
      errors.push('Conteúdo não pode estar vazio');
    }

    if (!template.category || template.category.trim().length < 1) {
      errors.push('Categoria é obrigatória');
    }

    if (!['TEXT', 'IMAGE', 'DOCUMENT', 'VIDEO', 'AUDIO'].includes(template.messageType || '')) {
      errors.push('Tipo de mensagem inválido');
    }

    // Validar variáveis no conteúdo
    const variables = this.extractVariables(template.content || '');
    if (variables.length > 10) {
      errors.push('Máximo de 10 variáveis permitidas por template');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // Extrair variáveis do conteúdo do template
  private extractVariables(content: string): string[] {
    const regex = /\{\{(\w+)\}\}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  // Buscar campo do contato
  private getContactField(contactData: any, fieldName: string): string | null {
    const fieldMap: { [key: string]: string } = {
      'nome': contactData.nome,
      'telefone': contactData.telefone,
      'email': contactData.email,
      'observacoes': contactData.observacoes
    };

    return fieldMap[fieldName] || null;
  }

  // Obter estatísticas de templates
  public async getTemplateStats(tenantId: string): Promise<any> {
    try {
      const [total, active, byCategory, byType] = await Promise.all([
        prisma.messageTemplate.count({ where: { tenantId } }),
        prisma.messageTemplate.count({ where: { tenantId, active: true } }),
        prisma.messageTemplate.groupBy({
          by: ['category'],
          where: { tenantId },
          _count: true
        }),
        prisma.messageTemplate.groupBy({
          by: ['messageType'],
          where: { tenantId },
          _count: true
        })
      ]);

      return {
        total,
        active,
        inactive: total - active,
        byCategory: byCategory.reduce((acc, item) => {
          acc[item.category] = item._count;
          return acc;
        }, {} as { [key: string]: number }),
        byType: byType.reduce((acc, item) => {
          acc[item.messageType] = item._count;
          return acc;
        }, {} as { [key: string]: number })
      };

    } catch (error) {
      console.error('❌ Erro ao obter estatísticas de templates:', error);
      return { total: 0, active: 0, inactive: 0, byCategory: {}, byType: {} };
    }
  }
}

export const messageTemplateService = MessageTemplateService.getInstance();