import { Router } from 'express';
import aiRouter from './ai.routes';

const router = Router();

// Register AI Agent backend endpoints
router.use('/ai', aiRouter);

export default router; 