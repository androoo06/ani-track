const { ipcRenderer } = require("electron");
window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

ipcRenderer.on("version", (_, ver) => {
    $("#version").text(`v${ver}`)
})

let openTab = "home"
let popups = [] // emulate a stack

function peek(arr) {
    if (arr.length == 0) return;
    return arr[arr.length - 1]
}

function switchTab(event, manage=false) {
    let newTab, newTabDisplay
    if (manage == false) {
        newTabDisplay = $(event.target).text().trim()
        newTab = newTabDisplay.replace(" ", "-").toLowerCase()
    } else {
        newTabDisplay = `MANAGE ${event}`
        newTab = "manage-tab"
    }

    $(`#${newTab}`).toggleClass("hidden")
    $(`#${openTab}`).toggleClass("hidden")
    
    openTab = newTab

    if (newTab == "home") {
        $(`#return-home`).addClass("hidden")
    } else {
        $(`#return-home`).removeClass("hidden")
    }

    $('#title')[0].childNodes[0].nodeValue = newTabDisplay
}

function toggleMain(bool) {
    $("#main").css("opacity", (bool) ? 1 : 0.5)
    $("#main").css("pointer-events", (bool) ? "auto" : "none")
}

function closePopup(element) {
    $(element).css("display", "none")
    popups.pop()

    // open previous popup
    let existing = peek(popups)
    if (existing) {
        $(existing).css("display", "block")
    } else {
        toggleMain(true)
    }
}

function openAsPopup(element) {
    $(element).css("display", "block")
    toggleMain(false)

    // hide existing popup
    let existing = peek(popups)
    if (existing) {
        $(existing).css("display", "none")
    }

    popups.push(element)
}

$(".collapsible").on("click", (event) => {
    if ($(event.target).is("input")) {
        return
    }

    // add check to make sure it's not a child element thats being clicked
    // either, ONLY the "left" classed elements (not "hidden")

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

$(".switch-tab").on("click", switchTab)

$("#return-home").on("click", () => {
    switchTab({"target": $("#go-home")[0]})
})

$(".-search-anime-button").on("click", () => {
    openAsPopup($("#search-popup")[0])
})

$(".popup-exit").on("click", (event) => {
    closePopup($(event.target).closest(".--popup"))
})

$(".manage-btn").on("click", (event) => {
    let title = $(event.target).closest(".list-tab").find(".collapsible").find(".left-c1").text()
    switchTab(title, manage=true)
})

$("#add-item").on("click", () => {
    openAsPopup($("#create-new-popup")[0])
})

$(".-addrole").on("click", () => {
    openAsPopup($("#role-popup")[0])
})

// openAsPopup($("#anime-popup")[0])