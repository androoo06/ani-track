const sqlite3 = require('sqlite3').verbose();
const { existsSync, constants } = require('fs')
const { copyFile } = require('fs/promises')
const path = require('path')
const { app } = require('electron')

// Get whether it's in testing or in production
var rootDir = path.dirname(__dirname).replace("app.asar", "")
var assets = path.join(rootDir, 'assets')

if (!existsSync(assets)) {
    assets = path.join(rootDir, "src/assets")
}

let userDataPath = app.getPath('userData')
let dsPath = userDataPath + "/anitrack_data.db"
let defaultPath = assets + "/data/default.db"

// Database
let db;

module.exports.init = async function () {
    await copyFile(defaultPath, dsPath, constants.COPYFILE_EXCL).then(function () {
        console.log("First time user: added file")
    }).catch(function() {
        console.log("Existing user")
    })

    await new Promise(resolve => {
        db = new sqlite3.Database(dsPath, sqlite3.OPEN_READWRITE, (err) => {
            if (err) {
                return console.error(err.message);
            }
    
            console.log('Connected to DB')
            resolve()
        })    
    })

    db.on("error", function(error) {
        console.log("Getting an error : ", error);
    })

    db.get("PRAGMA foreign_keys = ON")
}

module.exports.close = function () {
    db.close((err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log('Closed DB.')
    })
}

let queries = {
    "get": {
        "all": "SELECT * FROM [table]",
        "all-except": "SELECT * from [table] WHERE id IN  (SELECT id from [table] EXCEPT SELECT id FROM [table-content] WHERE animeid = [animeId])",
        "all-in": "SELECT (name) FROM [table] WHERE id IN (SELECT (id) FROM [table-content] WHERE (animeId = [animeId]))",
        "content": "SELECT A.* from Anime A, [table-content] t WHERE ((A.id = t.animeId) AND (t.id = [tableId]))",
        "exact": "SELECT * FROM [table-content] WHERE (id = [id]) AND (animeId = [animeId])",
        "exists": "SELECT animeId from TagContent UNION SELECT animeid FROM WatchlistContent UNION SELECT animeId FROM RecommenderContent",
        "filtered": "SELECT A.* from Anime A [filterProperties]",
        "id": `SELECT (id) FROM [table] WHERE (name = "[name]")`,
        "rating": "SELECT (rating) from Anime WHERE (id = [id])",
        "watching": "SELECT (id) FROM Anime WHERE (watching = [watchCode])",
        "watch-code": "SELECT (watching) FROM Anime WHERE (id = [id])",
    },

    "insert": {
        "anime": "INSERT OR IGNORE INTO Anime (id) VALUES ([animeId])",
        "content": "INSERT OR IGNORE INTO [table-content] (id, animeId) VALUES ([id], [animeId])",
        "element": `INSERT OR IGNORE INTO [table] (name) VALUES ("[name]")`,
    },

    "ud": {
        "delete-content": "DELETE FROM [table] WHERE ((animeId = [animeId]) AND (id = [id]))",
        "delete-main": `DELETE FROM [table] WHERE (id = [id])`,
        "delete-watchlist-animes": "DELETE FROM WatchlistContent WHERE (animeId = [animeId])",
        "update": "UPDATE Anime SET [property] = [value] WHERE (id = [animeId])",
    }
}

function replaceQuery(q, args) {
    let nQ = (' ' + q).slice(1) // hacky way to copy str
    for (const [key, value] of Object.entries(args)) {
        nQ = nQ.replaceAll(`[${key}]`, value)
    }

    if (nQ.search("\\[") != -1) {
        console.log("--------------------------------")
        console.log("CANNOT RUN QUERY: INCOMPATIBLE ARGUMENTS")
        console.log("REQUESTED QUERY: ", q)
        console.log("RESULT QUERY:", nQ)
        console.log("--------------------------------")
        return "$Error$"
    }

    return nQ
}

module.exports.handleQuery = async function (_, channel, query, args) {
    let updatedQuery = replaceQuery(queries[channel][query], args)

    if (updatedQuery == "$Error$") {
        return
    }

    if (channel == "get") {
        return new Promise((resolve, reject) => {
            db.all(updatedQuery, (err, rows) => {
                if (!err) {
                    resolve(rows)
                } else {
                    reject(err)
                }
            })
        })
    } else {
        db.run(updatedQuery)
    }
}