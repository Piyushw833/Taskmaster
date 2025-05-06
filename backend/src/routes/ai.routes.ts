import { Router } from 'express';
import { aiValuation, aiDocumentParse, aiRoiCalculator } from '../controllers/ai.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// All routes require authentication
router.use(authenticate);

// POST /api/v1/valuation
router.post('/valuation', aiValuation);

// POST /api/v1/document-parse
router.post('/document-parse', aiDocumentParse);

// POST /api/v1/roi-calculator
router.post('/roi-calculator', aiRoiCalculator);

export default router; 