const { ipcRenderer } = require("electron");

window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

// ipcRenderer.on("alert", () => {
//     ipcRenderer.send("receive")
// })

function closePopup(event) {
    $(event.target).css("display", "none")

    $("#main").css("opacity", 1)
    $("#main").css("pointer-events", "auto")
}

function openAsPopup(element) {
    $("#main").css("opacity", 0.5)
    $("#main").css("pointer-events", "none") //disable all clicking of main stuff

    $(element).css("display", "block")
}

$(".collapsible").on("click", (event) => {
    if ($(event.target).is("input")) {
        return
    }

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

//openAsPopup($("#popup-window")[0])
// $("#popup-window").on("click", closePopup)