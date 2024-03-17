const { app, BrowserWindow, dialog, ipcMain, globalShortcut } = require('electron')

const createWindow = () => {
    root = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    })

    root.loadFile('src/app.html')
    root.removeMenu()
}

app.whenReady().then(createWindow)