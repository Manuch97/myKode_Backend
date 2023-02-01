const fs = require('fs'),
    path   = require('path'),
    http = require('http'),
    DbList = require('./src/jsDbList'),
    appList = JSON.parse(fs.readFileSync(path.join("config","appList.json"), {encoding: 'utf8'})),
    Crypto = require('crypto-js'),
    JsApplication = require('./src/jsApplication'),
    jsExpressApplication = require('./src/jsExpressApplication.js'),
    JsToken= require('./src/jsToken');
const Deferred = require("JQDeferred");

let secret = require('./config/secret');

// inizializza la dblist con tutte le DbInfo così che poi tutti possano ottenere da essa le connessioni
DbList.init({
    encrypt: true,
    decrypt: false,
    fileName:path.join('config','dbList.json'), //rimuovere e cancellare in produzione
    encryptedFileName: path.join('config','dbList.bin'), //questa è l'unica che deve rimanere
    secret:secret
});

let port = process.argv[2] || process.env.PORT || 54471;

let GetMeta = require("./client/components/metadata/GetMeta");
GetMeta.setPath("./../../meta"); //all metadata must be stored here

//This must be executed as soon as possible
JsToken.assureMasterKey();

let expressApplication = jsExpressApplication.createExpressApplication();
//adds all applications
return Deferred.when(appList.map(appCfg=>{
            //for every app configured creates a JsApplication running under "route" path  configured
            let application = new JsApplication();
            return application.init(appCfg.dbCode)
                .then(()=>{
                  return expressApplication.use(appCfg.route,application.getApp());
                });
        }))
    .then(()=>{
        //runs the overall application
        const server = http.createServer(expressApplication);
        server.listen(port); //port is applied to external Application
    });



