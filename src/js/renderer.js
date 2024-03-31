const { ipcRenderer } = require("electron");
window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

ipcRenderer.on("version", (_, ver) => {
    $("#version").text(`v${ver}`)
})

// begin pre-loading once database is opened
ipcRenderer.on("render", render)

let categories = ["watchlists", "tags", "recommenders"]
let popups = [] // emulate a stack for layered popups
let __openClickFlag = false
let managing = ""
let currentViewing = ""

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
    currentViewing = ""
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

function getCategory(target) {
    let tbl = $(target).parent().parent().parent().find(".-select-title")[0].childNodes[0].nodeValue.trim().toLowerCase().slice(0, -1)

    if (tbl == "list") tbl = "watchlist"
    else if (tbl == "peopl") tbl = "recommender"

    return tbl
}

function loadRoleIcons() {
    categories.forEach(async (cat) => {
        let category = cat.slice(0, -1)
        $(`#${category}-box`).find(".-select-content").html("")

        let args = {
            "animeId": $("#anime-popup").data("animeId"),
            "table": category,
            "table-content": category + "Content",
        }

        let html = ""
        let rows = await ipcRenderer.invoke("queryDB", "get", "all-in", args)
        // console.log(rows)

        rows.forEach((row) => {
            let el = `<div class="-selection -delete-role no-highlight">
                        <button class="-de-select">${row.name.toUpperCase()}</button>
                    </div>\n`
            html += el
        })

        $(`#${category}-box`).find(".-select-content").html(html)
    })
}

async function refreshViewWatchlist(table) {
    if (table === "") return;

    $('#title')[0].childNodes[0].nodeValue = `Viewing ${table}`

    let tId = await ipcRenderer.invoke("queryDB", "get", "id", { "table": "Watchlist", "name": table })

    let args = {
        "table-content": "WatchlistContent",
        "tableId": tId[0].id,
    }

    let rows = await ipcRenderer.invoke("queryDB", "get", "content", args)
    let html = ""

    let animes = []
    await Promise.all(rows.map(async (row) => {
        let data = await ipcRenderer.invoke("queryAnilist", "specifics", row.id)
        // console.log(data)
        html += `<div class="list-tab no-highlight --open-anime" id="${row.id}" style="color: #d7d5d5b1;">${data.title}</div>`
        animes.push([data.title, row.id])
    }))

    // console.log(html)
    $(`#view-watchlist-animecontent`).html(`<br>${html}`)

    fillWheel(animes)
}

async function openAnime(event) {
    __openClickFlag = true
    let animeId = parseInt(event.target.id)

    let data = await ipcRenderer.invoke("queryAnilist", "specifics", animeId)

    // fill anime popup with specifics
    let popup = $("#anime-popup")[0]
    $(popup).find(".-title-disp").text(data.title)
    $(popup).find(".-desc").html(data.description)
    $(popup).find("img").attr('src', data.image)
    $(popup).data("animeId", animeId)

    let genresHTML = ""
    data.genres.forEach(genre => {
        genresHTML +=
            `<div class="-selection no-highlight">
                <button class="-de-select">${genre}</button>
            </div>\n`
    })
    $("#genre-box").find(".-select-content").html(genresHTML)

    // preload existing role icons
    loadRoleIcons()

    // open
    openAsPopup(popup)
}

async function loadCategory(tabName) {
    let classes = (tabName == "watchlists") ? `--view-watchlist` : ""

    let html = ""
    let rows = await getAll(tabName)
    rows.forEach((row) => {
        html += `<div class="list-tab no-highlight ${classes}" style="color: #d7d5d5b1;">${row.name.toUpperCase()}</div>`
    })

    $(`#manage-${tabName}`).html(html)
    $(`#${tabName}-content`).html(`<br>${html}`)
}

async function loadCurrentlyWatching() {
    let html = ""
    let rows = await ipcRenderer.invoke("queryDB", "get", "watching", {})
    await Promise.all(rows.map(async (row) => {
        let data = await ipcRenderer.invoke("queryAnilist", "specifics", row.id)
        html += `<div id="${row.id}" class="list-tab no-highlight --open-anime" style="color: #d7d5d5b1;">${data.title.toUpperCase()}</div>`
    }))

    $(`#watching-content`).html(`<br>${html}`)
}

$(".collapsible").on("click", (event) => {
    if ($(event.target).is("input") || $(event.target).hasClass("collap-right")) {
        return
    }

    // hacky workaround to event bubbling
    setTimeout(() => {
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

    // console.log(title)
    managing = title
})

$("#add-item").on("click", () => {
    openAsPopup($("#create-new-popup")[0])
})

$(".-addrole").on("click", async (event) => {
    $("#role-popup").find(".-content").html("")
    openAsPopup($("#role-popup")[0])

    // load the popup with clickables
    let tbl = getCategory(event.target)

    let args = {
        "table": tbl,
        "table-content": `${tbl}Content`,
        "animeId": $("#anime-popup").data("animeId")
    }

    let html = ""
    let rows = await ipcRenderer.invoke("queryDB", "get", "all-except", args)

    rows.forEach((row) => {
        let n = row.name.toUpperCase()
        html += `<div class="-selectable no-highlight -addrole-internal" id="${tbl}$separator$${n}$separator$${row.id}$separator$${args.animeId}">${n}</div>`
    })

    $("#role-popup").find(".-content").html(html)
})

$("#start-anime").on("click", async () => {
    let animeId = $("#wheel-popup").data("animeId")

    let args = {
        "property": "watching",
        "value": "1",
        "animeId": animeId
    }

    await ipcRenderer.invoke("queryDB", "ud", "update", args)
    await ipcRenderer.invoke("queryDB", "ud", "delete-watchlist-animes", args)

    refreshViewWatchlist(currentViewing)
    loadCurrentlyWatching()

    closePopup($("#wheel-popup")[0])
})

$(document).on("click", ".-delete-role", async function (event) {
    let tbl = getCategory(event.target)

    let txt = $(event.target).text().trim().toUpperCase()
    let id = await ipcRenderer.invoke("queryDB", "get", "id", { "table": tbl, "name": txt })

    let animeId = $("#anime-popup").data("animeId")

    if (id.length > 0) {
        let args = {
            "table": tbl + "Content",
            "animeId": animeId,
            "id": id[0].id
        }

        await ipcRenderer.invoke("queryDB", "ud", "delete-content", args)
        // let existsRows = await ipcRenderer.invoke("queryDB", "get", "exists", args)
        // console.log(existsRows)
        // let exists = existsRows.length > 0

        // if (!exists) {
        //     let args2 = {
        //         "table": "Anime",
        //         "id": animeId,
        //     }
        //     await ipcRenderer.invoke("queryDB", "ud", "delete-main", args2)
        // }

        $(event.target).remove()
        loadRoleIcons()
        refreshViewWatchlist(currentViewing)
    }
})

$(document).on("click", ".-addrole-internal", async function (event) {
    let [category, value, categoryId, animeId] = event.target.id.split("$separator$")

    let args1 = { "animeId": animeId }
    await ipcRenderer.invoke("queryDB", "insert", "anime", args1)

    let args2 = {
        "table-content": `${category}Content`,
        "id": categoryId,
        "animeId": animeId
    }

    let data = await ipcRenderer.invoke("queryDB", "get", "exact", args2)
    console.log(data)

    if (data.length == 0) {
        console.log("not found, adding")

        await ipcRenderer.invoke("queryDB", "insert", "content", args2)
        loadRoleIcons()
        refreshViewWatchlist(currentViewing)

        closePopup($("#role-popup"))
    } else {
        console.log("found, not adding")
    }
})

$(document).on("click", ".--view-watchlist", async function () {
    __openClickFlag = true
    switchTab("View Watchlist")

    let table = $(this).text().trim().toUpperCase()
    currentViewing = table
    refreshViewWatchlist(table)
})

$(document).on("click", ".--open-anime", openAnime)

$("#create-new-popup").find(".-search-bar").on("keypress", async function (e) {
    if (!hitEnter(e)) return
    let name = `${$("#create-new-popup").find(".-search-bar").val().trim().toUpperCase()}`

    let args = {
        "table": managing.trim().slice(0, -1),
        "name": name
    }

    await ipcRenderer.invoke("queryDB", "insert", "element", args)

    let tab = `<div class="list-tab no-highlight --view-watchlist" style="color: #d7d5d5b1;">${name}</div>`

    // add to homepage, manage tab
    $("#manage-tab")[0].innerHTML += tab
    $(`#${managing.toLowerCase().trim()}-content`)[0].innerHTML += tab
})

$("#search-popup").find(".-search-bar").on("keypress", async function (e) {
    if (!hitEnter(e)) return
    let params = `${$("#search-popup").find(".-search-bar").val()}`

    if (params.trim() == "") return

    let data = await ipcRenderer.invoke("queryAnilist", "search", params)

    let content = $("#search-popup").find(".collap-right")
    // fill list with searched result titles
    let html = ""
    data.forEach(media => {
        // let el = document.createElement('div')
        // el.addEventListener("click", openAnime)

        // el.id = media.id
        // $(el).html(media.title)
        // $(el).appendTo(content)

        html += `<div class="--open-anime" id="${media.id}">${media.title}</div>`
    })
    content.html(`<br>${html}`)

    let collapsible = $("#search-popup").find(".collapsible")
    let hidden = collapsible.find(".hidden")
    let svg = collapsible.find(".left").find("span")

    toggleCollapsible(svg, hidden, true)
})

// load data when app launches
function render() {
    // load each manage tab
    (categories).forEach(async (tabName) => {
        loadCategory(tabName)
    })

     // load currently watching
     loadCurrentlyWatching()
}