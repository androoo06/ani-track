let colors = ['#ff3737', 'yellow', '#31b61f', '#5959ff']
let textColors = ["white", "black", "black", "white"]
let scale = 50

function degreesToRadians(degrees) {
    var pi = Math.PI
    return degrees * pi / 180
}

function transform(xy) {
    if (scale == 0) return xy
    return [xy[0] * scale + scale, xy[1] * scale + scale]
}

function vectorSize(x, y) {
    return Math.sqrt(x * x + y * y)
}

function unitVector(x, y) {
    const magnitude = vectorSize(x, y)
    return [x / magnitude, y / magnitude];
}

function spin() {
    if ($("#wheel").children().length < 7 ) {
        return
    }

    $("#wheel").removeClass("spinning")
    $("#wheel").css("transform", "rotate(0deg)")

    var x = 1111*5; //min value
    var y = 9999*5; // max value

    var deg = Math.floor(Math.random() * (x - y)) + y;

    setTimeout(() => {
        $("#wheel").addClass("spinning")
        $("#wheel").css("transform", "rotate(" + deg + "deg)");
    }, 150)

    let c = Math.floor($("#wheel").children().length/2)
    let inc = 360/c
    let startNum = c-1

    // console.log(Math.floor(deg/inc), Math.floor(deg/inc)%c, inc)
    // console.log(startNum - Math.floor(deg/inc))
    let victor = (startNum - Math.floor(deg/inc) + (c * y)) % c

    setTimeout(()=>{
        let txtId = 2 + (2 * victor)
        let el = $("#wheel").children()[txtId]
        let id = $(el).data("animeId")
        let txt = $(el).text()
        $("#wheel-popup").find(".-sub-title").text(txt)
        $("#wheel-popup").data("animeId", id)
        
        openAsPopup($("#wheel-popup")[0])
    }, 11000)
}

function fillWheel(contents) {
    $("#wheel").html(`<div id="wheel-center"></div>`)

    if (contents.length >= 3) {
        $("#wheel-container").removeClass("hidden")
        $("#not-enough-anime").addClass("hidden")
    } else {
        $("#wheel-container").addClass("hidden")
        $("#not-enough-anime").removeClass("hidden")
        return
    }

    let inc = 360 / contents.length
    let i = 0

    contents.forEach(anime => {
        let mid = ((inc * i) + (inc * (i + 1))) / 2

        let rad = degreesToRadians(inc * i)
        let rad2 = degreesToRadians(inc * (i + 1))
        let rad3 = degreesToRadians(mid)

        let xy = [Math.cos(rad), Math.sin(rad)]
        let xy2 = [Math.cos(rad2), Math.sin(rad2)]
        let xy3 = [Math.cos(rad3), Math.sin(rad3)]
        let [sx, sy] = unitVector(xy3[0], xy3[1])

        xy = transform(xy)
        xy2 = transform(xy2)
        xy3 = transform(xy3)

        let subScalar = 40
        let span = `
                    <span class="abs wheel-element" style="clip-path: polygon(50% 50%, ${xy[0]}% ${xy[1]}%, ${xy2[0]}% ${xy2[1]}%); 
                        background-color: ${colors[i % colors.length]};">
                    </span>
                    <span class="abs wheel-word-box" style="left: ${xy3[0] - (sx * subScalar)}%; top: ${xy3[1] - (sy * subScalar) - 8.25}%; transform: rotate(${(inc / 2) + (i * inc)}deg); color: ${textColors[i % textColors.length]};" data-animeId="${anime[1]}">
                        ${anime[0]}
                    </span>
                `

        $("#wheel")[0].innerHTML += span
        i++;
    }) 
}

$("#spin-wheel").on("click", spin)

$("#reroll-anime").on("click", () => {
    closePopup($("#wheel-popup"))
    spin()
})