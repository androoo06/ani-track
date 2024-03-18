// const { ipcRenderer } = require("electron");

window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

// ipcRenderer.on("alert", () => {
//     ipcRenderer.send("receive")
// })

$(".collapsible").find(".left").find("button").on("click", (event) => {
    let target = $(event.target)
    let hidden = target.closest(".collapsible").find(".hidden")
    
    if (target.css("transform") == "matrix(-1, 0, 0, -1, 0, 0)") {
        target.css("transform", "rotate(270deg)")
        hidden.css("display", "block")
    } else {
        target.css("transform", "rotate(180deg)")
        hidden.css("display", "none")
    }
})