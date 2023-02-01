const Deferred = require("jQDeferred");
const _ = require('lodash');

const Q = require('./../client/components/metadata/jsDataQuery');

/**
 *  Identity class is declared in jsToken. Identity must have name,idflowchart,ndetail set
 * @param {Identity} identity     identity.name must match a username in the customuser table
 * @constructor
 */
function Environment(identity) {
    this.mySys = {};
    this.myUsr = {};
    this.fields = {};
    this.stampFields = this.getStampFields();
    this.sys("user",identity.name||this.getAnonymousName());
    if (identity.isAnonymous){ //just to be sure
        this.sys("user",this.getAnonymousName());
    }
    this.sys("idflowchart",identity.idflowchart||null);
    this.sys("ndetail",identity.ndetail||null);
    this.sys("esercizio",new Date().getFullYear());
    this.sys("ayear",new Date().getFullYear());

}

Environment.prototype = {
    constructor: Environment,
    /**
     * this is meant to be redefined in derived classes
     * @return {string}
     */
    getAnonymousName: function (){
        return "anonymous";
    }
};
/**
 *  Returns an array of fields used as stamp in evaluating field function for optimistic locking
 *  This function means to be redefined in derived classes
 * @return {string[]}
 */
Environment.prototype.getStampFields =function(){
    return ["ct","lt"];
};

/**
 * Get/set a value for an environment sys variable
 * @param {string} key
 * @param {object} [value]
 * @returns {object}
 */
Environment.prototype.sys = function (key, value) {
    if (value !== undefined) {
        this.mySys[key] = value;
        return this;
    }
    return this.mySys[key];
};

/**
 * Get a value for an environment field or a new Date if the field is a stamp field
 * @param {string} key
 * @param {object} [value]
 * @returns {object}
 */
Environment.prototype.field = function (key, value) {
    if (value !== undefined) {
        this.fields[key] = value;
        return this;
    }
    if (this.stampFields[key]) {
        return  new Date();
    }
    return this.fields[key];
};



/**
 * Get/set a value for an environment usr variable
 * @param {string} key
 * @param {object} [value]
 * @returns {object}
 */
Environment.prototype.usr = function (key, value) {
    if (value !== undefined) {
        this.myUsr[key] = value;
        return this;
    }
    return this.myUsr[key];
};

/**
 * Enumerates all sys keys
 * @return {string[]}
 */
Environment.prototype.enumSys = function () {
    return _.keys(this.mySys);
};

/**
 * Enumerates all usr keys
 * @return {string[]}
 */
Environment.prototype.enumUsr = function () {
    return _.keys(this.myUsr);
};

function defaultQuoter(s, noSurroundQuotes) {
    if (noSurroundQuotes) {
        if (s === null || s === undefined) {
            return 'null';
        }
        if (typeof s === 'string' || s instanceof String) {
            return s;
        }
        return s.toString();
    }

    if (s === null || s === undefined) {
        return 'null';
    }
    if (typeof s === 'string' || s instanceof String) {
        return "'" + s.replace("'", "\\'") + "'";
    }
    return s.toString();
}

/**
 * Evaluates env.sys[idcustomuser], requires env.sys[user] to be already defined
 * @public
 * @param {DataAccess} conn
 * @return {Promise<object>}
 */
Environment.prototype.getCustomUser= function(conn){
    let d = Deferred();
    if (this.sys("idcustomuser")) {
        return d.resolve(this.sys("idcustomuser"));
    }
    conn.readSingleValue({
        tableName:"customuser",
        expr:"idcustomuser",
        filter:Q.eq("username",this.sys("user"))
    })
        .then(idcustomuser =>{
            this.sys("idcustomuser",idcustomuser);
            d.resolve(idcustomuser);
        })
        .fail((err)=>{
            d.reject(err);
        });
    return d.promise();
};



/**
 * Evaluates env.sys[usergrouplist], requires env.sys[user] to be already defined.
 * This is meant to be invoked when environment is created
 * @static
 * @param {DataAccess} conn
 * @return {Promise<Array.<object>>}
 */
Environment.prototype.getGroupList = function(conn) {
    let d = Deferred();
    if (this.sys("usergrouplist")) {
        return d.resolve(this.sys("usergrouplist"));
    }
    this.getCustomUser(conn)
        .then(idcustomuser=> {
            if (!idcustomuser){
                this.sys("usergrouplist",[]);
                d.resolve([]);
                return;
            }
            conn.select({
                tableName: "customusergroup",
                filter: Q.eq("idcustomuser", idcustomuser)
            })
                .then(t => {
                    this.sys("usergrouplist", t.map(r=>r.idcustomgroup));
                    d.resolve(this.sys("usergrouplist"));
                });

        });
    return d.promise();
};


function quote(s){
    if (typeof  s !== "string") {
        return  s;
    }
    return "'"+s.replace(new RegExp("'", 'g'), "''")+"'";
}
/**
 * invokes a stored procedure to compute environment, needs sys(idcustomuser)
 * @param {DataAccess} conn
 * @return {Promise}
 */
Environment.prototype.calcUserEnvironment = function(conn) {

    return  conn.callSP("compute_environment",
        [this.sys("esercizio"),this.sys("idcustomuser"),
                    this.sys("idflowchart")||null,this.sys("ndetail")||null])
        .then(res=>{
            if (!res){
                return Deferred().reject("No environment");
            }
            if (res.length !== 2){
                console.log(res);
                return Deferred().reject("Bad environment");
            }
            let sysVars= res[0][0];
            _.forOwn(sysVars,(value,key)=>{
               this.sys(key,this.compile(value));
            });

            let usrVars = res[1];
            usrVars.forEach(rUsr => {
                if (rUsr.mustquote.toUpperCase() === "S") {
                    this.usr(rUsr.variablename, this.compile(quote(rUsr.value)));
                }
                else {
                    this.usr(rUsr.variablename, this.compile(rUsr.value));
                }
            });

            return Deferred().resolve(true);
        });
};


Environment.prototype.compile = function (str, quoteFun, surroundQuotes) {
    if (typeof  str !== "string") {
        return  str;
    }
    quoteFun = quoteFun || defaultQuoter;
    if (surroundQuotes === undefined) {
        surroundQuotes = false;
    }
    var s = '',
        prev = '',
        that = this,
        replaceSys = function (match, p1) {
            return quoteFun(that.mySys[p1], !surroundQuotes);
        },
        replaceUsr = function (match, p1) {
            return quoteFun(that.myUsr[p1], !surroundQuotes);
        };
    while (prev !== str) {
        prev = str;
        s = str.replace(/(?:<%sys\[)[\s]*([\w]+)[\s]*(?:\]%>)/g, replaceSys);
        s = s.replace(/(?:<%usr\[)[\s]*([\w]+)[\s]*(?:\]%>)/g, replaceUsr);
        str = s;
    }
    return s;
};

Environment.prototype.compileFun = function(sqlFun,formatter) {
    return sqlFun.toSql(formatter,this);
};

/**
 * Loads environment from a database, it needs sys(user) and eventually idflowchart and ndetail
 *  to be present in sys variables
 * @param {DataAccess} conn
 * @return {Promise}
 */
Environment.prototype.load = function(conn){
    return this.getGroupList(conn)
        .then(()=>{
            return this.calcUserEnvironment(conn);
        });
};

module.exports = Environment;
