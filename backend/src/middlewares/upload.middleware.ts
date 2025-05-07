import multer from 'multer';
import { Request } from 'express';
import storageConfig from '../config/storage';

// Configure multer for memory storage
const storage = multer.memoryStorage();

// Create multer instance with configuration
export const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Enhanced file type validation
    if (!storageConfig.allowedFileTypes.includes(file.mimetype)) {
      // Multer's FileFilterCallback accepts (error: Error | null, acceptFile?: boolean)
      return cb(new Error('File type not allowed'), false);
    }
    cb(null, true);
  },
}).single('file'); // 'file' is the field name expected in the form data 