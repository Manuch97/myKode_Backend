

const bodyParser = require('body-parser');
const morgan = require('morgan');
const _ = require('lodash');
const Deferred = require("JQDeferred");
const express = require('express');
const Path = require("path");
const fs = require("fs");


function CorsManagement(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-allow-Methods', 'GET, PUT, POST, PATCH, DELETE');
        return res.status(200).json({});
    }
    return next();
}



/**
 * @returns {Express}
 */
function createExpressApplication(){
    let app= express();
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use(bodyParser.json());
    app.use(bodyParser.raw());
    app.use(CorsManagement);

    // Logging rest api --> npm install --save morgan
    app.use(morgan('dev'));
    app.set('trust proxy', true); //so we can read IP from request.ip

    return  app;
}


/**
 * Adds all routes in a folder to a router. Convention is that every file must expose a router itself
 * @param {Router} router
 * @param {string} folder, ex. "routes/data/"
 * @param {string} routePrefix, ex. "/data/"
 */
function createServicesRoutes(router, folder,routePrefix){
    fs.readdirSync(folder)
        .filter(fileName => fs.lstatSync(`${folder}/${fileName}`).isFile() &&
                        (! fileName.startsWith("_") )&&
                             fileName.endsWith(".js"))
        .forEach(fileName => {
            router.use(`/${routePrefix}`, require(Path.join('..', folder, fileName)));
        }
    );
}


// **********************************  Routes MANAGEMENT END ********************************


module.exports = {
    createExpressApplication: createExpressApplication,
    createServicesRoutes:createServicesRoutes
};
