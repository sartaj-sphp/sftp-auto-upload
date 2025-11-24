import Client from 'ssh2-sftp-client';
import * as path from 'path';
import * as vscode from 'vscode';
import * as fs from 'fs';
import { TransferNotifier } from './transferNotifier';

export class SftpClient {
    private client: Client;
    private config: any;
    private statusNotifier: TransferNotifier;

    constructor(config: any, statusNotifier: TransferNotifier) {
        this.client = new Client();
        this.config = config;
        this.statusNotifier = statusNotifier;
    }

    async connect(): Promise<void> {
        try {
            await this.client.connect({
                host: this.config.host,
                port: this.config.port || 22,
                username: this.config.username,
                password: this.config.password,
                privateKey: this.config.privateKey
            });
        } catch (error) {
            vscode.window.showErrorMessage(`SFTP Connection failed: ${error}`);
            throw error;
        }
    }

    async uploadFile(localPath: string, remotePath: string): Promise<void> {
        this.statusNotifier.updateTransferStatus(path.basename(localPath));
        await this.ensureRemoteDirectory(path.dirname(remotePath));
        await this.client.put(localPath, remotePath);
    }

    async downloadFile(remotePath: string, localPath: string): Promise<void> {
        this.statusNotifier.updateTransferStatus(path.basename(localPath));
        await this.client.get(remotePath, localPath);
    }

    async uploadFolder(localPath: string, remotePath: string): Promise<void> {
        await this.recursiveUpload(localPath, remotePath);
    }

    async downloadFolder(remotePath: string, localPath: string): Promise<void> {
        await this.recursiveDownload(remotePath, localPath);
        }
    async deleteFile(remotePath: string): Promise<void> {
        await this.client.delete(remotePath);
    }
    async rename(oldRemotePath: string, newRemotePath: string): Promise<void> {
        await this.client.rename(oldRemotePath, newRemotePath);
    }
    async deleteFolder(remotePath: string): Promise<void> {
        await this.client.rmdir(remotePath, true); // recursive deletion
    }

    private async ensureRemoteDirectory(remoteDir: string): Promise<void> {
        await this.client.mkdir(remoteDir, true);
    }

    private async recursiveUpload(localDir: string, remoteDir: string): Promise<void> {
        const entries = await fs.promises.readdir(localDir, { withFileTypes: true });
        
        for (const entry of entries) {
            if(entry.name === '.' || entry.name === '..') continue;
            const localPath = path.join(localDir, entry.name);
            const remotePath = getRemotePath(path.join(remoteDir, entry.name));
            
            if (entry.isDirectory()) {
                await this.ensureRemoteDirectory(remotePath);
                await this.recursiveUpload(localPath, remotePath);
            } else {
                await this.uploadFile(localPath, remotePath);
            }
        }
    }

    private async recursiveDownload(remoteDir: string, localDir: string): Promise<void> {
        const list = await this.client.list(remoteDir);
        
        for (const item of list) {
            if(item.name === '.' || item.name === '..') continue;
            const remotePath = getRemotePath(path.join(remoteDir, item.name));
            const localPath = path.join(localDir, item.name);
            
            if (item.type === 'd') {
                if (!fs.existsSync(localPath)) {
                    fs.mkdirSync(localPath, { recursive: true });
                }
                await this.recursiveDownload(remotePath, localPath);
            } else {
                await this.downloadFile(remotePath, localPath);
            }
        }
    }

    async disconnect(): Promise<void> {
        await this.client.end();
    }
}

 function getRemotePath(p1: string): string {
     p1 = p1.replaceAll('\\', '/');
     return p1;
 }
