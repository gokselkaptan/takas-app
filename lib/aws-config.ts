import { S3Client } from "@aws-sdk/client-s3";

export function getBucketConfig() {
  return {
    bucketName: process.env.AWS_BUCKET_NAME || "takas-a-uploads",
    folderPrefix: process.env.AWS_FOLDER_PREFIX || ""
  };
}

export function createS3Client() {
  const region = process.env.AWS_REGION || "eu-north-1";
  
  // Credentials kontrolü
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  
  if (!accessKeyId || !secretAccessKey) {
    console.error('[AWS Config] AWS credentials eksik!');
  }
  
  return new S3Client({
    region,
    credentials: accessKeyId && secretAccessKey ? {
      accessKeyId,
      secretAccessKey
    } : undefined
  });
}
