import { Storage } from '@google-cloud/storage';
import { AppObject } from '@shared/schema';
import path from 'path';

/**
 * GCP Storage service for handling file uploads and downloads
 * Files are stored with path structure: {type}/{id}.{extension}
 * Example: document/95ace82f-7583-4974-bd03-38821c3ae0c9.docx
 */
export class GCPStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    // Initialize GCP Storage client
    // GCP credentials should be provided via GOOGLE_APPLICATION_CREDENTIALS env var
    // or through service account key
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS, // Optional: path to service account key
    });
    
    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'ai-context-manager-files';
  }

  /**
   * Upload a file to GCP Storage
   * @param objectId - The object ID 
   * @param objectType - The object type (document, meeting, etc.)
   * @param fileBuffer - The file buffer
   * @param originalFileName - Original filename with extension
   * @param mimeType - MIME type of the file
   * @returns Promise with the file path in GCP Storage
   */
  async uploadFile(
    objectId: string, 
    objectType: string, 
    fileBuffer: Buffer, 
    originalFileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      // Extract file extension from original filename
      const extension = path.extname(originalFileName);
      const filePath = `${objectType}/${objectId}${extension}`;
      
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);
      
      // Upload the file
      await file.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
          metadata: {
            originalFileName: originalFileName,
            objectId: objectId,
            objectType: objectType,
            uploadedAt: new Date().toISOString()
          }
        }
      });
      
      console.log(`File uploaded successfully: ${filePath}`);
      return filePath;
    } catch (error) {
      console.error('Error uploading file to GCP Storage:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Download a file from GCP Storage
   * @param filePath - The file path in GCP Storage
   * @returns Promise with file buffer and metadata
   */
  async downloadFile(filePath: string): Promise<{
    buffer: Buffer;
    metadata: any;
  }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        throw new Error(`File not found: ${filePath}`);
      }
      
      // Download file
      const [buffer] = await file.download();
      const [metadata] = await file.getMetadata();
      
      return {
        buffer,
        metadata
      };
    } catch (error) {
      console.error('Error downloading file from GCP Storage:', error);
      throw new Error(`Failed to download file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a file from GCP Storage
   * @param filePath - The file path in GCP Storage
   */
  async deleteFile(filePath: string): Promise<void> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);
      
      await file.delete();
      console.log(`File deleted successfully: ${filePath}`);
    } catch (error) {
      console.error('Error deleting file from GCP Storage:', error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate a signed URL for downloading a file
   * @param filePath - The file path in GCP Storage
   * @param expiresInMinutes - Expiration time in minutes (default: 60)
   * @returns Promise with signed URL
   */
  async generateSignedUrl(filePath: string, expiresInMinutes: number = 60): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(filePath);
      
      const options = {
        version: 'v4' as const,
        action: 'read' as const,
        expires: Date.now() + expiresInMinutes * 60 * 1000, // Convert to milliseconds
      };
      
      const [url] = await file.getSignedUrl(options);
      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the storage service is properly configured
   */
  async checkConfiguration(): Promise<boolean> {
    try {
      // Try to list buckets to verify credentials
      const [buckets] = await this.storage.getBuckets();
      
      // Check if our bucket exists
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        console.warn(`Bucket ${this.bucketName} does not exist. You may need to create it.`);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('GCP Storage configuration error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const gcpStorageService = new GCPStorageService();