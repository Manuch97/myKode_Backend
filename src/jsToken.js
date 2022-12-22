const expressJwt = require('express-jwt');
const jwt = require("jsonwebtoken");
const fs = require("fs");
const AuthType = "bearer";
const AnonymousUser = "Anonymous";
const { v4: uuidv4 } = require('uuid');
const crypto = require("crypto");

const tokenConfig = require("./../config/tokenConfig");
/*Enum*/
const Roles  = {
    admin:"admin",
    user:"user"
};

/**
 * Creates an Identity, or an anonymous identity if options parameter is not given
 * see https://datatracker.ietf.org/doc/html/rfc7519#page-9
 * @param {string} options.title
 * @param {string} options.idflowchart
 * @param {string} options.ndetail
 * @param {string} options.name  The subject value MUST either be scoped to be locally unique in the context of the issuer or be globally unique
 * @param {string} options.title
 * @param {string} options.sessionguid
 * @param {string} options.email
 * @param {string[]} options.roles  // possible values: user, admin, default ["user"]
 * @constructor
 */

function Identity(options){
    if (options) {
        this.name = options.name;   //this goes into subject as convention rules
        this.title = options.title;
        this.idflowchart = options.idflowchart;
        this.ndetail = options.ndetail;
        this.email = options.email;
        this.isAnonymous = !(this.name || this.title);
        this.roles = options.roles || [Roles.user];
        this.sessionguid  =  options.sessionguid || uuidv4();
    }
    else {
        this.name = null;   //this goes into subject as convention rules
        this.title = null;
        this.idflowchart = null;
        this.ndetail = null;
        this.email = null;
        this.isAnonymous = true;
        this.sessionguid  = uuidv4();
        this.roles = [];
    }

}

Identity.prototype = {
    constructor:Identity,
    hasRole: function(role){
        return this.roles.indexOf(role)>=0;
    },

    sessionID: function (){
        return this.sessionguid;
    }
};

/**
 * If request has a token, it returns it's identity otherwise returns an anonymous identity
 * @param req
 * @return {Identity}
 */
function getIdentityFromRequest(req) {
    let tokenData = req[tokenConfig.options.requestProperty];
    //let tokenData = Token.prototype.decode(encoded); token is already decoded by jwt library
    return new Identity(tokenData);
}

/**
 * Creates a token from an identity , taking ip address from request
 * see https://datatracker.ietf.org/doc/html/rfc7519#page-9
 * @param {Request} req
 * @param {Identity} [identity] if omitted an anonymous identity is created
 * @constructor
 */
function Token(req, identity){
    if (!identity) {
        identity = new Identity(); //anonymous token
    }

    //this.loggedOn = new Date();
    //this.expiresOn.setHours(this.expiresOn.getHours()+1); not necessary, it is automatically set during signing
    this.clientAddress = this.getClientAddress(req);

    this.name = identity.name;   //this goes into subject as convention rules
    this.title = identity.title;
    this.idflowchart  = identity.idflowchart;
    this.ndetail  = identity.ndetail;
    this.email  = identity.email;
    this.roles = identity.roles;
    this.IsAnonymous = identity.isAnonymous;
    this.sessionguid = identity.sessionguid;
    this.loggedOn = new Date();
    this.expiresOn = new Date();
    this.expiresOn.setTime(this.expiresOn.getTime() + (60*60*1000));
}

Token.prototype = {
    constructor: Token,
    getClientAddress: function(req){
        return (req.headers['x-forwarded-for'] || '').split(',').pop().trim() || req.socket.remoteAddress;
        //  or req.ip if using express with app.set('trust proxy', true)
    },

    /**
     * Evaluates the encripted token to be used in response
     * @return {string}
     */
    getToken: function (){
      return this.encode(this.getObjectToken());
    },

    /**
     * Extract token from request
     * @param req
     */
    getFromRequest(req){
        return req[tokenConfig.options.requestProperty]; //default is auth
    },

    /**
     *
     * @param {Request} req
     */
    setInRequest(req){
        req.headers.authorization = "Bearer "+this.getToken();
        req[tokenConfig.options.requestProperty]= this;
    },


    /**
     * Returns the public token structure:
     * sub is Identity.name
     * nDetail is Identity.ndetail
     * roles is Token.roles or Identity.roles
     * IsAnonymous is Token.IsAnonymous
     * title is Token.title or Identity.title
     * idFlowChart is Identity.idflowchart
     * email is Identity.email
     * @return {Object.<sub:string,aud:Object,guidsession:Object,nDetail:string.roles:Array.<string>,
     *              IsAnonymous:boolean,title:string,idFlowChart:string,email:string>}
     *
     */
    getObjectToken: function (){
        return {
            //iss: taken from config by sign
            //The "iat" (issued at) claim identifies the time at which the JWT was issued.  This
            //  claim can be used to determine the age of the JWT.
            //iat: Math.floor(this.loggedOn / 1000 ), //may be this must be converted to a number
            //exp: this.expiresOn, //same here
            sub: this.name, //
            aud: this.clientAddress,
            email: this.email,
            title: this.title,
            idFlowChart: this.idflowchart,
            nDetail: this.ndetail,
            sessionguid: this.sessionguid,
            roles: this.roles,
            IsAnonymous: this.IsAnonymous
            //The "jti" (JWT ID) claim provides a unique identifier for the JWT. The identifier value MUST be assigned
            // in a manner that ensures that there is a negligible probability that the same value will be
            // accidentally assigned to a different data object
        };
    },
    sessionID: function (){
        return this.sessionguid;
    },

    /**
     * Decodes a token into original data
     * @param {string} token
     * @return object or null if errors
     */
    decode: function(token){
        try {
            return jwt.decode(token, tokenConfig.options);
        }
        catch (err){
            //console.log(err);
            return null;
        }
    },
    /**
     * Generates a token from a given set of data
     * @param data
     * @return {string}
     */
    encode: function (data){
        const config = { algorithm: tokenConfig.options.algorithm, issuer:  tokenConfig.options.issuer};
        return jwt.sign(data,masterKey,config);
    }
};

/* function(req,res,next) */
let jwtCheck;

/* buffer */
let masterKey;
const masterKeyFileName = "./config/masterkey.json";
/**
 *
 * @param {string} key
 * @return *
 */
async function setMasterKey (key){
    if (!key){
        masterKey = generateMasterKey();
    }
    else {
        masterKey = Buffer.from(key,"utf-8");
    }
    tokenConfig.options.secret = masterKey;

    jwtCheck= expressJwt(tokenConfig.options);
}


/**
 * Middleware that assures there is a syntactical valid token, eventually an anonymous one, attached
 *  to the request. Decodes the token into request.auth or whatever property specified in config
 * @param req
 * @param res
 * @param next
 * @return {*}
 */
function checkToken (req, res, next){
    try {
        let headersAuthParts = req.headers.authorization.split(' ');
        if (headersAuthParts.length < 2){
            res.status(401).json({
                error: 'Invalid Authorization header for the request'
            });
            return;
        }
        if (headersAuthParts[0]!=="Bearer"){
            res.status(401).json({
                error: 'Invalid Authorization scheme for the request'
            });
            return;
        }
        const token = headersAuthParts[1];
        if (token === tokenConfig.AnonymousToken){
            req[tokenConfig.options.requestProperty] = new Token(req); //sets auth as anonymous token
            next();
        }
        else {
            //token data is taken from req.headers.authorization
            jwtCheck(req,res,next);
            // The decoded JWT payload is available on the request via the auth property
        }
    }
    catch {
        res.status(401).json({
            error: 'Invalid request!'
        });
    }
}
/* private static readonly JwsAlgorithm SignatureAlgorithm = JwsAlgorithm.HS512;
   private static readonly int KeyBytes = 64; // 64 = HS512, 48 = HS384, 32 = HS256
 */


/**
 *
 */
function generateMasterKey(){
    return crypto.randomBytes(64);
}

//const buff = Buffer.from(str, "utf-8");
//const str = buff.toString()

/**
 * Assures there that a masterKey is set, creates it if does not already exists
 */
function  assureMasterKey(){
    if (masterKey) {
        return;
    }
    if ( fs.existsSync(masterKeyFileName)){
        masterKey = fs.readFileSync(masterKeyFileName, {encoding: 'utf8'}).toString();
    }

    if (!masterKey) {
        masterKey = generateMasterKey();
        fs.writeFileSync(masterKeyFileName, masterKey,{encoding: 'utf8'});
    }
    tokenConfig.options.secret = masterKey;

    jwtCheck =  expressJwt(tokenConfig.options);

}

module.exports = {
    checkToken: checkToken,
    getIdentityFromRequest:getIdentityFromRequest,
    Roles:Roles,
    Token:Token,
    setMasterKey:  setMasterKey,
    assureMasterKey: assureMasterKey,
    Identity:Identity

};
