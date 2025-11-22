# SFTP/FTP Auto Upload - VS Code Extension

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

<h1 align="center">SFTP/FTP Auto Upload</h1>
<div align="center">
    <img src="./images/logo.png">
</div>
A lightweight VS Code extension that automatically uploads files to your SFTP/FTP server when saved, with manual upload/download options for files and folders. Extension only work if you have sftp.json file under .vscode folder.

## Features ✨

- **Auto-upload on save** - Files are uploaded immediately when saved locally
- **Auto Delete on delete** - File or Folder deleted from server when deleted locally
- **Manual file operations**:
  - Upload single file (right-click → "Upload to Server")
  - Download single file (right-click → "Download from Server")
- **Folder operations** :
  - Upload entire folder recursively
  - Download entire folder recursively
  - Delete entire folder
  - On Rename file or folder, Old File will be deleted from server also
- **Multiple protocol support**:
  - SFTP (SSH File Transfer Protocol)
  - FTP (File Transfer Protocol)
- **Simple configuration** - Single JSON config file

## Installation ⚙️

1. Open VS Code extensions marketplace (`Ctrl+Shift+X`)
2. Search for "SFTP Auto Upload"
3. Click Install

## Configuration ⚙️

1. Create `.vscode/sftp.json` in your project root:
```json
{
    "protocol": "sftp",
    "host": "your-server.com",
    "port": 22,
    "username": "your-username",
    "password": "your-password",
    "privateKey": "optional/path/to/private/key",
    "remotePath": "/path/on/server",
    "uploadOnSave": true
}
```

2. Available configuration options:

| Key | Type | Description | Default |
|-----|------|-------------|---------|
| `protocol` | string | `sftp` or `ftp` | Required |
| `host` | string | Server hostname/IP | Required |
| `port` | number | Server port | 22 (SFTP), 21 (FTP) |
| `username` | string | Login username | Required |
| `password` | string | Login password (optional if using private key) | |
| `privateKey` | string | Path to private key (SFTP only) | |
| `remotePath` | string | Base path on remote server | Required |
| `uploadOnSave` | boolean | Enable auto-upload on save | false |

## Usage 🚀

### Automatic Upload
1. Set `"uploadOnSave": true` in config
2. Save any file in your project
3. File will be automatically uploaded to server

### Manual Operations
- **Right-click on a file**:
  - "Upload to Server"
  - "Download from Server"

- **Right-click on a folder** (SFTP only):
  - "Upload Folder to Server"
  - "Download Folder from Server"

## Requirements 📋
- VS Code 1.60.0 or later
- Node.js (included with VS Code)

## Known Limitations ⚠️
- Folder operations are only supported for SFTP, not FTP
- Large file transfers may require manual operation
- First-time setup requires server credentials

## Contributing 🤝
Contributions are welcome! Please open issues or pull requests on our [GitHub repository](https://github.com/sartaj-sphp/sftp-auto-upload).

## License 📄
This extension is [MIT licensed](LICENSE).

---

**Happy coding!** 🎉