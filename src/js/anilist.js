const anilistModule = require('anilist-node');
const anilist = new anilistModule();

async function getSuperSpecifics(id) {
    let data

    await anilist.media.anime(id).then(response => { 
        data = response
    }) 

    return {
        "title": data.title.english || data.title.native,
        "description": data.description,
        "image": data.coverImage.small,

        "genres": data.genres,
    }
}

async function searchAnime(_str) {
    let data

    await anilist.search("anime", _str, 1, 25).then(response => { 
        data = response
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

module.exports.search = searchAnime
module.exports.getSuperSpecifics = getSuperSpecifics