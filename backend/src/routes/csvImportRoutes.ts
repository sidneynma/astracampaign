import { Router } from 'express';
import { CSVImportController, upload } from '../controllers/csvImportController';

const router = Router();

// Rota para importar contatos via CSV
router.post('/import', upload.single('csv'), CSVImportController.importContacts);

// Rota para baixar template CSV
router.get('/template', CSVImportController.downloadTemplate);

export { router as csvImportRoutes };