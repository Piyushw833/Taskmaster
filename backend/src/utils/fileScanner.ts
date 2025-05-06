import { Readable } from 'stream';
import { spawn } from 'child_process';
import { createWriteStream, unlink } from 'fs';
import { promisify } from 'util';
import { join } from 'path';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { lookup } from 'mime-types';

const unlinkAsync = promisify(unlink);

export interface ScanResult {
  isClean: boolean;
  threat?: string;
  error?: string;
  details?: {
    fileType?: string;
    signature?: string;
    scanDuration?: number;
  };
}

// List of high-risk file extensions
const HIGH_RISK_EXTENSIONS = [
  '.exe', '.dll', '.bat', '.cmd', '.ps1', '.vbs', '.js',
  '.jar', '.sh', '.app', '.com', '.scr', '.msi'
];

async function scanWithClamAV(filePath: string): Promise<ScanResult> {
  return new Promise((resolve) => {
    const clamav = spawn('clamscan', ['--no-summary', filePath]);
    let output = '';
    let error = '';

    clamav.stdout.on('data', (data) => {
      output += data.toString();
    });

    clamav.stderr.on('data', (data) => {
      error += data.toString();
    });

    clamav.on('close', (code) => {
      if (code === 0) {
        resolve({
          isClean: true,
          details: {
            signature: 'ClamAV scan passed',
            scanDuration: 0 // TODO: Add actual duration tracking
          }
        });
      } else if (code === 1) {
        const threatMatch = output.match(/: (.+) FOUND/);
        resolve({
          isClean: false,
          threat: threatMatch ? threatMatch[1] : 'Unknown threat',
          details: {
            signature: output.trim(),
            scanDuration: 0
          }
        });
      } else {
        resolve({
          isClean: false,
          error: error || 'ClamAV scan failed',
          details: {
            signature: 'Scan error',
            scanDuration: 0
          }
        });
      }
    });
  });
}

function isHighRiskFile(filename: string): boolean {
  const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
  return HIGH_RISK_EXTENSIONS.includes(ext);
}

async function validateFileType(filePath: string, originalName: string): Promise<ScanResult> {
  const mimeType = lookup(originalName) || 'application/octet-stream';
  const isHighRisk = isHighRiskFile(originalName);

  return {
    isClean: !isHighRisk,
    threat: isHighRisk ? 'High-risk file type detected' : undefined,
    details: {
      fileType: mimeType,
      signature: isHighRisk ? 'High-risk extension' : 'File type validation',
    }
  };
}

export async function scanFile(
  file: Buffer | Readable,
  originalName?: string
): Promise<ScanResult> {
  const tempPath = join(tmpdir(), `scan-${uuidv4()}`);
  
  try {
    // Write file to temp location
    await new Promise<void>((resolve, reject) => {
      const writeStream = createWriteStream(tempPath);
      
      if (Buffer.isBuffer(file)) {
        writeStream.write(file);
        writeStream.end();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      } else {
        file.pipe(writeStream);
        file.on('end', resolve);
        file.on('error', reject);
      }
    });

    // First do a quick file type validation
    if (originalName) {
      const typeValidation = await validateFileType(tempPath, originalName);
      if (!typeValidation.isClean) {
        return typeValidation;
      }
    }

    try {
      // Try ClamAV scan
      const startTime = Date.now();
      const result = await scanWithClamAV(tempPath);
      result.details = {
        ...result.details,
        scanDuration: Date.now() - startTime
      };
      return result;
    } catch (error) {
      // Fallback to basic validation if ClamAV fails
      console.warn('ClamAV scan failed, falling back to basic validation:', error);
      return {
        isClean: true,
        details: {
          signature: 'Basic validation (ClamAV unavailable)',
          scanDuration: 0
        }
      };
    }
  } catch (error) {
    return {
      isClean: false,
      error: error instanceof Error ? error.message : 'Unknown error during scan',
      details: {
        signature: 'Scan error',
        scanDuration: 0
      }
    };
  } finally {
    // Clean up temp file
    try {
      await unlinkAsync(tempPath);
    } catch (error) {
      console.error('Failed to clean up temp file:', error);
    }
  }
} 