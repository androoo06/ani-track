const { ipcRenderer } = require("electron");
const { watch } = require("original-fs");
const { Chart } = require('chart.js/auto');

window.$ = window.jQuery = require('../node_modules/jquery/dist/jquery.min.js');

ipcRenderer.on("version", (_, ver) => {
    $("#version").text(`v${ver}`)
})

// begin pre-loading once database is opened
ipcRenderer.on("render", render)

let categories = ["watchlists", "tags", "recommenders"]
let popups = [] // emulate a stack for layered popups
// let __openClickFlag = false
let managing = ""
let currentViewing = ""
let o4 = 0.35
let t4 = 0.65
let currentRating = 0
let watchCodes = ["NOT WATCHING", "CURRENTLY WATCHING", "COMPLETED"] // [ 0 , 1 , 2]
let opening = false
let filters = {
    genres: [],
    tags: [],
    __tagIds: [],
    "min-rating": null,
    "max-rating": null,
    watchcode: -1,
    name: "",
}

// https://gist.github.com/mucar/3898821
let colors = ['#FF6633', '#FFB399', '#FF33FF', '#FFFF99', '#00B3E6', 
    '#E6B333', '#3366E6', '#999966', '#99FF99', '#B34D4D',
    '#80B300', '#809900', '#E6B3B3', '#6680B3', '#66991A', 
    '#FF99E6', '#CCFF1A', '#FF1A66', '#E6331A', '#33FFCC',
    '#66994D', '#B366CC', '#4D8000', '#B33300', '#CC80CC', 
    '#66664D', '#991AFF', '#E666FF', '#4DB3FF', '#1AB399',
    '#E666B3', '#33991A', '#CC9999', '#B3B31A', '#00E680', 
    '#4D8066', '#809980', '#E6FF80', '#1AFF33', '#999933',
    '#FF3380', '#CCCC00', '#66E64D', '#4D80CC', '#9900B3', 
    '#E64D66', '#4DB380', '#FF4D4D', '#99E6E6', '#6666FF'];

let charts = {}

// genres that appear in anilist
let genres = {
    "ac": "ACTION",
    "ad": "ADVENTURE",
    "co": "COMEDY",
    "dr": "DRAMA", 
    "ec": "ECCHI",
    "fa": "FANTASY",
    "he": "HENTAI",
    "ho": "HORROR",
    "ma": "MAHOU SHOUJO",
    "me": "MECHA",
    "mu": "MUSIC",
    "my": "MYSTERY",
    "ps": "PSYCHOLOGICAL",
    "ro": "ROMANCE",
    "sc": "SCI-FI",
    "sl": "SLICE OF LIFE",
    "sp": "SPORTS",
    "su": "SUPERNATURAL",
    "th": "THRILLER"
}

function encodeGenres(arr) {
    let _str = ""

    arr.forEach(genre => {
        let debug = "$noword$"
        for (abbrev in genres) {
            if (genres[abbrev].toLowerCase() === genre.toLowerCase()) {
                _str += `${abbrev}.`
                debug = "$word$"
                break
            }

            if (debug === "$noword") {
                console.log("can't find translation for abbrev", abbrev)
            }
        }
    })

    return _str.slice(0, -1)
}

function decodeGenres(_str) {
    let arr = []
    _str.split(".").forEach(abbrev => {
        arr.push(genres[abbrev])
    })
    return arr
}

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

    loadDataTab() // lol, could have it after every single thing is rendered but this is a bit easier

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

async function loadAnimeStatuses(animeId) {
    let popup = $("#anime-popup")

    let watchCode = await ipcRenderer.invoke("queryDB", "get", "watch-code", {id: animeId})
    if (watchCode.length > 0) {
        $(popup).find(".-watching").text(watchCodes[watchCode[0].watching || 0])
    } else {
        $(popup).find(".-watching").text(watchCodes[0])
    }

    let rating = await ipcRenderer.invoke("queryDB", "get", "rating", {id: animeId})
    if (rating.length > 0 && rating[0].rating != null && rating[0].rating > 0) {
        popup.find("#rated-label").addClass("hidden")
        popup.find("span:not(#rated-label)").removeClass("hidden").html(`★<span style="color: yellow">${rating[0].rating}</span>/10`)

        $("#rating-middle").css("left", `${rating[0].rating * 10}%`)
    } else {
        popup.find("#rated-label").removeClass("hidden")
        popup.find("span:not(#rated-label)").addClass("hidden")
    }
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
        if (data) {
            // console.log(data)
            html += `<div class="list-tab no-highlight --open-anime" id="${row.id}" style="color: #d7d5d5b1;">${data.title}</div>`
            animes.push([data.title, row.id])
        } 
    }))

    $(`#view-watchlist-animecontent`).html(`<br>${html}`)

    fillWheel(animes)
}

async function openAnime(event) {
    if (opening) return
    opening = true

    event.stopPropagation()
    // __openClickFlag = true
    let animeId = parseInt(event.target.id)

    let data = await ipcRenderer.invoke("queryAnilist", "specifics", animeId)
    if (!data) {
        opening = false
        return
    }

    // fill anime popup with specifics
    let popup = $("#anime-popup")[0]
    $(popup).find(".-title-disp").text(data.title)
    $(popup).find(".-desc").html(data.description)
    $(popup).find("img").attr('src', data.image)
    $(popup).data("animeId", animeId)
    $(popup).data("genres", encodeGenres(data.genres))

    let genresHTML = ""
    data.genres.forEach(genre => {
        genresHTML +=
            `<div class="-selection no-highlight">
                <button class="-de-select">${genre}</button>
            </div>\n`
    })
    $("#genre-box").find(".-select-content").html(genresHTML)

    // load watching and rating status
    await loadAnimeStatuses(animeId)
    
    // preload existing role icons
    loadRoleIcons()

    // open
    openAsPopup(popup)
    opening = false
}

async function loadCategory(tabName) {
    let classes = (tabName == "watchlists") ? `--view-watchlist` : ""
    let secondaryClass = (tabName == "watchlists") ? `--view-watchlist-manage` : ""

    let html = "", html2 = ""
    let rows = await getAll(tabName)
    rows.forEach((row) => {
        html += `<div class="list-tab no-highlight ${classes}" style="color: #d7d5d5b1;">${row.name.toUpperCase()}</div>`
        html2 += `<div class="list-tab no-highlight ${classes} ${secondaryClass}" style="color: #d7d5d5b1;">${row.name.toUpperCase()}</div>`
    })

    $(`#manage-${tabName}`).html(html2)
    $(`#${tabName}-content`).html(`<br>${html}`)
}

async function loadCurrentlyWatching() {
    let html = ""
    let rows = await ipcRenderer.invoke("queryDB", "get", "watching", {"watchCode": 1})
    await Promise.all(rows.map(async (row) => {
        let data = await ipcRenderer.invoke("queryAnilist", "specifics", row.id)
        if (data) {
            html += `<div id="${row.id}" class="list-tab no-highlight --open-anime" style="color: #d7d5d5b1;">${data.title.toUpperCase()}</div>`
        }
    }))

    $(`#watching-content`).html(`<br>${html}`)
}

function roundToQuarter(number) {
    if (number < 0.2) return 0
    if (number < o4) return 0.25
    if (number < 0.5) return 0.5
    if (number < t4) return 0.75
    return 1
}

function fixPercent(n) {
    if (n == 0.25) return o4
    if (n == 0.75) return t4

    return n
}

function moveBar(e, target) {
    var rect = target.getBoundingClientRect()
    var x = e.clientX - rect.left //x position within the element

    let rawPercent = x/rect.width
    let roundedPercent = roundToQuarter(rawPercent)
    let finalPercent = fixPercent(roundedPercent) * 10
    
    let rawShift = parseInt(target.getAttribute("data-index"))
    let scaledShift = rawShift * 10
    let finalShift = scaledShift + finalPercent

    currentRating = roundedPercent + rawShift
    $("#rating-middle").css("left", `${finalShift}%`)
}

function connectRatePopup(e) {
    let target = document.elementFromPoint(e.clientX, e.clientY)
    if (target.nodeName == "IMG" && target.classList.contains("outlined")) {
        moveBar(e, target)
    }
}

function updateHistoryContent(filterCategory) {
    let content = $(`#history-${filterCategory}-content`)
    let html = ""

    filters[filterCategory].forEach(filter => {
        html += `<div class="-selection -delete-history-role no-highlight">
                     <button class="-de-select">${filter.trim()}</button>
                 </div>&thinsp;`
    })

    content.html(html)
}

function filterName(rows, name) {
    let filtered = []
    for (i in rows) {
        let _str = rows[i]
        if (_str.toLowerCase().search(name.toLowerCase()) > -1) {
            filtered.push(_str)
        }
    }

    return filtered
}

function getFilterQuery(filtersOverride = filters) {
    let queryStr = ""

    let validWatchcode = (filtersOverride.watchcode >= 0 && filtersOverride.watchcode <= 2);
    let validMinRating = filtersOverride['min-rating'] !== null;
    let validMaxRating = filtersOverride['max-rating'] !== null;

    // generate filters query (min/max rating, tags)    
    if (filtersOverride.__tagIds.length > 0) {
        queryStr += "SELECT animeId FROM TagContent t WHERE "
        
        for (ti in filtersOverride.__tagIds) {
            queryStr += `t.id = ${filtersOverride.__tagIds[ti]} OR `
        }
        
        queryStr = queryStr.slice(0, -4)
        
        if (validMinRating || validMaxRating || validWatchcode) {
            queryStr += " UNION SELECT id FROM Anime a WHERE "
        }
    } else{
        queryStr += "SELECT id FROM Anime a"

        if (validMinRating || validMaxRating || validWatchcode) {
            queryStr += " WHERE "
        }
    }

    if (validMinRating) {
        queryStr += `a.rating >= ${filtersOverride['min-rating']}`
    }

    if (validMinRating && validMaxRating) {
        queryStr += " AND "
    }

    if (validMaxRating) {
        queryStr += `a.rating <= ${filtersOverride['max-rating']}`
    }

    // the reason to separate the " AND " from the actual querystring is the case where the AND is not needed (ex. the watchcode is the only filter parameter)
    if ((validMinRating || validMaxRating) && validWatchcode) {
        queryStr += ` AND `
    }

    if (validWatchcode) {
        queryStr += `a.watching = ${filtersOverride.watchcode}`
    }

    return queryStr
}

function openWatchlist(event) {
    event.stopPropagation()
    switchTab("View Watchlist")

    let table = $(event.target).text().trim().toUpperCase()
    currentViewing = table
    refreshViewWatchlist(table)
}

function updatePieChart(name, inData) {
    const data = {
        labels: Object.keys(inData),
        datasets: [{
          label: `${name.toUpperCase()} BREAKDOWN`,
          data: Object.values(inData),
          backgroundColor: colors,
          hoverOffset: 4
        }]
      };

    let updateFlag = true;
    const chart = charts[name] || (function () {
        updateFlag = false;
        return new Chart($(`#${name.toLowerCase()}-breakdown`).find("canvas"), {
            type: 'pie',
            data: data,
            options: {
                responsive: false,
                maintainAspectRatio: false,
            }
        });        
    })()


    charts[name] = chart
    chart.data = data

    if (updateFlag) chart.update()
    // console.log("----------------")
    // console.log(name)
    // console.log(inData)
    // console.log(data)
    // console.log("----------------")
    // chart.update()
}

async function getTblCount(tblName, rows) {
    let tblConversions = {} // to go from ID to Name (store here to make less calls to the DB)
    let outData = {}

    // foreach animeId in rows
    //  get all ids from tblName-Content where animeId=animeId
    //  tally names in outData (get names too lol)

    for (let i=0; i<rows.length; i++) {

        let anime = rows[i]
        let tblIds = await ipcRenderer.invoke("queryDB", "get", "exact", {
            "table-content": `${tblName}Content`,
            "id": `-1 OR 1=1`,
            "animeId": anime.id
        })

        for (let j=0; j<tblIds.length; j++) {
            let content = tblIds[j]
            
            let str = tblConversions[content.id]
            if (str == null) {
                let names = await ipcRenderer.invoke("queryDB", "get", "name", {"table": tblName, "id": content.id})
                tblConversions[content.id] = names[0].name
                str = names[0].name
            }
            
            if (str != null) {
                outData[str] = (outData[str] || 0) + 1
            } else {
                console.log("null value for tagConversion id")
            }

        }

    }

    updatePieChart(tblName, outData)
}

async function getGenreCount() {
    let outData = {}

    // for (const [_, genre] of Object.entries(genres)) {
    //     outData[genre] = 0
    // }

    let rows = await ipcRenderer.invoke("queryDB", "get", "all", {"table": `Anime`})
    await Promise.all(rows.map(async (row) => {
        if (row.watching == 2) {
            let decoded = decodeGenres(row.genres)
            decoded.forEach(genre => {
                if (outData[genre] != null) {
                    outData[genre]++;
                } else {
                    outData[genre] = 1
                }
            })
        }
    }))

    updatePieChart("Genre", outData)
}

async function loadDataTab() {

    let watched = await ipcRenderer.invoke("queryDB", "get", "watching", {"watchCode": 2});

    // total completed
    let totalCompleted = watched.length
    $("#total-anime-completed").text(`Total Anime Completed: ${totalCompleted}`)

    // average star rating (for completed, rated animes, this is the average star rating out of 10)
    let starQuery = getFilterQuery({
        genres: [],
        tags: [],
        __tagIds: [],
        "min-rating": 0, // main point of this query
        "max-rating": null,
        watchcode: 2, // second main point of this query
        name: "",
    })

    let args = {
        filterProperties: starQuery
    }

    let totalRating = 0
    let animeRows = await ipcRenderer.invoke("queryDB", "get", "filtered", args)
    animeRows.forEach(row => {
        totalRating += row.rating
    })
    let averageRating = totalRating / animeRows.length
    $("#average-star-rating").text(`Average Star Rating: ${averageRating}`)

    // recommenders dropdowns
    let recommenders = await ipcRenderer.invoke("queryDB", "get", "all", {table: "Recommender"})
    for (let i=0; i<recommenders.length; i++) {
        let r = recommenders[i]
        let animes = await ipcRenderer.invoke("queryDB", "get", "recommended", {id: r.id})

        let total = animes.length;
        let totalStars = 0;

        let options = ""
        for (let j=0; j<animes.length; j++) {
            let a = animes[j]
            
            // skip non-completed animes for this display  
            if (a.watching != 2) {
                total -=1; continue
            }           

            if (a.rating == null) {
                total -= 1
            } else {
                totalStars += a.rating
            }

            let data = await ipcRenderer.invoke("queryAnilist", "specifics", a.id)
            options += `<div id="${a.id}" class="list-tab no-highlight --open-anime" style="color: #d7d5d5b1;">${data.title.toUpperCase()}</div>`
        }

        let collapsible = 
            `<div class="collapsible recommender-collapsible no-highlight" id="recommended-content-${r.name}">
                <div class="left">
                    <div class="left-c1">
                        ${r.name}  <mark class="rec-rating-span">(${totalStars}/${total}) = ${totalStars/total}</mark>
                    </div>
                    <span></span>
                </div>
                <div class="collap-right hidden">
                    <br>${options}
                </div>
            </div>`

        $("#recommender-stats").html(collapsible)
    }

    // breakdown charts
    getTblCount("Tag", watched)
    getTblCount("Recommender", watched)
    getGenreCount() //different behavior than the above two
}

$(".-watching").on("click", () => {
    openAsPopup($("#watching-popup"))
})

$(".-rating").on("click", () => {
    let title = $("#anime-popup").find(".-title-disp").text()
    $("#rating-title").find("span").text(title)
    openAsPopup($("#rating-popup"))

    // connected to .outlined click event 
    document.addEventListener('mousemove', connectRatePopup, {passive: false})
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
    // __openClickFlag = true
    event.stopPropagation()

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

$(".-addrole").on("click", () => {
    $("#role-popup").find(".-content").html("")
    openAsPopup($("#role-popup")[0])
})

$(".-ap-role").on("click", async (event) => {
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

    $("#role-popup").find(".-title").text(tbl.toUpperCase() + "S")
    $("#role-popup").find(".-content").html(html)
})

$(".-history-role").on("click", async (event) => {
    let category = $(event.target).closest(".-select-title")[0].childNodes[0].nodeValue.trim()

    let rows = []
    if (category === "Genres") {
        // get all from existing dict
        for (abbrev in genres) rows.push(genres[abbrev])
    } else if (category == "Tags") {
        // get all tags from tagContent
        let queryRows = await ipcRenderer.invoke("queryDB", "get", "all", {"table": "Tag"})
        console.log(queryRows)
        queryRows.forEach(row => {
            rows.push(row.name)
        })
    }

    let html = ""
    rows.forEach((row) => {
        html += `<div class="-selectable no-highlight -add-filter-role" data-filtertype="${category}">${row.toUpperCase()}</div>`
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

$(".-watch-code").on("click", async (event) => {
    let index = parseInt($(event.target).data("index"))
    console.log(index)

    let animeId = $("#anime-popup").data("animeId")
    let animeGenres = $("#anime-popup").data("genres")

    let args0 = { "animeId": animeId, "genres": animeGenres }
    await ipcRenderer.invoke("queryDB", "insert", "anime", args0)

    let args = {
        "animeId": animeId, 
        "property": "watching",
        "value": index
    }
    
    await ipcRenderer.invoke("queryDB", "ud", "update", args)
    console.log('shoulda updated')
    await loadAnimeStatuses(animeId)
    await loadCurrentlyWatching()

    closePopup("#watching-popup")
})

$("#apply-filters").on("click", async (event) => {
    // console.log(filters)

    let queryStr = getFilterQuery()
    console.log(queryStr)

    let args = {
        filterProperties: queryStr
    }

    // console.log(queryStr)
    let animeRows = await ipcRenderer.invoke("queryDB", "get", "filtered", args)

    // add filter by genres
    let filtered = []
    animeRows.forEach(row => {
        let _genres = decodeGenres(row.genres)

        if (filters.genres.length === 0) {
            filtered.push(row.id)
        } else {
            for (i in _genres) {
                if (filters.genres.includes(_genres[i])) {
                    filtered.push(row.id)
                    break
                }
            }
        }
    })
    
    let cache = {}

    let nameFiltered = []
    await Promise.all(filtered.map(async (id) => {
        let data = await ipcRenderer.invoke("queryAnilist", "specifics", id)
        if (data) {
            nameFiltered.push(data.title)
            cache[data.title.toLowerCase()] = id
        }
    }))
    // console.log(nameFiltered)

    // add filter by the name search
    nameFiltered = filterName(nameFiltered, filters.name)
    // console.log(nameFiltered)

    let html = ""
    nameFiltered.forEach(name => {
        let id = cache[name.toLowerCase()]
        html += `<div class="list-tab no-highlight --open-anime" id="${id}" style="color: #d7d5d5b1;">${name}</div>`
    })

    $("#filter-results").html(html)
})

$(".-rating-filter").on("propertychange change keyup paste input", async function (event) {
    let n = parseInt(event.target.value)
    filters[event.target.id] = isNaN(n) ? null : n
})

$(".-history-name-filter").on("propertychange change keyup paste input", async function (e) {
    console.log('e')
    filters.name = $(e.target).val().trim().toLowerCase()
})

$(".-watchcode-filter").on("propertychange change keyup paste input", async function (e) {
    let n = parseInt(e.target.value)
    filters.watchcode = isNaN(n) ? -1 : n
})

$("#-recommender-filter").on("propertychange change keyup paste input", async function (e) {
    let txt = e.target.value

    let unfiltered = []
    $(".recommender-collapsible").each(function(i) {
        let el = $(this)
        let recName = el.attr('id').split("-")[2]
        unfiltered.push(recName)

        let hidden = el.find(".hidden")
        let svg = el.find(".left").find("span")
        toggleCollapsible(svg, hidden, false)

        el.hide()
    })

    let filtered = filterName(unfiltered, txt)
    $(".recommender-collapsible").each(function(i) {
        let el = $(this)
        let recName = el.attr('id').split("-")[2]
        if (filtered.includes(recName)) {
            el.show()
        }
    })
})

$(document).on("click", ".collapsible", function (event) {
    let target = $(event.target)

    if (target.is("input") || target.hasClass("collap-right")) {
        return
    }

    if (target.hasClass("--view-watchlist")) {
        openWatchlist(event)
    } else if (target.hasClass("--open-anime")) {
        return
    } else {
        let collapsible = $(event.target).closest(".collapsible")
        let hidden = collapsible.find(".hidden")
        let svg = collapsible.find(".left").find("span")

        if (svg.css("transform") == "matrix(-1, 0, 0, -1, 0, 0)") {
            toggleCollapsible(svg, hidden, true)
        } else {
            toggleCollapsible(svg, hidden, false)
        }
    }    
})

$(document).on("click", ".--view-watchlist-manage", openWatchlist)

$(document).on("click", ".-add-filter-role", async function (event) {
    let txt = $(event.target).text().trim()
    let filterCategory = $(event.target).data("filtertype").toLowerCase()
    
    filters[filterCategory].push(txt)

    if (filterCategory == "tags") {
        let id = await ipcRenderer.invoke("queryDB", "get", "id", {table: "Tag", name: txt})
        filters.__tagIds.push(id[0].id)
    }

    updateHistoryContent(filterCategory)
})

$(document).on("click", ".-delete-history-role", async (event) => {
    let filterCategory = $(event.target).closest("th").find(".-select-title")[0].childNodes[0].nodeValue.trim().toLowerCase()
    let txt = $(event.target).text()

    const index = filters[filterCategory].indexOf(txt)
    filters[filterCategory].splice(index, 1)

    if (filterCategory === "tags") {
        filters.__tagIds.splice(index, 1)
    }

    $(event.target).remove()
    updateHistoryContent(filterCategory)
})

$(document).on("click", ".outlined", async function() {
    // connected to  .-rating click event
    document.removeEventListener("mousemove", connectRatePopup, { passive: false })
    closePopup($("#rating-popup"))

    // update the rating in the list
    let animeId = $("#anime-popup").data("animeId")
    let animeGenres = $("#anime-popup").data("genres")

    let args0 = { "animeId": animeId, "genres": animeGenres }
    await ipcRenderer.invoke("queryDB", "insert", "anime", args0)

    if (currentRating == 0) {
        currentRating = null
    }

    let args = {
        "animeId": animeId,
        "property": "rating",
        "value": currentRating
    }
    await ipcRenderer.invoke("queryDB", "ud", "update", args)
    loadAnimeStatuses(animeId)
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
        
        $(event.target).remove()
        loadRoleIcons()
        refreshViewWatchlist(currentViewing)
    }
})

$(document).on("click", ".-addrole-internal", async function (event) {
    let [category, value, categoryId, animeId] = event.target.id.split("$separator$")
    let animeGenres = $("#anime-popup").data("genres")

    let args0 = { "animeId": animeId, "genres": animeGenres }
    await ipcRenderer.invoke("queryDB", "insert", "anime", args0)

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

    // load data tab
    loadDataTab()
}