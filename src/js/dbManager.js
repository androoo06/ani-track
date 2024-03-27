const sqlite3 = require('sqlite3').verbose();
const { existsSync, copyFile, constants } = require('fs')
const path = require('path')

// Get whether it's in testing or in production
var rootDir = path.dirname(__dirname).replace("app.asar", "")
var assets = path.join(rootDir, 'assets')

if (!existsSync(assets)) {
    assets = path.join(rootDir, "src/assets")
}

let dsPath = assets + '\\..\\..\\..\\anitrack_data.db'
let defaultPath = assets+"/data/default.db"

// Database
let db;

module.exports.init = function() {
    copyFile(defaultPath, dsPath, constants.COPYFILE_EXCL, (err) => {
        // console.log(err)
    })

    db = new sqlite3.Database(dsPath, sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message);
        }
    
        console.log('Connected to DB')
    })
}

module.exports.close = function() {
    db.close((err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log('Close the database connection.')
    })
}

let queries = {
    "get": {
        "id": `SELECT (id) FROM [table] WHERE (name = "[name]")`,
        "all": "SELECT * FROM [table]",
        "all-except": "SELECT * FROM [table] EXCEPT (SELECT * FROM [table-content] WHERE (animeId = [animeId]))",
        "content": "SELECT A.* from Anime A, [table] t WHERE ((A.id = t.animeId) AND (t.id = [tableId]))",
        "watching": "SELECT (id) FROM Anime WHERE (watching = 1)",
        "filtered": "SELECT A.* from Anime A [filterProperties]"
    },

    "insert": {
        "element": `INSERT INTO [table] (name) VALUES ("[name]")`,
        "anime": "INSERT INTO Anime (id) VALUES ([animeId])",
        "content": "INSERT INTO [table-content] (id, animeId) VALUES ([id], [animeId])"
    },

    "ud": {
        "update": "UPDATE Anime SET ([property] = [value]) WHERE (id = [animeId])",
        "delete": "DELETE FROM [table] WHERE (id = [elementId])"
    }
}

function replaceQuery(q, args) {
    let nQ = (' ' + q).slice(1) // hacky way to copy str
    for (const [key, value] of Object.entries(args)) {
        nQ = nQ.replace(`[${key}]`, value)
    }

    if (nQ.search("\\[") != -1) return "$Error$"

    return nQ
}

module.exports.handleQuery = async function(_, channel, query, args) {
    let updatedQuery = replaceQuery(queries[channel][query], args)

    if (updatedQuery == "$Error$") {
        console.log("CANNOT RUN QUERY: INCOMPATIBLE ARGUMENTS")
        console.log("REQUESTED QUERY: ", queries[channel][query])
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