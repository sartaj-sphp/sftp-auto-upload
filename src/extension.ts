import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { SftpClient } from './sftpClient';
import { FtpClient } from './ftpClient';
import { TransferNotifier } from './transferNotifier';

interface ServerConfig {
    protocol: 'sftp' | 'ftp';
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    remotePath: string;
    uploadOnSave: boolean;
    ignore: string[];
}

class StatusBarNotifier implements TransferNotifier {
    updateTransferStatus(filename: string) {
        updateTransferStatus(filename);
    }
}

let statusBarItem: vscode.StatusBarItem;
const statusNotifier = new StatusBarNotifier();

export function activate(context: vscode.ExtensionContext) {
    console.log('"SFTP/FTP Auto Upload on Save" is now active!');
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    showTransferStatus("Ready");

    context.subscriptions.push({
        dispose: () => {
            statusBarItem.hide();
            statusBarItem.dispose();
        }
    });
    // Auto-upload on save
	
    const watcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);
    watcher.onDidDelete(async (uri) => {
        const config = await getConfig(uri);
        if (config?.uploadOnSave) {
            var isdir = await isDirectory(uri);
            if(isdir){ 
            await deleteFolder(uri, config);
            //vscode.window.showInformationMessage("dir");
            }else{
            //vscode.window.showInformationMessage("file");
            await deleteFile(uri, config);
            }
        }
    });

	vscode.workspace.onDidSaveTextDocument(async (document) => {
    //vscode.window.showInformationMessage("File saved: " + document.uri.fsPath);

    const config = await getConfig(document.uri);
    if (config?.uploadOnSave) {
        await uploadFile(document.uri, config);
    }
	});

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('autoUploadOnSave.uploadFile', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                await uploadFile(uri, config);
            }
        }),

        vscode.commands.registerCommand('autoUploadOnSave.downloadFile', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                await downloadFile(uri, config);
            }
        }),

        vscode.commands.registerCommand('autoUploadOnSave.uploadFolder', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                await uploadFolder(uri, config);
            }
        }),

        vscode.commands.registerCommand('autoUploadOnSave.downloadFolder', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                await downloadFolder(uri, config);
            }
        })
    );
}

function showTransferStatus(filename: string) {
    statusBarItem.text = `SFTP: ${filename}`;
    statusBarItem.tooltip = "SFTP/FTP Transfer in progress";
    statusBarItem.show();
}

function updateTransferStatus(filename: string) {
    statusBarItem.text = `SFTP: ${filename}`;
}


async function isDirectory(uri: vscode.Uri): Promise<boolean> {
        return !path.extname(uri.fsPath); // No extension = likely folder
}

function getRemotePath(uri: vscode.Uri, config: any): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {throw new Error("File not in workspace");}
    const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    var p1 = path.posix.join(config.remotePath, relativePath);
    p1 = p1.replaceAll('\\', '/');
    return p1;
}

async function getConfig(uri: vscode.Uri): Promise<ServerConfig | undefined> {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (!workspaceFolder) {
        return;
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'sftp.json');
    if (!fs.existsSync(configPath)) {
        vscode.window.showErrorMessage('sftp.json not found in .vscode folder');
        return;
    }

    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return config as ServerConfig;
    } catch (error) {
        vscode.window.showErrorMessage('Error reading sftp.json: ' + error);
        return;
    }
}

async function uploadFile(uri: vscode.Uri, config: ServerConfig) {
    var client : any;
    var remotePath : string = "";
 try {
        remotePath = getRemotePath(uri, config);
         if (config.protocol === 'sftp') {
            client = new SftpClient(config,statusNotifier);
         } else {
            client = new FtpClient(config,statusNotifier);
         }
        await client.connect();
        await client.uploadFile(uri.fsPath, remotePath);
        await client.disconnect();
        vscode.window.showInformationMessage(`File uploaded: ${remotePath}`);
     } catch (error) {
        await client.disconnect();
        vscode.window.showErrorMessage(`Upload failed ${remotePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function deleteFile(uri: vscode.Uri, config: ServerConfig) {
    var client : any;
 try {
        const remotePath = getRemotePath(uri, config);
         if (config.protocol === 'sftp') {
            client = new SftpClient(config,statusNotifier);
         } else {
            client = new FtpClient(config,statusNotifier);
         }
        await client.connect();
        await client.deleteFile(remotePath);
        await client.disconnect();
        vscode.window.showInformationMessage(`File Deleted: ${remotePath}`);
     } catch (error) {
        await client.disconnect();
        vscode.window.showErrorMessage(`File deletion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function deleteFolder(uri: vscode.Uri, config: ServerConfig) {
    var client : any;
 try {
        const remotePath = getRemotePath(uri, config);
         if (config.protocol === 'sftp') {
            client = new SftpClient(config,statusNotifier);
         } else {
            client = new FtpClient(config,statusNotifier);
         }
        await client.connect();
        await client.deleteFolder(remotePath);
        await client.disconnect();
        vscode.window.showInformationMessage(`Folder Deleted: ${remotePath}`);
     } catch (error) {
        await client.disconnect();
        vscode.window.showErrorMessage(`Folder deletion failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function downloadFile(uri: vscode.Uri, config: ServerConfig) {
    var client : any;
 try {
        const remotePath = getRemotePath(uri, config);
         if (config.protocol === 'sftp') {
            client = new SftpClient(config,statusNotifier);
         } else {
            client = new FtpClient(config,statusNotifier);
         }
        await client.connect();
        await client.downloadFile(remotePath,uri.fsPath);
        await client.disconnect();
        vscode.window.showInformationMessage(`File downloaded: ${remotePath}`);
     } catch (error) {
        await client.disconnect();
        vscode.window.showErrorMessage(`Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }

}


async function uploadFolder(uri: vscode.Uri, config: ServerConfig) {
    var client : any;
 try {
        const remotePath = getRemotePath(uri, config);
         if (config.protocol === 'sftp') {
            client = new SftpClient(config,statusNotifier);
         } else {
            client = new FtpClient(config,statusNotifier);
         }
        await client.connect();
        await client.uploadFolder(uri.fsPath,remotePath);
        await client.disconnect();
        vscode.window.showInformationMessage(`Folder uploaded: ${remotePath}`);
     } catch (error) {
        await client.disconnect();
        vscode.window.showErrorMessage(`Upload Folder failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function downloadFolder(uri: vscode.Uri, config: ServerConfig) {
    var client : any;
    try {
        const remotePath = getRemotePath(uri, config);
         if (config.protocol === 'sftp') {
            client = new SftpClient(config,statusNotifier);
         } else {
            client = new FtpClient(config,statusNotifier);
         }
        await client.connect();
        await client.downloadFolder(remotePath,uri.fsPath);
        await client.disconnect();
        vscode.window.showInformationMessage(`Folder downloaded: ${remotePath}`);
     } catch (error) {
        await client.disconnect();
        vscode.window.showErrorMessage(`Folder Download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}


export function deactivate() {
    // No need to explicitly hide here because of the subscription disposal
    // But you can add it if you want to be extra safe
    if (statusBarItem) {
        statusBarItem.hide();
    }
}