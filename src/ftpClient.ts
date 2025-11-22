import Client from 'ftp';
import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { TransferNotifier } from './transferNotifier';

export class FtpClient {
    private client: Client;
    private config: any;
    private isConnected: boolean = false;
    private statusNotifier: TransferNotifier;

    constructor(config: any, statusNotifier: TransferNotifier) {
        this.client = new Client();
        this.config = config;
        this.statusNotifier = statusNotifier;
        this.client.on('error', (err) => {
            vscode.window.showErrorMessage(`FTP Error: ${err.message}`);
        });
    }

    async connect(): Promise<void> {
        if (this.isConnected) return;
        
        return new Promise((resolve, reject) => {
            this.client.on('ready', () => {
                this.isConnected = true;
                resolve();
            });
            
            this.client.on('error', (err) => {
                this.isConnected = false;
                reject(new Error(`FTP Connection failed: ${err.message}`));
            });

            this.client.connect({
                host: this.config.host,
                port: this.config.port || 21,
                user: this.config.username,
                password: this.config.password
            });
        });
    }

    async uploadFile(localPath: string, remotePath: string): Promise<void> {
        await this.ensureConnected();
        const remoteDir = path.dirname(remotePath);
        await this.ensureRemoteDirectory(remoteDir);
        this.statusNotifier.updateTransferStatus(path.basename(localPath));

        return new Promise((resolve, reject) => {
            this.client.put(localPath, remotePath, (err) => {
                if (err) reject(new Error(`Upload failed: ${err.message}`));
                else resolve();
            });
        });
    }

    async downloadFile(remotePath: string, localPath: string): Promise<void> {
        await this.ensureConnected();
        await this.ensureLocalDirectory(path.dirname(localPath));
        this.statusNotifier.updateTransferStatus(path.basename(localPath));

        return new Promise((resolve, reject) => {
            this.client.get(remotePath, (err, stream) => {
                if (err) return reject(new Error(`Download failed: ${err.message}`));
                
                stream.pipe(fs.createWriteStream(localPath))
                    .on('close', resolve)
                    .on('error', reject);
            });
        });
    }

    async rename(oldRemotePath: string, newRemotePath: string): Promise<void> {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.client.rename(oldRemotePath, newRemotePath, (err) => {
                if (err) reject(new Error(`Rename failed: ${err.message}`));
                else resolve();
            });
        });
    }    
    async deleteFile(remotePath: string): Promise<void> {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.client.delete(remotePath, (err) => {
                if (err) reject(new Error(`Delete failed: ${err.message}`));
                else resolve();
            });
        });
    }

    async deleteFolder(remotePath: string): Promise<void> {
        await this.ensureConnected();
        return new Promise((resolve, reject) => {
            this.client.rmdir(remotePath, true, (err) => { // recursive deletion
                if (err) reject(new Error(`Folder delete failed: ${err.message}`));
                else resolve();
            });
        });
    }

    async uploadFolder(localPath: string, remotePath: string): Promise<void> {
        await this.ensureConnected();
        await this.ensureRemoteDirectory(remotePath);
        
        const entries = fs.readdirSync(localPath, { withFileTypes: true });
        
        for (const entry of entries) {
            const localEntryPath = path.join(localPath, entry.name);
            const remoteEntryPath = path.join(remotePath, entry.name);
            
            if (entry.isDirectory()) {
                await this.uploadFolder(localEntryPath, remoteEntryPath);
            } else {
                await this.uploadFile(localEntryPath, remoteEntryPath);
            }
        }
    }

    async downloadFolder(remotePath: string, localPath: string): Promise<void> {
        await this.ensureConnected();
        await this.ensureLocalDirectory(localPath);
        
        const list = await this.listDirectory(remotePath);
        
        for (const item of list) {
            const remoteItemPath = path.join(remotePath, item.name);
            const localItemPath = path.join(localPath, item.name);
            
            if (item.type === 'd') {
                await this.downloadFolder(remoteItemPath, localItemPath);
            } else {
                await this.downloadFile(remoteItemPath, localItemPath);
            }
        }
    }

    async disconnect(): Promise<void> {
        return new Promise((resolve) => {
            if (!this.isConnected) return resolve();
            
            this.client.end();
            this.isConnected = false;
            resolve();
        });
    }

    private async ensureConnected(): Promise<void> {
        if (!this.isConnected) {
            await this.connect();
        }
    }

    private async ensureRemoteDirectory(remoteDir: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.client.mkdir(remoteDir, true, (err) => {
                const errorWithCode = err as any;
                if (err && errorWithCode.code !== 550) { // Ignore "directory already exists" errors
                    reject(new Error(`Failed to create remote directory: ${err?.message}`));
                } else {
                    resolve();
                }
            });
        });
    }

    private async ensureLocalDirectory(localDir: string): Promise<void> {
        if (!fs.existsSync(localDir)) {
            fs.mkdirSync(localDir, { recursive: true });
        }
    }

    private async listDirectory(remotePath: string): Promise<Array<{name: string, type: string}>> {
        return new Promise((resolve, reject) => {
            this.client.list(remotePath, (err, list) => {
                if (err) reject(new Error(`Failed to list directory: ${err.message}`));
                else resolve(list);
            });
        });
    }
}