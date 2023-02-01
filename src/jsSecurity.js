/*globals ObjectRow,Environment,sqlFun ,SqlFormatter*/
/**
 * Manages data storing authorizations
 * @module Security
 */

/* jshint -W116 */
const dsSpace = require('./../client/components/metadata/jsDataSet');
const DataRowState = dsSpace.dataRowState;
const DataSet = dsSpace.DataSet;
const QParser = require('./jsDataQueryParser').JsDataQueryParser;
const Q = require('./../client/components/metadata/jsDataQuery');
const _ = require("lodash");

/**
 * if defaultIsDeny the meaning is allow and not deny. If deny is not set then the meaning is allow
 * Otherwise the meaning is not deny or allow. If allow is not set then the meaning is not deny
 * @typedef {Object} ConditionRow
 * @property {object} idcustomgroup id of the user group this condition belongs to
 * @property {string} tablename
 * @property {string} op I/U/D/S/P
 * @property {boolean} defaultIsDeny if true default is deny all, otherwise is allow all
 * @property {sqlFun} [denyCondition]
 * @property {sqlFun} [allowCondition]
 */


/**
 *
 * @typedef Deferred
 */
const    Deferred = require("JQDeferred");


/**
 * Class that manages a set of conditions
 * @class Security
 * @method Security
 * @constructor
 */
function Security(){
 this.groupOperations= [];
 /* {{sqlFun[]}} */
 this.tableOpConditions = {};
 /* Dictionary.<string,Array.<sqlFun>>*/
 this.filteredConditions= {};
}


Security.prototype= {
    constructor: Security,

    /**
     * Adds condition for a specified table/operation combination, merging to existent.
     * Every condition
     * @param {string}tableName
     * @param {string} op
     * @param {ConditionRow} condition
     */
    addTableOpCondition:function(tableName,op, condition){
        let key = tableName+'#'+op;
        let list=this.tableOpConditions[key];
        if (list===undefined){
            list = [];
            this.tableOpConditions[key]=list;
        }
        this.tableOpConditions[key].push(condition);
    },

    /**
     * Get all table/operation conditions for any environment
     * @param {string} tableName
     * @param {string} op
     * @return {Array.<ConditionRow>}
     */
    getTableOpConditions:function(tableName,op){
        let key = tableName+'#'+op;
        let list=this.tableOpConditions[key];
        if (list===undefined){
            return [];
        }
        return  list;
    },

    /**
     * Gets security conditions for an operation in the specified environment context.
     * Those are filtered basing on usergrouplist of the environment, that has to include
     *  idcustomgroup property value of the ConditionRow. If environment does not contain idcustomgroup
     *   field, then all matching table/op conditions are taken
     *
     * @param tableName
     * @param {string} op
     * @param  {Environment} env
     * @return {ConditionRow[]}
     */
    getConditions: function (tableName, op,env){
        /*{object []} */
        let idgroups= env.sys("usergrouplist");
        let key = tableName+'#'+op+'#'+idgroups.join('§');
        if (this.filteredConditions[key]!==undefined){
            return this.filteredConditions[key];
        }
        let conditions= _.filter(this.getTableOpConditions(tableName,op),
                    Q.or(Q.isNull("idcustomgroup"),Q.isIn("idcustomgroup",idgroups))
                );
        this.filteredConditions[key]=conditions;
        return  conditions;
    }

};
/**
 * Evaluates the SecurityCondition about a combination of tableName/opKind in the specified environment
 * Requires environment.sys("idcustomgroup") to have been already evaluated
 * @param {string} tableName
 * @param {string} opKind
 * @param {Environment} environment
 * @return {sqlFun}
 */
Security.prototype.securityCondition= function (tableName, opKind, environment){
    let conditions= this.getConditions(tableName,opKind,environment);
    let thereIsAnyCondition= false;
    let clauses=[];
    let defaultIsDeny ;
    conditions.forEach(r=>{
         thereIsAnyCondition = thereIsAnyCondition || (r.allow || r.deny);

        if (r.defaultIsDeny){
            //default is DENY, allow indicates the rows allowed
            defaultIsDeny=true;
            //current operation default is deny
            if (!r.allow) return;       //skip this, it is always false
            if (r.allow.isTrue){
                clauses.push(r.allow); //overall result will be true
                return;
            }
            if (!r.deny) {
                clauses.push(r.allow);
                return;
            }
            clauses.push(Q.and(r.allow,Q.not(r.deny)));
        }
        else {
            //default is ALLOW, deny indicates the rows prohibited
            defaultIsDeny=false;
            if (r.allow && r.allow.isTrue)return;//exception is always true so the overall
            if (r.deny){
                if (r.allow){
                    clauses.push(r.allow);
                    clauses.push(Q.not(r.deny)); //they will be or-ed in the result
                }
                else {
                    clauses.push(Q.not(r.deny));
                }
            }
        }
    });
    if (clauses.length===0){
        return  Q.constant(true);
    }
    if (clauses.length===1){
        return  clauses[0];
    }
    return  Q.or(clauses);
};

/**
 *
 * @param {ObjectRow} r
 * @param {Environment} env
 */
Security.prototype.canPost= function(r, env){
    let opkind=null;
    let DR = r.getRow();
    if (DR.table.skipSecurity()){
      return true;
    }

    switch (DR.state){
        case DataRowState.added:
            opkind= "I";
            break;
        case DataRowState.modified:
            opkind= "U";
            break;
        case DataRowState.deleted:
            opkind="D";
            break;
    }
    let filter = this.securityCondition(DR.table.name, opkind, env);
    return filter(r,env);
};

/**
 * Reads all data from customgroupoperation and compiles expression strings into sqlFun.
 * Creates ConditionRow items from rows stored on db, in order to create a Security object
 * @param {DataAccess} conn
 * @constructor
 * @returns {Promise<Security>}
 */
function SecurityProvider(conn){
     return conn.select({
        tableName:"customgroupoperation"
    })
        .then(t=>{
            let S = new Security();
            t.forEach(r=>{
                if (r.allowcondition){
                    if (r.allowcondition.startsWith("AND(")){
                        r.allowcondition = r.allowcondition.substr(3);
                    }
                    r.allow= QParser.prototype.from(r.allowcondition);
                }
                if (r.denycondition){
                    if (r.denycondition.startsWith("AND(")){
                        r.denycondition = r.allowcondition.substr(3);
                    }
                    r.deny= QParser.prototype.from(r.denycondition);
                }
                r.defaultIsDeny = (r.defaultisdeny.toUpperCase()==="S");
                S.addTableOpCondition(r.tablename,r.operation,r);
            });
            return S;
        });

}

module.exports = SecurityProvider;
