import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getBucketConfig, createS3Client } from "./aws-config";

const s3Client = createS3Client();

// Dosya yükleme için presigned URL oluştur
export async function generatePresignedUploadUrl(
  fileName: string,
  contentType: string,
  isPublic: boolean = false,
  forceDownload: boolean = false // true ise Content-Disposition: attachment eklenir
): Promise<{ uploadUrl: string; cloud_storage_path: string; requiresContentDisposition: boolean }> {
  const { bucketName, folderPrefix } = getBucketConfig();
  
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/${Date.now()}-${fileName}`;

  // ContentDisposition sadece forceDownload true ise kullanılır
  // Profil fotoğrafları gibi görüntülenecek dosyalar için false olmalı
  const useContentDisposition = forceDownload;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ContentType: contentType,
    ...(useContentDisposition ? { ContentDisposition: "attachment" } : {})
  });

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { 
    uploadUrl, 
    cloud_storage_path,
    requiresContentDisposition: useContentDisposition 
  };
}

// Dosya URL'i getir (public veya signed)
export async function getFileUrl(
  cloud_storage_path: string,
  isPublic: boolean = false
): Promise<string> {
  const { bucketName } = getBucketConfig();
  
  if (isPublic) {
    const region = process.env.AWS_REGION || 'us-east-1';
    return `https://${bucketName}.s3.${region}.amazonaws.com/${cloud_storage_path}`;
  }
  
  // Private dosyalar için signed URL
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    ResponseContentDisposition: "attachment"
  });
  
  return await getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

// Dosya sil
export async function deleteFile(cloud_storage_path: string): Promise<void> {
  const { bucketName } = getBucketConfig();
  
  const command = new DeleteObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path
  });
  
  await s3Client.send(command);
}

// Buffer'dan doğrudan S3'e yükle
export async function uploadBuffer(
  buffer: Buffer,
  fileName: string,
  contentType: string,
  isPublic: boolean = false
): Promise<string> {
  const { bucketName, folderPrefix } = getBucketConfig();
  
  const cloud_storage_path = isPublic
    ? `${folderPrefix}public/uploads/${Date.now()}-${fileName}`
    : `${folderPrefix}uploads/identity/${Date.now()}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: cloud_storage_path,
    Body: buffer,
    ContentType: contentType,
    ContentDisposition: isPublic ? "attachment" : undefined
  });
  
  await s3Client.send(command);
  
  return cloud_storage_path;
}
