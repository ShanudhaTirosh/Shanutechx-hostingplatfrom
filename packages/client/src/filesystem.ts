import type { GitCommitPushInput, GitCommitPushResult } from '@shanutechx/types';
import { BaseClient } from './base.js';

export interface FileItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modifiedAt?: string;
}

export interface FileListResponse {
  items: FileItem[];
  path: string;
}

export class FilesystemResource extends BaseClient {
  async list(deploymentId: string, dirPath?: string): Promise<FileListResponse> {
    return this.httpGet<FileListResponse>(
      `/api/fs/${deploymentId}/list`,
      dirPath ? { path: dirPath } : undefined,
    );
  }

  async read(deploymentId: string, filePath: string): Promise<string> {
    const res = await this.httpGet<{ content: string }>(
      `/api/fs/${deploymentId}/read`,
      { path: filePath },
    );
    return res.content;
  }

  async write(deploymentId: string, filePath: string, content: string): Promise<void> {
    return this.httpPut(`/api/fs/${deploymentId}/write`, { path: filePath, content });
  }

  async uploadBinary(
    deploymentId: string,
    filePath: string,
    data: Buffer | Uint8Array | string,
  ): Promise<void> {
    const base64 =
      typeof data === 'string'
        ? data
        : Buffer.from(data).toString('base64');
    return this.httpPost(`/api/fs/${deploymentId}/upload-binary`, {
      path: filePath,
      data: base64,
    });
  }

  async extract(
    deploymentId: string,
    archivePath: string,
    destPath?: string,
  ): Promise<void> {
    return this.httpPost(`/api/fs/${deploymentId}/extract`, {
      path: archivePath,
      dest: destPath,
    });
  }

  async mkdir(deploymentId: string, dirPath: string): Promise<void> {
    return this.httpPost(`/api/fs/${deploymentId}/mkdir`, { path: dirPath });
  }

  async delete(deploymentId: string, targetPath: string): Promise<void> {
    return this.request('DELETE', `/api/fs/${deploymentId}/delete`, {
      body: { path: targetPath },
    });
  }

  async rename(deploymentId: string, fromPath: string, toPath: string): Promise<void> {
    return this.httpPost(`/api/fs/${deploymentId}/rename`, {
      from: fromPath,
      to: toPath,
    });
  }

  async gitCommitPush(
    deploymentId: string,
    input: GitCommitPushInput,
  ): Promise<GitCommitPushResult> {
    return this.httpPost<GitCommitPushResult>(
      `/api/fs/${deploymentId}/git-commit-push`,
      input,
    );
  }
}
