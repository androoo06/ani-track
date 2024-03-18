const { ipcRenderer } = require("electron");

window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

ipcRenderer.on("alert", () => {
    ipcRenderer.send("receive")
})