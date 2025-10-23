import { Router } from 'express';
import { CategoryController } from '../controllers/categoryController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Apply authentication middleware to all category routes
router.use(authMiddleware);

router.get('/', CategoryController.getCategories);
router.get('/all', CategoryController.getAllCategories);
router.get('/:id', CategoryController.getCategoryById);
router.post('/', CategoryController.createCategory);
router.put('/:id', CategoryController.updateCategory);
router.delete('/:id', CategoryController.deleteCategory);

export { router as categoryRoutes };