const Path = require("path");
const fs = require("fs");
const Deferred = require("JQDeferred");
const Express = require('express');


const DataAccess = require("./jsDataAccess");
const JsConnectionPool = require('./JsConnectionPool').JsConnectionPool;
const JsPooledConnection = require('./JsConnectionPool').JsPooledConnection;


const DBList = require("./jsDbList");

const PostData = require('./jsPostData').PostData;
const checkToken = require("./jsToken").checkToken;
let Identity = require("./jsToken").Identity;
const getIdentityFromRequest= require("./jsToken").getIdentityFromRequest;
let createServicesRoutes = require('./jsExpressApplication').createServicesRoutes;
let createExpressApplication =  require('./jsExpressApplication').createExpressApplication;
const tokenConfig = require("./../config/tokenConfig");
const Token = require("./jsToken").Token;
const securityProvider= require("./jsSecurity");
const LocalResource= require("./../client/components/metadata/LocalResource");
const GetMeta= require("./../client/components/metadata/GetMeta");
const GetDataInvoke= require("./../client/components/metadata/GetDataInvoke");
const dsNameSpace = require("./../client/components/metadata/jsDataSet");
const OptimisticLocking = dsNameSpace.OptimisticLocking;
const commonGetDataSet =require("./../client/components/metadata/GetDataSet");
const jsBusinessLogic = require("../src/jsBusinessLogic");
let BusinessPostData =jsBusinessLogic.BusinessPostData;
const Environment = require('./jsEnvironment');

const Context = require('./jsDbList').Context;


/**
 * Main Application
 * @constructor
 */
function JsApplication() {
    this.expressApplication = createExpressApplication();
    this.expressApplication.locals.JsApplication= this; //every expressApplication is attached to a JsApplication

    this.router = Express.Router();
    this.pool=null;


    /**
     * Collection of all user environments of the application, the key is the sessionID
     * @type {Object.<string, Environment>}
     */
    this.environments={};

    /* Security */
    this.security=null;
}


JsApplication.prototype = {
    constructor: JsApplication,

    /**
     * Creates the connection pool, it is supposed to be overridden in derived classes
     * @param {string} dbCode
     * @returns {JsConnectionPool}
     */
    createConnectionPool: function(dbCode){
        return new JsConnectionPool(dbCode);
    },

    getApp: function (){
        return this.expressApplication;
    },
    getRouter: function (){
        return this.router;
    },

    //this must return the list of all folders containing routers that do not need authentication
    getNoTokenFolders: function(){
        return {
            "auth":true
        };
    },

    error: function (err,req,res,next){
        res.status(401).json({
            error: err.stack
        });
    },


    /**
     * Attaches a release event on close/finish of the request (the one which fires first)
     * releases the pool connection after a request has been processed
     * @param req
     * @param res
     * @param ctx
     */
    assureReleaseConnection: function(req, res, ctx) {
        let released=false;
        res.on('close', () => {
            if (released){
                return;
            }
            released=true;
            //let ctx = req.app.locals.context;
            ctx.pooledConn.release();
        });

        res.on('finish', () => {
            if (released){
                return;
            }
            released=true;
            //let ctx = req.app.locals.context;
            ctx.pooledConn.release();
        });
        //next();
    },

    createTestSession: function(req,res,next){
        let token = Token.prototype.getFromRequest(req);
        if (token) {
            return next();
        }
        let identity= new Identity({
            name:"AZZURRO",
            title:"AZZURRO"
        });

        this.getDataAccess()
        .then(pooledConn=>{
            let conn = pooledConn.getDataAccess();
            return this.createSession(identity, conn);
        })
        .then(environment=>{
            let token = new Token(req,identity);
            token.setInRequest(req);
            next();
        });

        /// creare il token che simuli l'invio da parte di quella identity
        /// valorizzare l'header con il token
    },

    /**
     *
     * @param {string} dbCode
     * @return {Promise}
     */
    init: function (dbCode){
        this.dbCode= dbCode;
        this.pool = this.createConnectionPool(dbCode);
        let noTokenFolders = this.getNoTokenFolders();
        let dbInfo = DBList.getDbInfo(dbCode);
        if (dbInfo.test){
            this.expressApplication.use(this.createTestSession.bind(this));
        }

        //adds all routers of directory routes
        const routes = "routes";
        fs.readdirSync(routes)
        .filter(fileName => fs.lstatSync(`${routes}/${fileName}`).isDirectory()) //takes all folders
        .forEach(folderName => {
            if (noTokenFolders[folderName] === undefined){
                //check token for any path, with the only exception for those in noTokenFolders
                this.router.use("/"+folderName+"/", checkToken.bind(this));
            }
            //At this point the token exists if it is required. But not necessarily is bound to a valid session
            this.router.use("/"+folderName+"/", this.getOrCreateContext.bind(this));
            createServicesRoutes(this.router, Path.join("routes",folderName),folderName);
        });

        //The "metadata" path is mapped into "meta"
        this.expressApplication.use('/client/meta', Express.static('metadata'));
        this.expressApplication.use('/client/pages', Express.static('pages'));
        this.expressApplication.use(Express.static("client"));

        this.expressApplication.use(this.router);
        this.expressApplication.use(this.error.bind(this));



        let connPool;
        let def = Deferred();
        this.getDataAccess()
        .then(_connPool=>{
            connPool=_connPool;
            return connPool.getDataAccess();
        })
        .then(conn=>{
            this.security= conn.security;
            def.resolve();
        })
        .fail(err=>{
            def.reject(err);
        });
        return  def.promise();
    },

    /**
     * returns an open connection to db
     * @return {Promise<JsPooledConnection>}
     */
    getDataAccess: function (){
        return  this.pool.getDataAccess().promise();
    },

    /**
     * Meant to be redefined in subclasses, creates an Environment class
     * @param {Identity} identity
     * @param {DataAccess} conn
     * @return {Environment}
     */
    createEnvironment: function (identity, conn){
        let e = new Environment(identity);

        //Sets field for optimistic locking
        e.field("lu",identity.name);
        e.field("cu",identity.name);

        return e;
    },

    /**
     * Create a Session for the user represented by the token.
     * @param {Identity} identity
     * @param {DataAccess} conn
     * @return {Promise<Environment>}
     */
    createSession: function (identity, conn){
        let def = Deferred();
        let that=this;
        let env= this.createEnvironment(identity);
        env.load(conn)//evaluate environments from database
        .then(()=>{
            that.environments[identity.sessionID()]=env;
            def.resolve(env);
        })
        .fail(err=> {
            def.reject(err);
        });

        return  def.promise();
    },

    /**
     * Function that must create a PostData class, this is meant to be overridden in derived classes
     * @param {Context} ctx
     * @return {BusinessPostData}
     */
    createPostData: function (ctx){
        let p =  new BusinessPostData(ctx);
        p.setOptimisticLocking( new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']));
        return p;
    },

    /**
     * SYNC function
     * @param tableName
     * @param editType
     * @return {DataSet}
     */
    getDataSet: function(tableName,editType){
        return commonGetDataSet.getDataSet(tableName,editType);
    },


    getAnonymousEnvironment:function(identity) {
        // TODO create an anonymous environment
        return new Environment(identity);
    },

    /**
     * Creates a context object in req.app.local.context. If the token is not provided in the header, creates
     *  an anonymous connection.
     * @param {Request} req
     * @param {Response} res
     * @param {Middleware} next
     */
    getOrCreateContext: function  (req, res, next) {
        let token = req.get(tokenConfig.options.requestProperty); //default is req[auth]

        //Creates an Identity basing on the request token. If no token,
        //  an anonymous identity is created
        let identity = getIdentityFromRequest(req);
        let sessionID = identity.sessionID();
        if (token) {
            let env;
            if (this.environments[sessionID]){
                env = this.environments[sessionID];
            }
            else {
                if (identity.isAnonymous) {
                    env = this.getAnonymousEnvironment(identity);
                }
            }
            return this.getContext(req,res,next, env);
        }
        // return res.status(401).json({
        //     error: 'No token'
        // });
        // identity is an annonymous identity cause there is no token at all
        //  it is the same as if anonymous token was found in the header
        //Here a new environment is created
        let env = this.getAnonymousEnvironment(identity); //creates an anonymous environment
        this.environments[sessionID] = env; //why?? it should not be done
        return this.getContext(req,res,next, env);
    },

    /**
     * Creates a context and attach it to req.app.local
     * Also adds the
     * @param pooledConn
     * @param env
     * @param {Request} req
     * @param {Response} res
     * @param {Middleware} next
     */
    createContext: function(pooledConn,env,req,res, next){
        let ctx = new Context();
        ctx.dbCode = this.dbCode;
        ctx.pooledConn = pooledConn;
        ctx.dataAccess = pooledConn.getDataAccess();
        ctx.security = ctx.dataAccess.security;
        ctx.sqlConn = ctx.dataAccess.sqlConn;
        ctx.environment = env;
        ctx.dataAccess.externalUser = env.usr("externalUser");
        ctx.formatter = ctx.sqlConn.formatter;
        ctx.dbDescriptor = DBList.getDescriptor(ctx.dbCode);
        ctx.securityProvider = this.getSecurityProvider;
        ctx.identity = getIdentityFromRequest(req);
        securityProvider(ctx.dataAccess,ctx.formatter)
        .then((security)=>{
            ctx.security = security;
            ctx.createPostData = this.createPostData.bind(this, ctx);  //to override
            ctx.getDataSet = this.getDataSet.bind(this); //to override
            ctx.localResource = LocalResource.prototype.getLocalResource(this.getLanguageFromRequest(req));
            ctx.getMeta= function (tableName){
                return GetMeta.getMeta(tableName,req);
            };
            ctx.environmentSet = this.environmentSet.bind(this,ctx);
            ctx.getDataInvoke = new GetDataInvoke(ctx);
            req.app.locals.context = ctx;
            this.assureReleaseConnection(req, res, ctx);
            next();
        })
        .fail(err=>{
            res.status(500).json({
                error: err
            });
        });

    },
    environmentSet:function (ctx,env){
        let sessionID = ctx.identity.sessionID();
        this.environments[sessionID] = env;
    },

    getSecurityProvider: function(){
        return require("./jsSecurity");
    },

    getLanguageFromRequest: function(req){
        return req.language || "It";
    },

    /**
     * Creates a context object in req.app.local.context, when environment already exists
     * @param {Request} req
     * @param {Response} res
     * @param {Middleware}  next
     * @param {Environment} env
     */
    getContext: function  (req, res, next, env) {
        try {
            let token = req.get(tokenConfig.options.requestProperty); //default is auth
            if (!token) {
                res.status(401).json({
                    error: 'No token'
                });
                return;
            }
            //If a token is not present, evaluates an anonymous identity
            let identity = getIdentityFromRequest(req);
            //let sessionID = identity.sessionID();
            //let env = this.environments[sessionID];
            if (!env) {
                res.status(401).json({
                    error: 'Session not found'
                });
                return;
            }

            //Creates a context for the request execution
            this.getDataAccess()
            .then((pooledConn) => {
                this.createContext(pooledConn, env, req, res, next);
            })
            .fail(err=>{
                res.status(401).json({
                    error: 'Db not connected'
                });
            });
        }
        catch (err) {
            res.status(401).json({
                error: 'Invalid request!'
            });
        }
    },

};

module.exports = JsApplication;
