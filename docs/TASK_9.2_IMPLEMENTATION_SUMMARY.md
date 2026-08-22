# Task 9.2: Resource Usage Metrics Endpoint Implementation

## Overview
Implemented resource usage metrics endpoint for deployments, allowing deployment owners and admins to view real-time CPU, memory, and storage utilization metrics.

## Changes Made

### 1. Node Agent Client (`apps/api/src/lib/nodeAgentClient.ts`)

#### Added ResourceMetrics Interface
```typescript
export interface ResourceMetrics {
  cpuUsagePercent: number;      // Current CPU usage as percentage
  memoryUsedMb: number;          // Current memory usage in MB
  memoryLimitMb: number | null;  // Memory limit in MB (null if no limit set)
  memoryUsagePercent: number;    // Memory usage as percentage of limit
  storageUsedGb: number;         // Current storage usage in GB
  storageLimitGb: number | null; // Storage limit in GB (null if no limit set)
  storageUsagePercent: number;   // Storage usage as percentage of limit
  timestamp: string;             // ISO timestamp when metrics were captured
}
```

#### Added getResourceUsage Function
- **Function**: `getResourceUsage(node: Node, containerId: string): Promise<ResourceMetrics>`
- **Purpose**: Fetches current resource usage metrics from node-agent
- **Endpoint**: Calls `GET /agent/deployments/{containerId}/metrics` on node-agent
- **Returns**: Complete resource metrics including CPU, memory, storage usage with percentages
- **Error Handling**: Throws error if node-agent request fails (handled gracefully in route)

### 2. Deployments Router (`apps/api/src/routes/deployments.ts`)

#### Updated Imports
- Added `getResourceUsage` and `ResourceMetrics` to imports from nodeAgentClient

#### Modified GET /api/deployments/:id Endpoint
- **Resource Metrics Fetch**: 
  - Fetches metrics only when deployment status is 'running' AND containerId exists
  - Returns `null` for resourceUsage when deployment is stopped or has no container
  - Gracefully handles metrics fetch failures by logging warning and returning `null`
  
- **Response Structure**:
```typescript
{
  deployment: {
    id: string,
    userId: string,
    nodeId: string,
    repoUrl: string,
    subdomain: string,
    internalPort: number,
    status: string,
    cpuLimit: number,
    memoryLimit: number,
    storageLimit: number,
    createdAt: Date,
    lastDeployAt: Date
  },
  resourceUsage: ResourceMetrics | null
}
```

- **Error Handling**: 
  - Logs warning with deployment ID when metrics fetch fails
  - Does not fail entire request if metrics unavailable
  - Returns deployment data with `null` resourceUsage

### 3. Tests (`apps/api/src/routes/deployments-resource-metrics.test.ts`)

#### Test Coverage
- **getResourceUsage function tests**:
  - Verifies correct parameters passed to node-agent
  - Validates resource limits included in response
  - Tests error handling when node-agent unavailable

- **Deployment endpoint integration tests**:
  - Returns null metrics for stopped deployments
  - Fetches metrics for running deployments with containerId
  - Handles metrics fetch failures gracefully with logging

- **ResourceMetrics type structure tests**:
  - Validates all required fields with correct types
  - Allows null for limit fields when no limits set

#### Test Results
All 8 tests passing:
- ✓ should call node-agent metrics endpoint with correct parameters
- ✓ should include resource limits in metrics response
- ✓ should throw error when node-agent is unavailable
- ✓ should return null metrics for stopped deployment
- ✓ should fetch metrics for running deployment with containerId
- ✓ should handle metrics fetch failure gracefully
- ✓ should have all required fields with correct types
- ✓ should allow null for limit fields when no limits set

## Requirements Validation

### Requirement 17.7: Display resource usage metrics
✅ **Implemented**: GET /api/deployments/:id endpoint includes resourceUsage field with:
- Current CPU usage percentage
- Memory usage in MB with utilization percentage
- Storage usage in GB with utilization percentage
- Timestamp of metrics capture

### Design Conformance
✅ **Node-agent API integration**: Implemented `getResourceUsage(projectName)` function
✅ **Metrics format**: Returns CPU %, memory MB, storage GB with utilization percentages
✅ **RBAC enforcement**: Uses existing `loadOwnedDeployment` function for access control
✅ **Error handling**: Gracefully handles stopped deployments and node-agent failures
✅ **Non-blocking**: Metrics fetch failure doesn't prevent deployment data retrieval

## RBAC Enforcement
- **Deployment owner**: Can view metrics for their own deployments
- **Admin/Dev users**: Can view metrics for any deployment (inherited from existing RBAC)
- **Access control**: Implemented via `loadOwnedDeployment` helper function
- **Not found behavior**: Returns 404 for unauthorized access (doesn't reveal existence)

## API Behavior

### Running Deployment
```json
{
  "deployment": { ... },
  "resourceUsage": {
    "cpuUsagePercent": 35.5,
    "memoryUsedMb": 1024,
    "memoryLimitMb": 2048,
    "memoryUsagePercent": 50.0,
    "storageUsedGb": 10.5,
    "storageLimitGb": 50,
    "storageUsagePercent": 21.0,
    "timestamp": "2024-01-15T10:30:00.000Z"
  }
}
```

### Stopped Deployment
```json
{
  "deployment": { ... },
  "resourceUsage": null
}
```

### Metrics Fetch Failure (Node Agent Unavailable)
```json
{
  "deployment": { ... },
  "resourceUsage": null
}
```
Note: Warning logged to server logs with deployment ID and error details

## Implementation Notes

1. **No Caching Implemented**: Task description mentioned optional caching for 30 seconds, but not implemented in this iteration. Can be added later if needed to reduce node-agent load.

2. **Graceful Degradation**: Metrics unavailable doesn't break deployment detail endpoint - system continues to function with null metrics.

3. **Real-time Metrics**: Each request fetches fresh metrics from node-agent (no caching means most current data).

4. **Type Safety**: Full TypeScript type definitions for ResourceMetrics interface ensures type safety across codebase.

5. **Node Agent Dependency**: Implementation assumes node-agent provides `/agent/deployments/{containerId}/metrics` endpoint. Node-agent implementation is outside scope of this task.

## Success Criteria Validation

✅ Metrics endpoint returns resource usage data
✅ Returns CPU, memory, storage usage with percentages
✅ RBAC enforcement working (via existing loadOwnedDeployment)
✅ Error handling for stopped deployments (returns null)
✅ Error handling for node-agent failures (returns null, logs warning)
✅ No TypeScript compilation errors
✅ All tests passing (8/8)

## Next Steps

1. **Node-Agent Implementation**: The node-agent needs to implement the `/agent/deployments/{containerId}/metrics` endpoint to provide Docker stats data.

2. **Optional Caching**: Consider implementing 30-second cache if node-agent load becomes an issue.

3. **Dashboard Integration**: Frontend dashboard can now display resource usage graphs and alerts using this endpoint.

4. **Monitoring Integration**: Resource metrics can be used for alerting when deployments approach their limits.
