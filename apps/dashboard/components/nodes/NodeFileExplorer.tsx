'use client';

import React from 'react';
import { VpsFileManager } from '../VpsFileManager';

export interface NodeFileExplorerProps {
  nodeId?: string;
  provisionId?: string;
}

export function NodeFileExplorer({ nodeId, provisionId }: NodeFileExplorerProps) {
  const targetId = provisionId || nodeId || '';
  return <VpsFileManager provisionId={targetId} />;
}

export default NodeFileExplorer;
