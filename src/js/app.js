const { app, BrowserWindow, dialog, ipcMain, globalShortcut } = require('electron')
const { autoUpdater } = require("electron-updater")

let root = null;

autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false

const createWindow = () => {
    if (BrowserWindow.getAllWindows().length !== 0) {
        return
    }

    root = new BrowserWindow({
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
        },
    })

    root.loadFile('src/app.html')
    root.removeMenu()

    root.webContents.once('dom-ready', () => {
        console.log('e')
        root.webContents.send("alert")
    })
}

app.whenReady().then(createWindow)

ipcMain.on("receive", () => {
    console.log("received")
})

autoUpdater.on("update-downloaded", () => {
    root.webContents.send("version", `${app.getVersion()} - quit to install update`)
})

autoUpdater.on("error", (info) => {
    console.log('err')
    root.webContents.send("version", `Error occurred: ${info}`)
})