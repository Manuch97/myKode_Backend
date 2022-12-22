let fs =require("fs");
let path =require("path");


let dbConfigFileName= process.argv[2];
let scriptName= process.argv[3];
let dbCode= process.argv[4];

let content = fs.readFileSync(dbConfigFileName,"utf-8");
let dbConfig = JSON.parse(content.toString());


if (dbCode) {
    dbConfig= dbConfig[dbCode];
}
let driverKind = dbConfig.sqlModule;

const driverClass = require(path.join("..","src",driverKind));

let dbConn = new driverClass.Connection(dbConfig);
let stop=false;

dbConn.open().done(function (){
    console.log("running script "+scriptName+
        " on db "+dbConfig.database+
        " server "+dbConfig.server+
        "("+driverKind+")");
    dbConn.run(fs.readFileSync(scriptName).toString()).then((res,err)=>{
        if (err) console.log(err);
        console.log("script runned");
        stop=true;
    }).fail((err)=>{
        console.log("script failed");
        stop=true;
    });

    // start polling at an interval until the data is found at the global
    let intvl = setInterval(function() {
        if (stop) {
            clearInterval(intvl);
            console.log("script runned received");
        }
    }, 100);
});

