const { ipcRenderer, clipboard, shell } = require("electron");

ipcRenderer.on("alert", () => {
    alert("RAh")
    ipcRenderer.send("receive")
})