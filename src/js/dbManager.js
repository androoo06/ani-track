const sqlite3 = require('sqlite3').verbose();
const { existsSync } = require('fs')
const path = require('path');

// Get whether it's in testing or in production
var rootDir = path.dirname(__dirname).replace("app.asar", "")
var assets = path.join(rootDir, 'assets')

if (!existsSync(assets)) {
    assets = path.join(rootDir, "src/assets")
}
var dsPath = assets + '\\..\\..\\..\\db\\test.db'

// Database
let db;

module.exports.openDB = function() {
    db = new sqlite3.Database(assets+"/data/default.db", sqlite3.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message);
        }
    
        console.log('Connected to DB')
    })

    db.exec(`DELETE FROM Anime`)

    let sql = `SELECT * FROM Anime`
    db.get(sql, (e, r) => {
        console.log(r)
    })
}

module.exports.closeDB = function() {
    db.close((err) => {
        if (err) {
            return console.error(err.message)
        }
        console.log('Close the database connection.')
    })
}