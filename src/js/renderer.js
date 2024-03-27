const { ipcRenderer } = require("electron");
window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

ipcRenderer.on("version", (_, ver) => {
    $("#version").text(`v${ver}`)
})

let popups = [] // emulate a stack for layered popups
let __openClickFlag = false
let managing = ""

function hitEnter(e) {
    if (!e) e = window.event
    var keyCode = e.code || e.key
    return (keyCode == 'Enter') 
}

function peek(arr) {
    if (arr.length == 0) return;
    return arr[arr.length - 1]
}

async function getAll(tabName) {
    let args = {
        "table": tabName.trim().slice(0, -1)
    }

    let d = await ipcRenderer.invoke("queryDB", "get", "all", args)
    return d
}

function switchTab(newTabDisplay) {
    let newTab = newTabDisplay.replace(" ", "-").toLowerCase()

    $(`#${newTab}`).removeClass("hidden")
    $(`.tab:not(#${newTab})`).addClass("hidden")

    if (newTab == "home") {
        $(`#return-home`).addClass("hidden")
    } else {
        $(`#return-home`).removeClass("hidden")
    }

    // change the text without overwriting the button HTML
    managing = ""
    $('#title')[0].childNodes[0].nodeValue = newTabDisplay
}

function toggleMain(bool) {
    $("#main").css("opacity", (bool) ? 1 : 0.35)
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

function toggleCollapsible(svg, hidden, bool) {
    if (bool) {
        svg.css("transform", "rotate(270deg)")
        hidden.css("display", "block")
    } else {
        svg.css("transform", "rotate(180deg)")
        hidden.css("display", "none")
    }
}

async function openAnime(event) {
    __openClickFlag = true
    let animeId = parseInt(event.target.id)

    let data
    await ipcRenderer.invoke("queryAnilist", "specifics", animeId).then(response => {
        data = response
    })

    // fill anime popup with specifics
    let popup = $("#anime-popup")[0]
    $(popup).find(".-title-disp").text(data.title)
    $(popup).find(".-desc").html(data.description)
    $(popup).find("img").attr('src', data.image)

    let genresHTML = ""
    data.genres.forEach(genre => {
        genresHTML += 
            `<div class="-selection no-highlight">
                <button class="-de-select">${genre}</button>
            </div>\n`
    })
    $(popup).find("table").find(".genres-box").find(".-select-content").html(genresHTML)

    // open
    openAsPopup(popup)
}

$(".collapsible").on("click", (event) => {
    if ($(event.target).is("input") || $(event.target).hasClass("collap-right")) {
        return
    }

    // hacky workaround to event bubbling
    setTimeout(()=> {
        if (__openClickFlag) {
            __openClickFlag = false
            return
        }
    
        let collapsible = $(event.target).closest(".collapsible")
        let hidden = collapsible.find(".hidden")
        let svg = collapsible.find(".left").find("span")
    
        if (svg.css("transform") == "matrix(-1, 0, 0, -1, 0, 0)") {
            toggleCollapsible(svg, hidden, true)
        } else {
            toggleCollapsible(svg, hidden, false)
        }
    }, 125)
})

$(".switch-tab").on("click", (event) => {
    let newTabDisplay = $(event.target).text().trim()
    switchTab(newTabDisplay)
})

$("#return-home").on("click", () => {
    switchTab("HOME")
})

$(".-search-anime-button").on("click", () => {
    openAsPopup($("#search-popup")[0])
})

$(".popup-exit").on("click", (event) => {
    closePopup($(event.target).closest(".--popup"))
})

$(".manage-btn").on("click", (event) => {
    __openClickFlag = true
    let title = $(event.target).closest(".list-tab").find(".collapsible").find(".left-c1").text().trim()

    $(`#manage-${title.toLowerCase()}`).removeClass("hidden")
    $(`.--manage-tab:not(#manage-${title.toLowerCase()})`).addClass("hidden")

    switchTab("Manage Tab")
    $('#title')[0].childNodes[0].nodeValue = `Manage ${title}`

    console.log(title)
    managing = title
})

$("#add-item").on("click", () => {
    openAsPopup($("#create-new-popup")[0])
})

$(".-addrole").on("click", async (event) => {
    openAsPopup($("#role-popup")[0])

    // load the popup with clickables
    let tbl = $(event.target).parent().parent().parent().find(".-select-title")[0].childNodes[0].nodeValue.trim().toLowerCase()
    // let content = $(event.target).parent().parent().parent().find(".-select-content")[0]
    
    if (tbl == "lists") tbl = "watchlists"

    let html = ""
    let rows = await getAll(tbl)

    rows.forEach((row) => {
        let n = row.name.toUpperCase()
        html += `<div class="-selectable no-highlight -addrole-internal" id="${tbl}$separator$${n}">${n}</div>`
    })

    $("#role-popup").find(".-content").html(html)
})

$("#create-new-popup").find(".-search-bar").on("keypress", async function (e) {
    console.log('a')

    if (!hitEnter(e)) return
    let name = `${$("#create-new-popup").find(".-search-bar").val()}`

    console.log('b')

    let args = {
        "tab": managing.trim(),
        "name": name
    }

    console.log("c", args)
    await ipcRenderer.invoke("queryDB", "create-new", args)
    console.log("d")

    let tab = `<div class="list-tab no-highlight --view-watchlist" style="color: #d7d5d5b1;">${name.toUpperCase()}</div>`

    // add to homepage, manage tab
    $("#manage-tab")[0].innerHTML += tab
    $(`#${managing.toLowerCase().trim()}-content`)[0].innerHTML += tab
})

$("#search-popup").find(".-search-bar").on("keypress", async function (e) {
    if (!hitEnter(e)) return
    let params = `${$("#search-popup").find(".-search-bar").val()}`

    if (params.trim() == "") return

    let data
    await ipcRenderer.invoke("queryAnilist", "search", params).then(response => {
        data = response
    })

    let content = $("#search-popup").find(".collap-right")[0]
    content.innerHTML = "<br>"

    // fill list with searched result titles
    data.forEach(media => {
        let el = document.createElement('div')
        el.addEventListener("click", openAnime)

        el.id = media.id
        $(el).html(media.title)
        $(el).appendTo(content)
    })

    let collapsible = $("#search-popup").find(".collapsible")
    let hidden = collapsible.find(".hidden")
    let svg = collapsible.find(".left").find("span")

    toggleCollapsible(svg, hidden, true)
})

$(document).on("click", ".-addrole-internal", function(event){
    console.log(event.target.id)
})

$(document).on("click", ".--view-watchlist", function(){
    __openClickFlag = true
    switchTab("View Watchlist")

    $('#title')[0].childNodes[0].nodeValue = `Viewing ${$(this).text()}`
})

// load data when app launches
$(async function () {
    // load each manage tab

    (["watchlists", "tags", "recommenders"]).forEach(async (tabName) => {
        let classes = (tabName == "watchlists") ? `--view-watchlist` : ""

        let html = ""
        let rows = await getAll(tabName, classes)
        rows.forEach((row) => {
            html += `<div class="list-tab no-highlight ${classes}" style="color: #d7d5d5b1;">${row.name.toUpperCase()}</div>`
        })

        $(`#manage-${tabName}`).html(html)
        $(`#${tabName}-content`).html(`<br>${html}`)
    })


})