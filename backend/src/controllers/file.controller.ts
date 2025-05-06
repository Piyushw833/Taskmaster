import { Response } from 'express';
import { StorageService, SharePermission } from '../services/storage.service';
import { Readable } from 'stream';
import { AuthenticatedRequest } from '../types/auth';
import sharp from 'sharp';

const storageService = new StorageService();

export class FileController {
  /**
   * Upload a file
   * POST /api/files/upload
   */
  async uploadFile(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const file = req.file.buffer || Readable.from(req.file.stream);
      const result = await storageService.uploadFile(
        file,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        req.user.id
      );

      res.status(201).json(result);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }

  /**
   * Create a new version of a file
   * POST /api/files/:id/versions
   */
  async createVersion(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const file = req.file.buffer || Readable.from(req.file.stream);
      const result = await storageService.createNewVersion(
        req.params.id,
        file,
        req.user.id,
        req.body.changeDescription
      );

      res.status(201).json(result);
    } catch (error) {
      console.error('Error creating file version:', error);
      res.status(500).json({ error: 'Failed to create file version' });
    }
  }

  /**
   * Share a file with another user
   * POST /api/files/:id/share
   */
  async shareFile(req: AuthenticatedRequest, res: Response) {
    try {
      const { userId, permission, expiresAt } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: 'User ID is required' });
      }

      const result = await storageService.shareFile(
        req.params.id,
        req.user.id,
        userId,
        permission as SharePermission,
        expiresAt ? new Date(expiresAt) : undefined
      );

      res.status(201).json(result);
    } catch (error) {
      console.error('Error sharing file:', error);
      res.status(500).json({ error: 'Failed to share file' });
    }
  }

  /**
   * Update file share settings
   * PATCH /api/files/shares/:shareId
   */
  async updateShare(req: AuthenticatedRequest, res: Response) {
    try {
      const { permission, expiresAt } = req.body;
      
      const result = await storageService.updateFileShare(
        req.params.shareId,
        req.user.id,
        {
          permission: permission as SharePermission,
          expiresAt: expiresAt ? new Date(expiresAt) : undefined,
        }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error updating share:', error);
      res.status(500).json({ error: 'Failed to update share settings' });
    }
  }

  /**
   * Remove file share
   * DELETE /api/files/shares/:shareId
   */
  async removeShare(req: AuthenticatedRequest, res: Response) {
    try {
      await storageService.removeFileShare(req.params.shareId, req.user.id);
      res.status(204).send();
    } catch (error) {
      console.error('Error removing share:', error);
      res.status(500).json({ error: 'Failed to remove share' });
    }
  }

  /**
   * Update file tags
   * PATCH /api/files/:id/tags
   */
  async updateTags(req: AuthenticatedRequest, res: Response) {
    try {
      const { tags } = req.body;
      
      if (!tags || typeof tags !== 'object') {
        return res.status(400).json({ error: 'Tags must be an object' });
      }

      const result = await storageService.updateFileTags(
        req.params.id,
        req.user.id,
        tags
      );

      res.status(200).json(result);
    } catch (error) {
      console.error('Error updating tags:', error);
      res.status(500).json({ error: 'Failed to update tags' });
    }
  }

  /**
   * Search files
   * GET /api/files/search
   */
  async searchFiles(req: AuthenticatedRequest, res: Response) {
    try {
      const { name, mimeType, tags, status, sharedWithMe } = req.query;
      
      const result = await storageService.searchFiles(req.user.id, {
        name: name as string,
        mimeType: mimeType as string,
        tags: tags ? JSON.parse(tags as string) : undefined,
        status: status as any,
        sharedWithMe: sharedWithMe === 'true',
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Error searching files:', error);
      res.status(500).json({ error: 'Failed to search files' });
    }
  }

  /**
   * Get file download URL
   * GET /api/files/:key/url
   */
  async getFileUrl(req: AuthenticatedRequest, res: Response) {
    try {
      const url = await storageService.getFileUrl(req.params.key);
      res.status(200).json({ url });
    } catch (error) {
      console.error('Error getting file URL:', error);
      res.status(500).json({ error: 'Failed to get file URL' });
    }
  }

  /**
   * Delete file
   * DELETE /api/files/:key
   */
  async deleteFile(req: AuthenticatedRequest, res: Response) {
    try {
      await storageService.deleteFile(req.params.key);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ error: 'Failed to delete file' });
    }
  }

  /**
   * List files
   * GET /api/files
   */
  async listFiles(req: AuthenticatedRequest, res: Response) {
    try {
      const files = await storageService.listFiles();
      res.status(200).json(files);
    } catch (error) {
      console.error('Error listing files:', error);
      res.status(500).json({ error: 'Failed to list files' });
    }
  }

  /**
   * Get file preview (image thumbnail or PDF first page)
   * GET /api/files/:id/preview
   */
  async getFilePreview(req: AuthenticatedRequest, res: Response) {
    try {
      const file = await storageService.getFileById(req.params.id);
      if (!file) return res.status(404).json({ error: 'File not found' });
      if (file.mimeType.startsWith('image/')) {
        // Generate thumbnail for image
        const buffer = await storageService.getFileBuffer(file.key);
        const thumbnail = await sharp(buffer).resize(200, 200, { fit: 'inside' }).toBuffer();
        res.set('Content-Type', 'image/png');
        return res.send(thumbnail);
      } else if (file.mimeType === 'application/pdf') {
        // TODO: Implement PDF preview (first page as image)
        return res.status(501).json({ error: 'PDF preview not implemented yet' });
      } else {
        return res.status(415).json({ error: 'Preview not supported for this file type' });
      }
    } catch (error) {
      console.error('Error generating preview:', error);
      res.status(500).json({ error: 'Failed to generate preview' });
    }
  }

  /**
   * Update file category
   * PATCH /api/files/:id/category
   */
  async updateCategory(req: AuthenticatedRequest, res: Response) {
    try {
      const { category } = req.body;
      if (!category || typeof category !== 'string') {
        return res.status(400).json({ error: 'Category must be a string' });
      }
      const updated = await storageService.updateFileCategory(req.params.id, req.user.id, category);
      res.status(200).json(updated);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  }

  /**
   * Batch delete files
   * POST /api/files/batch-delete
   */
  async batchDelete(req: AuthenticatedRequest, res: Response) {
    try {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: 'fileIds must be a non-empty array' });
      }
      const result = await storageService.batchDeleteFiles(fileIds, req.user.id);
      res.status(200).json(result);
    } catch (error) {
      console.error('Error batch deleting files:', error);
      res.status(500).json({ error: 'Failed to batch delete files' });
    }
  }

  /**
   * Batch update tags
   * POST /api/files/batch-tag
   */
  async batchTag(req: AuthenticatedRequest, res: Response) {
    try {
      const { fileIds, tags } = req.body;
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        return res.status(400).json({ error: 'fileIds must be a non-empty array' });
      }
      if (!tags || typeof tags !== 'object') {
        return res.status(400).json({ error: 'tags must be an object' });
      }
      const result = await storageService.batchUpdateTags(fileIds, req.user.id, tags);
      res.status(200).json(result);
    } catch (error) {
      console.error('Error batch updating tags:', error);
      res.status(500).json({ error: 'Failed to batch update tags' });
    }
  }
} 