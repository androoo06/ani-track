const { app, BrowserWindow, dialog, ipcMain, globalShortcut } = require('electron')
const { autoUpdater } = require("electron-updater")

// const anilist = require('anilist-node');
// const Anilist = new anilist();

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

    root.webContents.once('dom-ready', () => {
        root.webContents.openDevTools() // for the console stuff

        
    })

    root.loadFile('src/app.html')
    root.removeMenu()

    root.maximize()
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