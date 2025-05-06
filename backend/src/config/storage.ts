import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';
import { ObjectCannedACL } from '@aws-sdk/client-s3';

export interface StorageConfig {
  region: string;
  bucket: string;
  encryption: {
    enabled: boolean;
    kmsKeyId?: string;
  };
  acl: ObjectCannedACL;
  maxFileSize: number; // in bytes
  allowedFileTypes: string[];
  urlExpirationTime: number; // in seconds
}

const storageConfig: StorageConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  bucket: process.env.AWS_BUCKET_NAME || 'oculis-files',
  encryption: {
    enabled: true,
    kmsKeyId: process.env.AWS_KMS_KEY_ID,
  },
  acl: 'private' as ObjectCannedACL,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  allowedFileTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'video/mp4',
    'model/gltf-binary', // For 3D models
    'model/gltf+json',   // For 3D models
    'application/octet-stream', // For other 3D model formats
  ],
  urlExpirationTime: 3600, // 1 hour
};

const s3Config: S3ClientConfig = {
  region: storageConfig.region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

export const s3Client = new S3Client(s3Config);
export default storageConfig; 