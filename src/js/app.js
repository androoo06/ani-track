const { app, BrowserWindow, ipcMain, globalShortcut, shell } = require('electron')
const { autoUpdater } = require("electron-updater")
const db = require("./dbManager")
const anilist = require("./anilist")
const path = require('path')

let projectRoot = path.dirname(__dirname).replace("app.asar", "")
let root = null;

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

    root.webContents.once('dom-ready', async () => {
        sendVersion()
        db.init()
    })

    root.on('close', function (e) {
        db.close()
    })

    root.loadFile('src/app.html')
    root.removeMenu()

    root.maximize()

    // developer hotkeys
    globalShortcut.register('f9', () => {
        root.webContents.openDevTools()
    })

    globalShortcut.register('f8', () => {
        shell.openPath(projectRoot)
    })
}

app.whenReady().then(createWindow)

// bridge renderer to database
ipcMain.handle("select", async (_, args) => {
    return await db.queries.select(args)
})

ipcMain.on("create-new", (_, args) => {
    db.queries['create-new'](args)
})

// bridge renderer to anilist
ipcMain.handle("search-anilist", async (_, _str) => {
    return await anilist.search(_str)
})

ipcMain.handle("anilist-specific", async (_, id) => {
    return await anilist.getSuperSpecifics(id)
})

// auto updater
autoUpdater.allowPrerelease = false
autoUpdater.allowDowngrade = false

autoUpdater.on("update-downloaded", sendVersion)
autoUpdater.on("error", (info) => {
    console.log('err')
    root.webContents.send("version", `Error occurred: ${info}`)
})