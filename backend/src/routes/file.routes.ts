import { Router, Response, NextFunction, Request } from 'express';
import { FileController } from '../controllers/file.controller';
import { upload } from '../middlewares/upload.middleware';
import { authenticate, authRateLimiter } from '../middlewares/auth.middleware';
import { AuthenticatedRequest } from '../types/auth';

const router = Router();
const fileController = new FileController();

// Helper function to safely cast request
const asAuthRequest = (req: Request): AuthenticatedRequest => req as unknown as AuthenticatedRequest;

// File upload endpoint
router.post('/upload', authRateLimiter as any, upload, (req, res, next) => {
  fileController.uploadFile(asAuthRequest(req), res).catch(next);
});

// Create new version
router.post('/:id/versions', authRateLimiter as any, upload, (req, res, next) => {
  fileController.createVersion(asAuthRequest(req), res).catch(next);
});

// Share file
router.post('/:id/share', authRateLimiter as any, (req, res, next) => {
  fileController.shareFile(asAuthRequest(req), res).catch(next);
});

// Update share settings
router.patch('/shares/:shareId', authRateLimiter as any, (req, res, next) => {
  fileController.updateShare(asAuthRequest(req), res).catch(next);
});

// Remove share
router.delete('/shares/:shareId', authRateLimiter as any, (req, res, next) => {
  fileController.removeShare(asAuthRequest(req), res).catch(next);
});

// Update file tags
router.patch('/:id/tags', authRateLimiter as any, (req, res, next) => {
  fileController.updateTags(asAuthRequest(req), res).catch(next);
});

// Search files
router.get('/search', authRateLimiter as any, (req, res, next) => {
  fileController.searchFiles(asAuthRequest(req), res).catch(next);
});

// Get file download URL
router.get('/:key/url', authRateLimiter as any, (req, res, next) => {
  fileController.getFileUrl(asAuthRequest(req), res).catch(next);
});

// Delete file
router.delete('/:key', authRateLimiter as any, (req, res, next) => {
  fileController.deleteFile(asAuthRequest(req), res).catch(next);
});

// List files
router.get('/', authRateLimiter as any, (req, res, next) => {
  fileController.listFiles(asAuthRequest(req), res).catch(next);
});

// File preview endpoint
router.get('/:id/preview', authRateLimiter as any, (req, res, next) => {
  fileController.getFilePreview(asAuthRequest(req), res).catch(next);
});

// Update file category
router.patch('/:id/category', authRateLimiter as any, (req, res, next) => {
  fileController.updateCategory(asAuthRequest(req), res).catch(next);
});

// Batch delete
router.post('/batch-delete', authRateLimiter as any, (req, res, next) => {
  fileController.batchDelete(asAuthRequest(req), res).catch(next);
});

// Batch tag update
router.post('/batch-tag', authRateLimiter as any, (req, res, next) => {
  fileController.batchTag(asAuthRequest(req), res).catch(next);
});

export default router; 