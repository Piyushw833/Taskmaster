import { Router, Request, RequestHandler } from 'express';
import { FileController } from '../controllers/file.controller';
import { upload } from '../middlewares/upload.middleware';
import { authRateLimiter } from '../middlewares/auth.middleware';
import { AuthenticatedRequest } from '../types/auth';

const router = Router();
const fileController = new FileController();
const authRateLimiterMiddleware = authRateLimiter as RequestHandler;

// Helper function to safely cast request
const asAuthRequest = (req: Request): AuthenticatedRequest => req as unknown as AuthenticatedRequest;

// File upload endpoint
router.post('/upload', authRateLimiterMiddleware, upload, (req, res, next) => {
  fileController.uploadFile(asAuthRequest(req), res).catch(next);
});

// Create new version
router.post('/:id/versions', authRateLimiterMiddleware, upload, (req, res, next) => {
  fileController.createVersion(asAuthRequest(req), res).catch(next);
});

// Share file
router.post('/:id/share', authRateLimiterMiddleware, (req, res, next) => {
  fileController.shareFile(asAuthRequest(req), res).catch(next);
});

// Update share settings
router.patch('/shares/:shareId', authRateLimiterMiddleware, (req, res, next) => {
  fileController.updateShare(asAuthRequest(req), res).catch(next);
});

// Remove share
router.delete('/shares/:shareId', authRateLimiterMiddleware, (req, res, next) => {
  fileController.removeShare(asAuthRequest(req), res).catch(next);
});

// Update file tags
router.patch('/:id/tags', authRateLimiterMiddleware, (req, res, next) => {
  fileController.updateTags(asAuthRequest(req), res).catch(next);
});

// Search files
router.get('/search', authRateLimiterMiddleware, (req, res, next) => {
  fileController.searchFiles(asAuthRequest(req), res).catch(next);
});

// Get file download URL
router.get('/:key/url', authRateLimiterMiddleware, (req, res, next) => {
  fileController.getFileUrl(asAuthRequest(req), res).catch(next);
});

// Delete file
router.delete('/:key', authRateLimiterMiddleware, (req, res, next) => {
  fileController.deleteFile(asAuthRequest(req), res).catch(next);
});

// List files
router.get('/', authRateLimiterMiddleware, (req, res, next) => {
  fileController.listFiles(asAuthRequest(req), res).catch(next);
});

// File preview endpoint
router.get('/:id/preview', authRateLimiterMiddleware, (req, res, next) => {
  fileController.getFilePreview(asAuthRequest(req), res).catch(next);
});

// Update file category
router.patch('/:id/category', authRateLimiterMiddleware, (req, res, next) => {
  fileController.updateCategory(asAuthRequest(req), res).catch(next);
});

// Batch delete
router.post('/batch-delete', authRateLimiterMiddleware, (req, res, next) => {
  fileController.batchDelete(asAuthRequest(req), res).catch(next);
});

// Batch tag update
router.post('/batch-tag', authRateLimiterMiddleware, (req, res, next) => {
  fileController.batchTag(asAuthRequest(req), res).catch(next);
});

export default router; 