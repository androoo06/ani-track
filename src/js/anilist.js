const anilistModule = require('anilist-node');
const anilist = new anilistModule();

async function getSuperSpecifics(id) {
    // console.log("specifics", id)
    let data

    await anilist.media.anime(id).then(response => { 
        data = response
    }).catch((e) => {
        console.log("super specifics error:", e)
    })

    if (data) {
        return {
            "title": data.title.english || data.title.native,
            "description": data.description,
            "image": data.coverImage.large,
    
            "genres": data.genres,
        }
    }    
}

async function searchAnime(_str) {
    // console.log("searching", _str)
    let data = {media: []}

    await anilist.search("anime", _str, 1, 25).then(response => { 
        data = response
    }).catch((e)=> {
        console.log("search error:", e)
    })

    let ret = []
    data.media.forEach(el => {
        ret.push({
            "id": el.id,
            "title": el.title.english || el.title.native
        })
    })

    return ret
}

module.exports.handleQuery = async function(_, channel, arg) {
    if (channel == "search") {
        return await searchAnime(arg)
    } else if (channel == "specifics") {
        return await getSuperSpecifics(arg)
    }
}