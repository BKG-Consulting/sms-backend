# Storage Setup Guide

## Problem
Your AWS S3 free tier has expired, causing document uploads to fail with `InvalidAccessKeyId` error.

## Solution Options

### Option 1: Switch to Local Storage (Immediate Fix)

Add these environment variables to your `.env` file:

```bash
# Storage Configuration
STORAGE_TYPE=local
LOCAL_STORAGE_PATH=./uploads

# Comment out or remove AWS variables since they're not working
# AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
# AWS_REGION=YOUR_AWS_REGION
# AWS_S3_BUCKET_NAME=YOUR_S3_BUCKET_NAME
# AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
```

### Option 2: Fix AWS S3 (Recommended for Production)

1. **Log into AWS Console**
2. **Add a payment method** to your AWS account
3. **Reactivate the access key** or create a new one
4. **Set environment variables:**
   ```bash
   STORAGE_TYPE=s3
   AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY_ID
   AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_ACCESS_KEY
   AWS_REGION=eu-central-1
   AWS_S3_BUCKET_NAME=pouchquan
   ```

## Testing

Run the test script to verify storage is working:

```bash
# Test local storage
node test-local-storage.js

# Test AWS credentials (if you fix them)
node test-aws-credentials.js
```

## Features

The new storage system supports:
- ✅ **Automatic fallback** between S3 and local storage
- ✅ **File upload/download** functionality
- ✅ **File deletion** with cleanup
- ✅ **URL generation** for file access
- ✅ **Static file serving** for local uploads

## File Structure

```
dualdauth/
├── uploads/           # Local storage directory (auto-created)
├── src/
│   └── config/
│       └── storage.js # Storage service
└── .env              # Environment configuration
```

## Benefits of Local Storage

- ✅ **No costs** - files stored locally
- ✅ **No external dependencies** - works offline
- ✅ **Fast access** - no network latency
- ✅ **Easy backup** - just copy the uploads folder

## Limitations of Local Storage

- ❌ **No redundancy** - single point of failure
- ❌ **Limited scalability** - depends on server storage
- ❌ **No CDN** - slower for global users
- ❌ **Backup required** - manual backup needed

## Production Recommendation

For production use, we recommend:
1. **Fix AWS S3** by adding payment method
2. **Use S3** for better reliability and scalability
3. **Keep local storage** as a fallback option 