import { Response } from 'express';
import { CategoryService } from '../services/categoryService';
import { CategoryInput } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

export class CategoryController {
  static async getCategories(req: AuthenticatedRequest, res: Response) {
    try {
      const { search, page = '1', pageSize = '10' } = req.query;

      // Sempre usar tenantId do token
      const tenantId = req.tenantId;

      const result = await CategoryService.getCategories(
        search as string,
        parseInt(page as string),
        parseInt(pageSize as string),
        tenantId
      );

      res.json(result);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  static async getAllCategories(req: AuthenticatedRequest, res: Response) {
    try {
      const tenantId = req.tenantId;
      const categories = await CategoryService.getAllCategories(tenantId);
      res.json(categories);
    } catch (error) {
      console.error('Erro ao buscar todas as categorias:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  static async getCategoryById(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;
      const category = await CategoryService.getCategoryById(id, tenantId);
      res.json(category);
    } catch (error) {
      if (error instanceof Error && error.message === 'Categoria não encontrada') {
        res.status(404).json({ error: error.message });
      } else {
        console.error('Erro ao buscar categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  }

  static async createCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const categoryData: CategoryInput = req.body;

      if (!categoryData.nome || !categoryData.cor) {
        return res.status(400).json({ error: 'Nome e cor são obrigatórios' });
      }

      const tenantId = req.tenantId;

      const newCategory = await CategoryService.createCategory(categoryData, tenantId);
      res.status(201).json(newCategory);
    } catch (error) {
      console.error('Erro ao criar categoria:', error);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }

  static async updateCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const categoryData: CategoryInput = req.body;

      if (!categoryData.nome || !categoryData.cor) {
        return res.status(400).json({ error: 'Nome e cor são obrigatórios' });
      }

      const tenantId = req.tenantId;

      const updatedCategory = await CategoryService.updateCategory(id, categoryData, tenantId);
      res.json(updatedCategory);
    } catch (error) {
      if (error instanceof Error && error.message === 'Categoria não encontrada') {
        res.status(404).json({ error: error.message });
      } else {
        console.error('Erro ao atualizar categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  }

  static async deleteCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId;

      await CategoryService.deleteCategory(id, tenantId);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error && error.message === 'Categoria não encontrada') {
        res.status(404).json({ error: error.message });
      } else {
        console.error('Erro ao deletar categoria:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
      }
    }
  }
}