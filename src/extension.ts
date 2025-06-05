import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Client from 'ssh2-sftp-client';
import FtpClient from 'ftp';

interface ServerConfig {
    protocol: 'sftp' | 'ftp';
    host: string;
    port?: number;
    username: string;
    password?: string;
    privateKey?: string;
    remotePath: string;
    uploadOnSave: boolean;
}

export function activate(context: vscode.ExtensionContext) {
    console.log('"FTP Auto Upload on Save" is now active!');

    // Auto-upload on save
	/*
    const watcher = vscode.workspace.createFileSystemWatcher('** /*', false, false, false);
    watcher.onDidChange(async (uri) => {
		vscode.window.showInformationMessage("triggered");
        const config = await getConfig(uri);
        if (config?.uploadOnSave) {
            //await uploadFile(uri.fsPath, config);
        }
    });
*/
	vscode.workspace.onDidSaveTextDocument(async (document) => {
    //vscode.window.showInformationMessage("File saved: " + document.uri.fsPath);

    const config = await getConfig(document.uri);
    if (config?.uploadOnSave) {
        await uploadFile(document.uri.fsPath, config);
		vscode.window.showInformationMessage(`File uploaded: ${path.basename(document.uri.fsPath)}`);
    }
	});

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('autoUploadOnSave.uploadFile', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                await uploadFile(uri.fsPath, config);
                vscode.window.showInformationMessage(`File uploaded: ${path.basename(uri.fsPath)}`);
            }
        }),

        vscode.commands.registerCommand('autoUploadOnSave.downloadFile', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                const remotePath = path.join(config.remotePath, path.basename(uri.fsPath));
                await downloadFile(uri.fsPath, remotePath, config);
                vscode.window.showInformationMessage(`File downloaded: ${path.basename(uri.fsPath)}`);
            }
        }),

        vscode.commands.registerCommand('autoUploadOnSave.uploadFolder', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                await uploadFolder(uri.fsPath, config);
                vscode.window.showInformationMessage(`Folder uploaded: ${path.basename(uri.fsPath)}`);
            }
        }),

        vscode.commands.registerCommand('autoUploadOnSave.downloadFolder', async (uri: vscode.Uri) => {
            const config = await getConfig(uri);
            if (config) {
                const remotePath = path.join(config.remotePath, path.basename(uri.fsPath));
                await downloadFolder(uri.fsPath, remotePath, config);
                vscode.window.showInformationMessage(`Folder downloaded: ${path.basename(uri.fsPath)}`);
            }
        })
    );
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

async function uploadFile(localPath: string, config: ServerConfig) {
    const remotePath = path.join(config.remotePath, path.basename(localPath));
    await transferFile(localPath, remotePath, config, 'upload');
}

async function downloadFile(localPath: string, remotePath: string, config: ServerConfig) {
    await transferFile(localPath, remotePath, config, 'download');
}

async function transferFile(localPath: string, remotePath: string, config: ServerConfig, operation: 'upload' | 'download') {
    try {
        if (config.protocol === 'sftp') {
            const sftp = new Client();
            await sftp.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey
            });

            if (operation === 'upload') {
                await sftp.put(localPath, remotePath);
            } else {
                await sftp.get(remotePath, localPath);
            }
            await sftp.end();
        } else {
            const ftp = new FtpClient();
            await new Promise<void>((resolve, reject) => {
                ftp.on('ready', () => {
                    if (operation === 'upload') {
                        ftp.put(localPath, remotePath, (err) => {
                            if (err) {reject(err);}
                            else {resolve();}
                            ftp.end();
                        });
                    } else {
                        ftp.get(remotePath, (err, stream) => {
                            if (err) {return reject(err);}
                            stream.pipe(fs.createWriteStream(localPath))
                                .on('close', () => {
                                    resolve();
                                    ftp.end();
                                })
                                .on('error', reject);
                        });
                    }
                });
                ftp.connect({
                    host: config.host,
                    port: config.port || 21,
                    user: config.username,
                    password: config.password
                });
            });
        }
    } catch (error) {
        vscode.window.showErrorMessage(`${operation === 'upload' ? 'Upload' : 'Download'} failed: ${error}`);
    }
}

async function uploadFolder(localPath: string, config: ServerConfig) {
    try {
        if (config.protocol === 'sftp') {
            const sftp = new Client();
            await sftp.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey
            });

            await uploadDirectory(sftp, localPath, config.remotePath);
            await sftp.end();
        } else {
			await uploadFolderFtp(localPath, config);
            //vscode.window.showWarningMessage('Folder upload is currently only supported for SFTP');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Folder upload failed: ${error}`);
    }
}

async function downloadFolder(localPath: string, remotePath: string, config: ServerConfig) {
    try {
        if (config.protocol === 'sftp') {
            const sftp = new Client();
            await sftp.connect({
                host: config.host,
                port: config.port || 22,
                username: config.username,
                password: config.password,
                privateKey: config.privateKey
            });

            await downloadDirectory(sftp, remotePath, localPath);
            await sftp.end();
        } else {
			await downloadFolderFtp(remotePath, localPath, config);
            //vscode.window.showWarningMessage('Folder download is currently only supported for SFTP');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Folder download failed: ${error}`);
    }
}

async function uploadDirectory(sftp: Client, localDir: string, remoteDir: string) {
    const files = fs.readdirSync(localDir);
    
    for (const file of files) {
        const localPath = path.join(localDir, file);
        const remotePath = path.join(remoteDir, file);
        const stat = fs.statSync(localPath);

        if (stat.isDirectory()) {
            await sftp.mkdir(remotePath, true);
            await uploadDirectory(sftp, localPath, remotePath);
        } else {
            await sftp.put(localPath, remotePath);
        }
    }
}

async function downloadDirectory(sftp: Client, remoteDir: string, localDir: string) {
    if (!fs.existsSync(localDir)) {
        fs.mkdirSync(localDir, { recursive: true });
    }

    const list = await sftp.list(remoteDir);
    
    for (const item of list) {
        const remotePath = path.join(remoteDir, item.name);
        const localPath = path.join(localDir, item.name);

        if (item.type === 'd') {
            await downloadDirectory(sftp, remotePath, localPath);
        } else {
            await sftp.get(remotePath, localPath);
        }
    }
}

async function uploadFolderFtp(localPath: string, config: ServerConfig) {
    const ftp = new FtpClient();
    const remoteBase = path.join(config.remotePath, path.basename(localPath));

    await new Promise<void>((resolve, reject) => {
        ftp.on('ready', async () => {
            try {
                await createFtpDirectory(ftp, remoteBase);
                await uploadFolderContentsFtp(ftp, localPath, remoteBase);
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                ftp.end();
            }
        });
        
        ftp.connect({
            host: config.host,
            port: config.port || 21,
            user: config.username,
            password: config.password
        });
    });
}

async function downloadFolderFtp(remotePath: string, localPath: string, config: ServerConfig) {
    const ftp = new FtpClient();
    
    await new Promise<void>((resolve, reject) => {
        ftp.on('ready', async () => {
            try {
                if (!fs.existsSync(localPath)) {
                    fs.mkdirSync(localPath, { recursive: true });
                }
                
                await downloadFolderContentsFtp(ftp, remotePath, localPath);
                resolve();
            } catch (error) {
                reject(error);
            } finally {
                ftp.end();
            }
        });
        
        ftp.connect({
            host: config.host,
            port: config.port || 21,
            user: config.username,
            password: config.password
        });
    });
}

// Helper functions
async function createFtpDirectory(ftp: FtpClient, dirPath: string) {
    return new Promise<void>((resolve, reject) => {
        ftp.mkdir(dirPath, true, (err) => {
            if (err) {reject(err);}
            else {resolve();}
        });
    });
}

async function uploadFolderContentsFtp(ftp: FtpClient, localDir: string, remoteDir: string) {
    const entries = fs.readdirSync(localDir, { withFileTypes: true });
    
    for (const entry of entries) {
        const localPath = path.join(localDir, entry.name);
        const remotePath = path.join(remoteDir, entry.name);
        
        if (entry.isDirectory()) {
            await createFtpDirectory(ftp, remotePath);
            await uploadFolderContentsFtp(ftp, localPath, remotePath);
        } else {
            await new Promise<void>((resolve, reject) => {
                ftp.put(localPath, remotePath, (err) => {
                    if (err) {reject(err);}
                    else {resolve();}
                });
            });
        }
    }
}

async function downloadFolderContentsFtp(ftp: FtpClient, remoteDir: string, localDir: string) {
    return new Promise<void>((resolve, reject) => {
        ftp.list(remoteDir, async (err, list) => {
            if (err) {return reject(err);}
            
            try {
                for (const item of list) {
                    const remotePath = path.join(remoteDir, item.name);
                    const localPath = path.join(localDir, item.name);
                    
                    if (item.type === 'd') {
                        if (!fs.existsSync(localPath)) {
                            fs.mkdirSync(localPath);
                        }
                        await downloadFolderContentsFtp(ftp, remotePath, localPath);
                    } else {
                        await new Promise<void>((resolveFile, rejectFile) => {
                            ftp.get(remotePath, (err, stream) => {
                                if (err) {return rejectFile(err);}
                                stream.pipe(fs.createWriteStream(localPath))
                                    .on('close', resolveFile)
                                    .on('error', rejectFile);
                            });
                        });
                    }
                }
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    });
}

export function deactivate() {}