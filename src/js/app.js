const { app, BrowserWindow, dialog, ipcMain, globalShortcut } = require('electron')
const { autoUpdater } = require("electron-updater")
const db = require("./dbManager")

// const anilist = require('anilist-node');
// const Anilist = new anilist();

let root = null;

autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false

function wrapMessage(channel, data) {
    root.webContents.send(channel, data)
}

function sendVersion() {
    wrapMessage("version", app.getVersion())
}

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
        
        sendVersion()
        db.init()
    })

    root.on('close', function (e) {
        db.close()
    })

    root.loadFile('src/app.html')
    root.removeMenu()

    root.maximize()
}

app.whenReady().then(createWindow)

ipcMain.on("wrap-message", wrapMessage)

autoUpdater.on("update-downloaded", sendVersion)

autoUpdater.on("error", (info) => {
    console.log('err')
    root.webContents.send("version", `Error occurred: ${info}`)
})