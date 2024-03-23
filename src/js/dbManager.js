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

module.exports.queries = {
    "create-new": async function(args) {
        let table = args.tab.slice(0, -1)
        console.log(table)

        let data
        await db.run(`INSERT INTO ${table} (name) VALUES (${args.name});`, (response) => {
            data = response
        })

        return data
    },

    "select": async function (args) {
        let data
        await db.get(`SELECT * FROM Watchlist;`, (err, response) => {
            if (err) {
                console.log("error:", err)
            } else {
                data = response
            }
        })

        return data
    }
}