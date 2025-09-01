const s3 = require('../config/s3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

async function uploadToS3(fileBuffer, originalName, mimetype) {
  const s3Key = `messages/${uuidv4()}${path.extname(originalName)}`;
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: s3Key,
    Body: fileBuffer,
    ContentType: mimetype,
    ACL: 'private',
  };
  await s3.upload(params).promise();
  const fileUrl = `https://${params.Bucket}.s3.amazonaws.com/${s3Key}`;
  return { fileUrl, s3Key };
}

module.exports = { uploadToS3 }; 