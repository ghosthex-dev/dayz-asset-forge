import { app, BrowserWindow, dialog, ipcMain, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { createDayZBackendHandler } from '../src/server/dayzBackend';

let mainWindow: BrowserWindow | null = null;
let server: http.Server | null = null;
let serverPort = 3844;

function startEmbeddedServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
    const cacheDir = path.join(app.getPath('userData'), 'cache');
    const dayzHandler = createDayZBackendHandler(cacheDir);

    const distDir = isDev
      ? path.resolve(process.cwd(), 'dist')
      : path.join(__dirname, '..', 'dist');

    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.obj': 'text/plain; charset=utf-8',
      '.woff2': 'font/woff2',
      '.woff': 'font/woff',
      '.ttf': 'font/ttf',
    };

    server = http.createServer(async (req, res) => {
      // 1. Try DayZ API
      const handled = await dayzHandler(req, res);
      if (handled) return;

      // 2. Serve static files from dist
      const reqUrl = req.url?.split('?')[0] || '/';
      let filePath = path.join(distDir, reqUrl === '/' ? 'index.html' : reqUrl);

      // Fallback for SPA routing
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(distDir, 'index.html');
      }

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = mimeTypes[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.statusCode = 404;
        res.end('Not Found');
      }
    });

    server.listen(0, '127.0.0.1', () => {
      const addr = server?.address();
      if (addr && typeof addr === 'object') {
        serverPort = addr.port;
        console.log(`[DayZ Asset Forge] Embedded server running on http://127.0.0.1:${serverPort}`);
        resolve(serverPort);
      } else {
        resolve(3844);
      }
    });

    server.on('error', (err) => {
      console.error('Server error:', err);
      reject(err);
    });
  });
}

async function createWindow() {
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
  Menu.setApplicationMenu(null);

  const iconPath = path.join(__dirname, '..', 'public', 'icon.png');

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#09090b',
    title: 'DayZ Asset Forge',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    const port = await startEmbeddedServer();
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (server) server.close();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
