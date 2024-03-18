// const { ipcRenderer } = require("electron");

window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

// ipcRenderer.on("alert", () => {
//     ipcRenderer.send("receive")
// })

$(".collapsible").on("click", (event) => {
    let collapsible = $(event.target).closest(".collapsible")
    let hidden = collapsible.find(".hidden")
    let svg = collapsible.find(".left").find("span")

    if (svg.css("transform") == "matrix(-1, 0, 0, -1, 0, 0)") {
        svg.css("transform", "rotate(270deg)")
        hidden.css("display", "block")
    } else {
        svg.css("transform", "rotate(180deg)")
        hidden.css("display", "none")
    }
})