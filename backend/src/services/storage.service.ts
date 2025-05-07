import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ObjectCannedACL,
  ServerSideEncryption,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { s3Client, default as storageConfig } from '../config/storage';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import { PrismaClient, FileStatus, ScanStatus, Prisma, File as PrismaFile, FileVersion as PrismaFileVersion, FileShare as PrismaFileShare, SharePermission } from '@prisma/client';
import { scanFile, ScanResult } from '../utils/fileScanner';

const prisma = new PrismaClient();

export interface FileMetadata {
  id: string;
  key: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedBy: string;
  uploadedAt: Date;
  lastAccessed?: Date;
  tags?: Record<string, string>;
  status: FileStatus;
  scanStatus: ScanStatus;
  scanResult?: ScanResult;
  currentVersion?: number;
  versions?: FileVersionMetadata[];
  sharedWith?: FileShareInfo[];
}

export interface FileVersionMetadata {
  id: string;
  key: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  versionNumber: number;
  changeDescription?: string;
  scanStatus: ScanStatus;
  scanResult?: ScanResult;
}

export interface FileShareInfo {
  id: string;
  userId: string;
  sharedById: string;
  permission: SharePermission;
  sharedAt: Date;
  expiresAt?: Date;
}

export class StorageService {
  private validateFileType(mimeType: string): void {
    if (!storageConfig.allowedFileTypes.includes(mimeType)) {
      throw new Error(`File type ${mimeType} is not allowed`);
    }
  }

  private validateFileSize(size: number): void {
    if (size > storageConfig.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${storageConfig.maxFileSize} bytes`);
    }
  }

  private generateFileKey(originalName: string, userId: string): string {
    const timestamp = Date.now();
    const hash = createHash('md5').update(`${originalName}${timestamp}${userId}`).digest('hex');
    return `${userId}/${hash}-${originalName}`;
  }

  async uploadFile(
    file: Buffer | Readable,
    fileName: string,
    mimeType: string,
    size: number,
    userId: string,
  ): Promise<FileMetadata> {
    this.validateFileType(mimeType);
    this.validateFileSize(size);

    const key = this.generateFileKey(fileName, userId);
    const uploadParams = {
      Bucket: storageConfig.bucket,
      Key: key,
      Body: file,
      ContentType: mimeType,
      ServerSideEncryption: storageConfig.encryption.enabled ? ServerSideEncryption.aws_kms : undefined,
      SSEKMSKeyId: storageConfig.encryption.enabled ? storageConfig.encryption.kmsKeyId : undefined,
      ACL: storageConfig.acl as ObjectCannedACL,
      Metadata: {
        uploadedBy: userId,
        originalName: fileName,
      },
    };

    // Upload to S3
    await s3Client.send(new PutObjectCommand(uploadParams));

    // Scan file for viruses/malware
    const scanResult = await scanFile(file, fileName);

    // Store metadata in database
    const fileData = await prisma.file.create({
      data: {
        key,
        name: fileName,
        size,
        mimeType,
        userId,
        tags: {
          fileType: scanResult.details?.fileType || mimeType,
          scanSignature: scanResult.details?.signature || 'Unknown',
          scanDuration: scanResult.details?.scanDuration?.toString() || '0'
        },
        scanStatus: scanResult.isClean ? ScanStatus.CLEAN : ScanStatus.INFECTED,
        scanResult: {
          isClean: scanResult.isClean,
          threat: scanResult.threat,
          error: scanResult.error,
          details: scanResult.details
        } as Prisma.InputJsonValue,
        status: scanResult.isClean ? FileStatus.ACTIVE : FileStatus.QUARANTINED,
      },
    });

    // If file is infected, delete it from S3
    if (!scanResult.isClean) {
      await s3Client.send(
        new DeleteObjectCommand({
          Bucket: storageConfig.bucket,
          Key: key,
        })
      );
      
      throw new Error(
        `File scan failed: ${scanResult.threat || scanResult.error || 'Unknown threat detected'}`
      );
    }

    return this.mapFileToMetadata(fileData);
  }

  async getFileUrl(key: string): Promise<string> {
    // Get file metadata from database
    const file = await prisma.file.findUnique({
      where: { key },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.status === FileStatus.DELETED) {
      throw new Error('File has been deleted');
    }

    if (file.scanStatus === ScanStatus.INFECTED) {
      throw new Error('File is infected and cannot be downloaded');
    }

    // Update last accessed time
    await prisma.file.update({
      where: { key },
      data: { lastAccessed: new Date() },
    });

    const command = new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
    });

    return getSignedUrl(s3Client, command, {
      expiresIn: storageConfig.urlExpirationTime,
    });
  }

  async deleteFile(key: string): Promise<void> {
    // Mark as deleted in database
    await prisma.file.update({
      where: { key },
      data: { status: FileStatus.DELETED },
    });

    // Delete from S3
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: storageConfig.bucket,
        Key: key,
      })
    );
  }

  async listFiles(userId?: string): Promise<FileMetadata[]> {
    const files = await prisma.file.findMany({
      where: userId ? { userId } : undefined,
      orderBy: { updatedAt: 'desc' },
    });

    return files.map((file) => this.mapFileToMetadata(file));
  }

  async createNewVersion(
    fileId: string,
    file: Buffer | Readable,
    userId: string,
    changeDescription?: string
  ): Promise<FileMetadata> {
    const existingFile = await prisma.file.findUnique({
      where: { id: fileId },
    });
    if (!existingFile) {
      throw new Error('File not found');
    }
    // Remove currentVersion logic, just append timestamp to key
    const versionKey = `${existingFile.key}_v${Date.now()}`;
    // Upload new version to S3
    const uploadParams = {
      Bucket: storageConfig.bucket,
      Key: versionKey,
      Body: file,
      ContentType: existingFile.mimeType,
      ServerSideEncryption: storageConfig.encryption.enabled ? ServerSideEncryption.aws_kms : undefined,
      SSEKMSKeyId: storageConfig.encryption.enabled ? storageConfig.encryption.kmsKeyId : undefined,
      ACL: storageConfig.acl as ObjectCannedACL,
    };
    await s3Client.send(new PutObjectCommand(uploadParams));
    // Scan new version
    const scanResult = await scanFile(file, existingFile.name);
    // Create version record
    await prisma.fileVersion.create({
      data: {
        fileId,
        key: versionKey,
        size: existingFile.size,
        userId,
        versionNumber: 1, // Always 1 for this example, or increment if you add logic
        changeDescription,
        scanStatus: scanResult.isClean ? ScanStatus.CLEAN : ScanStatus.INFECTED,
        scanResult: scanResult as unknown as Prisma.InputJsonValue,
      },
    });
    // Return the latest file metadata
    const updatedFile = await prisma.file.findUnique({ where: { id: fileId }, include: { versions: true, sharedWith: true } });
    if (!updatedFile) {
      throw new Error('File not found after creating new version');
    }
    return this.mapFileToMetadata(updatedFile);
  }

  async shareFile(
    fileId: string,
    sharedByUserId: string,
    sharedWithUserId: string,
    permission: SharePermission = SharePermission.VIEW,
    expiresAt?: Date
  ): Promise<FileShareInfo> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: { versions: true, sharedWith: true },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.userId !== sharedByUserId) {
      throw new Error('Only file owner can share the file');
    }

    const share = await prisma.fileShare.create({
      data: {
        fileId,
        userId: sharedWithUserId,
        sharedById: sharedByUserId,
        permission,
        expiresAt,
      },
    });

    return {
      id: share.id,
      userId: share.userId,
      sharedById: share.sharedById,
      permission: share.permission,
      sharedAt: share.sharedAt,
      expiresAt: share.expiresAt ?? undefined,
    };
  }

  async updateFileShare(
    shareId: string,
    userId: string,
    updates: {
      permission?: SharePermission;
      expiresAt?: Date | null;
    }
  ): Promise<FileShareInfo> {
    const share = await prisma.fileShare.findUnique({
      where: { id: shareId },
      include: { file: true },
    });

    if (!share) {
      throw new Error('Share not found');
    }

    if (!share.file || share.file.userId !== userId) {
      throw new Error('Only file owner can update share settings');
    }

    const updatedShare = await prisma.fileShare.update({
      where: { id: shareId },
      data: updates,
    });

    return {
      id: updatedShare.id,
      userId: updatedShare.userId,
      sharedById: updatedShare.sharedById,
      permission: updatedShare.permission,
      sharedAt: updatedShare.sharedAt,
      expiresAt: updatedShare.expiresAt ?? undefined,
    };
  }

  async removeFileShare(shareId: string, userId: string): Promise<void> {
    const share = await prisma.fileShare.findUnique({
      where: { id: shareId },
      include: { file: true },
    });

    if (!share) {
      throw new Error('Share not found');
    }

    if (!share.file || share.file.userId !== userId) {
      throw new Error('Only file owner can remove share');
    }

    await prisma.fileShare.delete({
      where: { id: shareId },
    });
  }

  async updateFileTags(
    fileId: string,
    userId: string,
    tags: Record<string, string>
  ): Promise<FileMetadata> {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new Error('File not found');
    }

    if (file.userId !== userId) {
      throw new Error('Only file owner can update tags');
    }

    const updatedFile = await prisma.file.update({
      where: { id: fileId },
      data: {
        tags: tags as unknown as Prisma.InputJsonValue,
        updatedAt: new Date(),
      },
      include: { versions: true, sharedWith: true },
    });
    if (!updatedFile) {
      throw new Error('File not found after update');
    }
    return this.mapFileToMetadata(updatedFile);
  }

  async searchFiles(
    userId: string,
    query: {
      name?: string;
      mimeType?: string;
      tags?: Record<string, string>;
      status?: FileStatus;
      sharedWithMe?: boolean;
    }
  ): Promise<FileMetadata[]> {
    let files: PrismaFile[] = [];
    if (query.sharedWithMe) {
      // Query FileShare for fileIds shared with userId
      const shares = await prisma.fileShare.findMany({ where: { userId } });
      const fileIds = shares.map((s: PrismaFileShare) => s.fileId);
      files = await prisma.file.findMany({
        where: {
          id: { in: fileIds },
          ...(query.name && { name: { contains: query.name, mode: 'insensitive' } }),
          ...(query.mimeType && { mimeType: query.mimeType }),
          ...(query.tags && { tags: { path: Object.keys(query.tags), equals: Object.values(query.tags) } }),
          ...(query.status && { status: query.status }),
        },
        orderBy: { updatedAt: 'desc' },
      });
    } else {
      files = await prisma.file.findMany({
        where: {
          userId,
          ...(query.name && { name: { contains: query.name, mode: 'insensitive' } }),
          ...(query.mimeType && { mimeType: query.mimeType }),
          ...(query.tags && { tags: { path: Object.keys(query.tags), equals: Object.values(query.tags) } }),
          ...(query.status && { status: query.status }),
        },
        orderBy: { updatedAt: 'desc' },
      });
    }
    return files.map((file: PrismaFile) => this.mapFileToMetadata(file));
  }

  async getFileById(id: string): Promise<FileMetadata | null> {
    const file = await prisma.file.findUnique({
      where: { id },
      include: { versions: true, sharedWith: true },
    });
    return file ? this.mapFileToMetadata(file) : null;
  }

  async getFileBuffer(key: string): Promise<Buffer> {
    const { Body } = await s3Client.send(new GetObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
    }));
    if (Body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of Body) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      return Buffer.concat(chunks);
    } else if (Buffer.isBuffer(Body)) {
      return Body;
    } else {
      throw new Error('Unable to read file buffer');
    }
  }

  async updateFileCategory(id: string, userId: string, category: string): Promise<FileMetadata> {
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) throw new Error('File not found');
    if (file.userId !== userId) throw new Error('Permission denied');
    const updated = await prisma.file.update({
      where: { id },
      data: { category },
      include: { versions: true, sharedWith: true },
    });
    if (!updated) {
      throw new Error('File not found after update');
    }
    return this.mapFileToMetadata(updated);
  }

  async batchDeleteFiles(fileIds: string[], userId: string): Promise<{ deleted: string[], failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    for (const id of fileIds) {
      try {
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file || file.userId !== userId) throw new Error('Not found or permission denied');
        await s3Client.send(new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: file.key }));
        await prisma.file.delete({ where: { id } });
        deleted.push(id);
      } catch {
        failed.push(id);
      }
    }
    return { deleted, failed };
  }

  async batchUpdateTags(fileIds: string[], userId: string, tags: Record<string, string>): Promise<{ updated: string[], failed: string[] }> {
    const updated: string[] = [];
    const failed: string[] = [];
    for (const id of fileIds) {
      try {
        const file = await prisma.file.findUnique({ where: { id } });
        if (!file || file.userId !== userId) throw new Error('Not found or permission denied');
        await prisma.file.update({ where: { id }, data: { tags: tags as Prisma.InputJsonValue } });
        updated.push(id);
      } catch {
        failed.push(id);
      }
    }
    return { updated, failed };
  }

  private mapFileToMetadata(file: PrismaFile & { versions?: PrismaFileVersion[]; sharedWith?: PrismaFileShare[] }): FileMetadata {
    return {
      id: file.id,
      key: file.key,
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      uploadedBy: file.userId,
      uploadedAt: file.uploadedAt,
      lastAccessed: file.lastAccessed ?? undefined,
      tags: file.tags as Record<string, string>,
      status: file.status,
      scanStatus: file.scanStatus,
      scanResult: file.scanResult ? (file.scanResult as unknown as ScanResult) : undefined,
      currentVersion: file.currentVersion,
      versions: (file.versions ?? []).map((v: PrismaFileVersion) => ({
        id: v.id,
        key: v.key,
        size: v.size,
        uploadedBy: v.userId,
        uploadedAt: v.uploadedAt,
        versionNumber: v.versionNumber,
        changeDescription: v.changeDescription ?? undefined,
        scanStatus: v.scanStatus,
        scanResult: v.scanResult ? (v.scanResult as unknown as ScanResult) : undefined,
      })),
      sharedWith: (file.sharedWith ?? []).map((s: PrismaFileShare) => ({
        id: s.id,
        userId: s.userId,
        sharedById: s.sharedById,
        permission: s.permission,
        sharedAt: s.sharedAt,
        expiresAt: s.expiresAt ?? undefined,
      })),
    };
  }
} 