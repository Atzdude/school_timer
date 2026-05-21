const { app, BrowserWindow, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.setName('timer');

const WINDOW_STATE_FILE = 'window-state.json';
const LOAD_ERROR_LOG_FILE = 'load-errors.log';
const DEFAULT_WINDOW_STATE = {
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 560
};

function getWindowStatePath() {
    return path.join(app.getPath('userData'), WINDOW_STATE_FILE);
}

function getLoadErrorLogPath() {
    return path.join(app.getPath('userData'), LOAD_ERROR_LOG_FILE);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function logMainProcessError(context, error) {
    try {
        const message = error && error.stack ? error.stack : String(error);
        const line = `[${new Date().toISOString()}] ${context}\n${message}\n\n`;
        fs.appendFileSync(getLoadErrorLogPath(), line);
    } catch (logError) {
        // Diagnostics must never make the app fail harder.
    }
}

function showRendererFailure(window, title, detail) {
    logMainProcessError(title, detail);
    const message = detail && detail.message ? detail.message : String(detail || 'Unknown error');
    const logPath = getLoadErrorLogPath();
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>timer</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #F0F6FE; color: #1B254B; }
    main { max-width: 720px; padding: 32px; }
    h1 { margin: 0 0 12px; font-size: 28px; }
    p { line-height: 1.5; }
    code { background: #FFFFFF; border: 1px solid #D8E2F0; border-radius: 4px; padding: 2px 5px; }
  </style>
</head>
<body>
  <main>
    <h1>The timer could not open</h1>
    <p>${escapeHtml(message)}</p>
    <p>Diagnostic details were written to <code>${escapeHtml(logPath)}</code>.</p>
  </main>
</body>
</html>`;
    window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html)).catch((error) => {
        logMainProcessError('Failed to display renderer failure page', error);
    });
}

function loadWindowState() {
    try {
        const parsed = JSON.parse(fs.readFileSync(getWindowStatePath(), 'utf8'));
        const width = Number(parsed.width);
        const height = Number(parsed.height);
        if (width >= DEFAULT_WINDOW_STATE.minWidth && height >= DEFAULT_WINDOW_STATE.minHeight) {
            return {
                width: Math.round(width),
                height: Math.round(height),
                x: Number.isFinite(parsed.x) ? Math.round(parsed.x) : undefined,
                y: Number.isFinite(parsed.y) ? Math.round(parsed.y) : undefined,
                isMaximized: !!parsed.isMaximized
            };
        }
    } catch (error) {
        // Ignore missing or corrupt state and fall back to the known-good size.
    }
    return {};
}

function saveWindowState(window) {
    try {
        const bounds = window.getNormalBounds();
        const state = {
            ...bounds,
            isMaximized: window.isMaximized()
        };
        fs.writeFileSync(getWindowStatePath(), JSON.stringify(state, null, 2));
    } catch (error) {
        // Window state is a convenience only; never block closing the app.
    }
}

function createMainWindow() {
    const savedState = loadWindowState();
    const rendererPath = path.join(__dirname, 'timer_fixed_v2.html');
    const mainWindow = new BrowserWindow({
        ...DEFAULT_WINDOW_STATE,
        ...savedState,
        title: 'timer',
        autoHideMenuBar: true,
        backgroundColor: '#F0F6FE',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true
        }
    });

    if (savedState.isMaximized) {
        mainWindow.maximize();
    }

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        showRendererFailure(mainWindow, 'Renderer failed to load', `${errorCode}: ${errorDescription} (${validatedURL})`);
    });

    mainWindow.webContents.on('render-process-gone', (event, details) => {
        showRendererFailure(mainWindow, 'Renderer process exited', JSON.stringify(details));
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (level >= 2) {
            logMainProcessError('Renderer console error', `${message} at ${sourceId}:${line}`);
        }
    });

    if (!fs.existsSync(rendererPath)) {
        showRendererFailure(mainWindow, 'Renderer file missing', rendererPath);
    } else {
        mainWindow.loadFile(rendererPath).catch((error) => {
            showRendererFailure(mainWindow, 'Renderer loadFile failed', error);
        });
    }

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (!url.startsWith('file://')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    mainWindow.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && input.key === 'F11') {
            event.preventDefault();
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
        }
    });

    mainWindow.on('close', () => {
        saveWindowState(mainWindow);
    });
}

// Prevent a second instance from opening and silently corrupting localStorage.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const windows = BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const win = windows[0];
            if (win.isMinimized()) win.restore();
            win.focus();
        }
    });

    app.whenReady().then(() => {
        createMainWindow();

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) {
                createMainWindow();
            }
        });
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
