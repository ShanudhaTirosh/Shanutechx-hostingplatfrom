# Firebase Configuration

This directory contains Firebase configuration files and admin SDK credentials.

## ⚠️ SECURITY WARNING

**NEVER commit Firebase admin SDK keys to version control!**

These files contain sensitive credentials that grant administrative access to your Firebase project.

## 📁 Expected Files

- `shanutechx-firebase-adminsdk-*.json` - Firebase Admin SDK service account key
- Other Firebase configuration files as needed

## 🔒 Security Best Practices

1. **Keep credentials secret**: Never share these files publicly
2. **Use environment variables**: Reference credentials via environment variables in production
3. **Rotate keys regularly**: Periodically generate new service account keys
4. **Limit permissions**: Use service accounts with minimum required permissions
5. **Monitor usage**: Enable Cloud Audit Logs to track credential usage

## 🚀 Usage

### In Development

Set the path to your Firebase credentials:

```bash
# Linux/Mac
export GOOGLE_APPLICATION_CREDENTIALS="./config/firebase/shanutechx-firebase-adminsdk-*.json"

# Windows PowerShell
$env:GOOGLE_APPLICATION_CREDENTIALS=".\config\firebase\shanutechx-firebase-adminsdk-*.json"

# Windows CMD
set GOOGLE_APPLICATION_CREDENTIALS=.\config\firebase\shanutechx-firebase-adminsdk-*.json
```

### In Code

```typescript
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { join } from 'path';

// Load service account
const serviceAccount = JSON.parse(
  readFileSync(
    join(__dirname, '../../config/firebase/shanutechx-firebase-adminsdk-*.json'),
    'utf8'
  )
);

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://your-project.firebaseio.com'
});
```

### In Production

**DO NOT** deploy credential files to production servers. Instead:

1. **Use Secret Management**:
   - Google Cloud Secret Manager
   - AWS Secrets Manager
   - Azure Key Vault
   - Kubernetes Secrets

2. **Use Environment Variables**:
   ```yaml
   # docker-compose.yml
   services:
     api:
       environment:
         - FIREBASE_ADMIN_SDK=${FIREBASE_ADMIN_SDK}
   ```

3. **Use Service Account Impersonation**:
   - Workload Identity (GKE)
   - IAM Roles (Cloud Run)

## 🔑 Getting Firebase Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **Generate New Private Key**
5. Save the JSON file to this directory
6. **Immediately add to .gitignore** (already configured)

## 🧪 Testing Access

Test your Firebase credentials:

```typescript
import admin from 'firebase-admin';

// Initialize admin SDK
admin.initializeApp({
  credential: admin.credential.applicationDefault()
});

// Test connection
const db = admin.firestore();
const testDoc = await db.collection('_test').doc('connection').set({
  timestamp: admin.firestore.FieldValue.serverTimestamp()
});

console.log('✅ Firebase connection successful!');
```

## 📚 Documentation

- [Firebase Admin SDK Setup](https://firebase.google.com/docs/admin/setup)
- [Service Account Credentials](https://cloud.google.com/iam/docs/service-accounts)
- [Best Practices for Managing Service Account Keys](https://cloud.google.com/iam/docs/best-practices-for-managing-service-account-keys)

## 🆘 Troubleshooting

### "Could not load default credentials"
- Ensure `GOOGLE_APPLICATION_CREDENTIALS` is set
- Check file path is correct
- Verify JSON file is valid

### "Permission denied"
- Check service account has required IAM roles
- Verify Firebase project ID matches
- Ensure service account is enabled

### "Invalid credential"
- Credential file may be corrupted
- Generate a new service account key
- Check file encoding (should be UTF-8)
