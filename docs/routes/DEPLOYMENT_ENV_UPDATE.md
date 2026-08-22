# Environment Variable Update Implementation

## Overview
This document describes the implementation of Task 9.4: Environment variable update with restart feature for deployments.

## Requirements Implemented
- **Requirement 12.10**: Allow customers to update environment variables for a deployment
- **Requirement 12.11**: When environment variables are updated, restart the deployment to apply changes

## Components Modified

### 1. Database Schema (`packages/db/prisma/schema.prisma`)
Added `envVarsEncrypted` field to the Deployment model:
```prisma
model Deployment {
  // ... existing fields ...
  
  // Environment variables for deployment (encrypted) - Requirements 12.10-12.11
  envVarsEncrypted String? // Encrypted JSON string of environment variables
}
```

### 2. Deployment Pipeline (`apps/api/src/lib/deployPipeline.ts`)
- Added encryption of environment variables during deployment creation
- Imported `encryptSecret` from `secretsVault.ts`
- Environment variables are encrypted using AES-256-GCM before storage

### 3. Deployments Router (`apps/api/src/routes/deployments.ts`)
Added new endpoint: `PATCH /api/deployments/:id/env`

#### Endpoint Behavior:
1. **Validation**: Validates that at least one environment variable is provided
2. **Authorization**: Uses existing `loadOwnedDeployment` function to enforce RBAC:
   - Deployment owner (customer) can update their own deployments
   - Admin/dev users can update any deployment
3. **Encryption**: Encrypts environment variables using AES-256-GCM before storage
4. **Storage**: Updates the `envVarsEncrypted` field in the database
5. **Restart**: If deployment is running, automatically restarts to apply changes
   - Stops the current container
   - Rebuilds and runs with new environment variables
   - Maintains resource limits (CPU, memory, storage)
   - Streams progress events as newline-delimited JSON
6. **Response**: Returns success with deployment confirmation

#### Request Format:
```json
{
  "envVars": {
    "KEY1": "value1",
    "KEY2": "value2",
    "DATABASE_URL": "postgresql://..."
  }
}
```

#### Response Format (Running Deployment):
Newline-delimited JSON events followed by completion:
```json
{"phase": "fetch", "message": "Cloning repository..."}
{"phase": "build", "log": "Building application..."}
{"phase": "run", "message": "Starting container..."}
{"phase": "complete", "deploymentId": "...", "message": "Environment variables updated and deployment restarted successfully"}
```

#### Response Format (Stopped Deployment):
```json
{
  "ok": true,
  "deployment": {
    "id": "...",
    "envVarsUpdated": true
  },
  "message": "Environment variables updated. Changes will apply on next deployment start."
}
```

## Security

### Encryption
- Environment variables are encrypted using AES-256-GCM
- Encryption key is stored in `SECRETS_ENCRYPTION_KEY` environment variable
- Format: `base64(IV):base64(authTag):base64(ciphertext)`
- Same encryption mechanism used for other secrets (SMTP passwords, API keys, etc.)

### Authorization (RBAC)
- Customer users: Can only update their own deployments
- Admin users: Can update any deployment
- Dev users: Can update any deployment
- Authorization check uses existing `loadOwnedDeployment` helper function

## Testing
Comprehensive test suite created in `deployments.test.ts`:

### Test Coverage:
1. **Encryption/Decryption**: Verifies environment variables are correctly encrypted and decrypted
2. **Special Characters**: Tests handling of passwords, URLs, and JSON in environment variables
3. **Request Validation**: Validates input format and requirements
4. **Restart Logic**: Verifies deployment status checks for restart decision
5. **RBAC**: Tests ownership and role-based access control logic

All 9 tests passing ✓

## Migration
Created migration file: `20260125_add_env_vars_encrypted_field/migration.sql`
- Adds `envVarsEncrypted` TEXT column to Deployment table
- Includes comment documenting the field purpose

## API Endpoint Summary

### PATCH /api/deployments/:id/env
**Authentication**: Required  
**Authorization**: Deployment owner or admin/dev

**Request Body**:
```typescript
{
  envVars: Record<string, string> // At least one env var required
}
```

**Success Responses**:
- `200 OK` (stopped deployment): JSON with success confirmation
- `200 OK` (running deployment): Newline-delimited JSON stream with build events

**Error Responses**:
- `400 Bad Request`: Invalid request body or validation error
- `404 Not Found`: Deployment not found or access denied
- `502 Bad Gateway`: Failed to restart deployment

## Success Criteria ✓
- [x] Environment variable update endpoint created
- [x] Updates stored in database (encrypted)
- [x] Deployment automatically restarted when running
- [x] RBAC enforced (deployment owner or admin/dev only)
- [x] No TypeScript errors
- [x] Tests passing

## Notes
- Environment variables are only decrypted when needed for deployment operations
- The encryption key (`SECRETS_ENCRYPTION_KEY`) must be kept secure and backed up
- If a deployment is stopped, environment variables are updated but restart happens on next start
- The restart process streams build logs to the client for real-time feedback
