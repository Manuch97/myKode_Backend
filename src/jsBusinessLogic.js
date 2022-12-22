/*globals ObjectRow,Environment,sqlFun,objectRow,Context,MsgParser, jsDataQuery */

/**
 * Manages inviocation of business logic
 * @module jsBusinessLogic
 */


/* jshint -W069 */
const GetDataSpace = require('../src/jsGetData');
const dsSpace = require('./../client/components/metadata/jsDataSet');
const DataSet = dsSpace.DataSet;
const DataColumn = dsSpace.DataColumn;
const DataRowVersion = dsSpace.dataRowVersion;
const DataRowState = dsSpace.dataRowState;

const Parser = require('./jsMsgParser').MsgParser;


/* {DataRow} */
const DataRow = dsSpace.DataRow;

const DataTable = dsSpace.DataTable;

const jsMultiSelect = require('./jsMultiSelect');
const DataAccess = require('./jsDataAccess').DataAccess;

const Select = jsMultiSelect.Select;
const isolationLevels = require('./jsDataAccess').isolationLevels;

const q = require("./../client/components/metadata/jsDataQuery").jsDataQuery;
const _ = require('lodash');
const BusinessLogicResult = require("./jsPostData").BusinessLogicResult;
const BasicMessage = require("./jsPostData").BasicMessage;
const PostData=require("./jsPostData").PostData;
/**
 * jsBusinessLogic
 * Use of this class should be
 *
 * let jBs = new jsBusinessLogic(conn, environment, rowChanges);
 * jBs
 * let Post = new PostData(conn, environment);
 */



/**
 *
 * @type function
 */
const Deferred = require("JQDeferred");



/**BusinessMessage
 * Represents a message connected to a changed (modified, added, deleted) row
 * @class
 * @augments BasicMessage
 * @param {RowChange} [options.rowChange] row to check
 * @param {DataRow} [options.r] DataRow to check, needed if rowChange is not provided
 * @param {boolean} options.post true is is a post commit data check
 * * @param {string} options.toCompile
 * @param {string} options.shortMsg  rule name, audit["title"]
 * @param {string}  options.longMsg complete message, used for merging , audit["message"] compiled
 * @param {string} [options.idRule] id of the business rule, audit["idaudit"], means to be the b.r. "group code"
 * @param {int} [options.idDetail]    id of the detail for the business rule, audit["idcheck"], b.r. number
 * @param {Environment} options.environment
 * @param {boolean} options.canIgnore true if it is a warning, false if it is an unrecoverable error (audit["severity"].toLowerCase()==="w")
 */
function BusinessMessage (options){
    BasicMessage.apply(this,[options.longMsg,options.canIgnore]);
    this.rowChange = options.rowChange;

    if (options.rowChange){
        this.r=options.rowChange.r;
    }
    if (options.r){
        this.r=options.r;
    }

    this.shortMsg=options.shortMsg; //nome della regola (audit["title"])
    this.idRule=options.idRule;     // audit["idaudit"], means to be the b.r. "group code"
    this.idDetail=options.idDetail; // audit["idcheck"], b.r. number
    this.environment=options.environment;
    this.post = options.post;

    /**
     *
     * @type {OneSubst[]}
     */
    this.openSubstitutions=[];


    let compiled = "";

    let /*MsgParser*/ parser = this.getParser(options.longMsg);
    let token= parser.getNext();
    while(token!== null){
        if (token.skipped) {
            compiled += token.skipped;
        }
        if (token.found!== null){
            compiled+= this.compileParameter(options.rowChange,token.found);
        }
        token= parser.getNext();
    }
    this.setMessage(compiled);
}

BusinessMessage.prototype =  _.extend(
    new BasicMessage("dummy",false),
    {
            constructor: BusinessMessage,
            superClass: BasicMessage.prototype,
        getId: function (){
                return this.msg+"#"+this.idRule;
        },


    }
);

/**
 * @method getParser
 * param {string} msg
 * @return {MsgParser}
 */
BusinessMessage.prototype.getParser= function(msg){
    return new Parser(msg,"%<",">%");
};

/**
 * Gets parameter from row or delays evaluation adding an open substitution to the openSubstitutions list
 * @method
 * @param {DataRow} focusedRow
 * @param {string} colName
 * @param {string} msgTable
 * @param {string} fromTable
 * @return {string}
 */
BusinessMessage.prototype.getParameter = function(focusedRow, colName,msgTable,fromTable){
    if (!focusedRow){
        return "";
    }
    let colFound = this.findPostingColumn(focusedRow.table,colName);
    if (colFound){
        return focusedRow.current[colFound];
    }
    let original="%<"+msgTable+"."+colName+">%";
    this.openSubstitutions.push(new OneSubst(colName,msgTable,original,fromTable));
    return original;
};


/**
 * Translate a Parameter name into a value, taking data from A and related. If it is not possible to extract it,
 *  pushes a new open substitution to the openSubstitutions array and returns the uncompiled expression
 * @param {RowChange} rowChange
 * @param {string} expr
 */
BusinessMessage.prototype.compileParameter = function(rowChange, expr){
    let r= rowChange.r;
    let parameter = expr.trim();
    let pieces = parameter.split(".");
    let tableName;
    if (pieces.length>1) {
        tableName= pieces[0];
    }
    else {
        tableName=r.table.name;
    }
    let colExpression;

    Object.values(r.table.columns).some(/* {DataColumn}*/ c=>{
        if (c.name=== parameter){//manage the simplest case
            colExpression= r[parameter];
            return true;
        }
        if (c.expression === parameter){
            colExpression= this.getParameter(r,c.name,tableName,r.table.name);
            return  true;
        }
    });

    if (colExpression!==undefined){
        return colExpression;
    }
    if (pieces.length>1) { //parameter like "tablename.columnName"
        let colName= pieces[1];
        let rRelated=rowChange.getRelated(tableName);
        if (!rRelated){
            let original="%<"+parameter+">%";
            this.openSubstitutions.push(new OneSubst(colName,tableName,original,r.table.name));
            return  original;
        }
        return this.getParameter(rRelated,colName,tableName,r.table.name);
    }
    else { //parameter like "fieldName"
        let o = this.environment.sys(parameter);
        if (o) {
            return o;
        }
        return  this.getParameter(r, parameter, tableName, r.table.name);

    }
};





/**
 * Evaluates the column corresponding to a db field
 * @param {DataTable} t
 * @param {string} field
 * @returns {string|null}
 */
BusinessMessage.prototype.findPostingColumn = function (t, field){
    /** @type {DataColumn} */
    let c= t.columns[field];
    if (c){ //a field was found with given name
        if (t.tableForWriting()===t.name){
            return field;
        }
        if (c.forPosting===field){
            return field;
        }
    }
    //searches for a column having "forPosting" set as given field name
    if (t.tableForWriting()!==t.name) {
        let postingCol = _.find(t.columns, c => c.forPosting === field);
        if (postingCol) {
            return postingCol.name;
        }
    }
    if (c===undefined) {
        return null;
    } //field was not found

    if (c.forPosting ) {
        return null;
    } //a field was found but it has another posting column (
    return field; //forPosting is the same as field
};



/**
 * Manages business logic invocation
 * @class BusinessLogic
 * @method BusinessLogic
 * @param {Context} context
 * @param {ObjectRow[]} rowChanges
 * @constructor
 */
function BusinessLogic(context, rowChanges){
    /* {Context} */
    this.context = context;

    /*{DataAccess}*/
    this.conn= context.sqlConn;

    /* {DbDescriptor} */
    this.dbDescriptor = context.dbDescriptor;

    /*{Environment}*/
    this.environment = context.environment;

    /* {Connection} the sql driver, can be jsSqlDriver or jsMySqlDriver */
    this.driver = context.sqlConn;

    /* {ObjectRow[]}  */
    this.rowChanges = rowChanges;

    /* @property {Promise<DataSet>} auditsPromise*/
    this.auditsPromise = this.getRules(rowChanges); //starts evaluating

    /* property {BusinessMessage[]} messages */
    this.messages = [];

    /*{jsDataQuery}*/
    this.ruleFilter = this.getFilterForRules();

    this.maxQueryLength= 10000;

}



BusinessLogic.prototype = {
    constructor: BusinessLogic,
    maxBatchSize: 40000,
    envFilterVariableName:"filterrules",
    /**
     *
     * @return {jsDataQuery}
     */
    getFilterForRules: function(){
        return this.environment.sys(this.envFilterVariableName);
    },
    destroy: function() {
        const def = Deferred();
        if (!this.auditsPromise) {
            return def.resolve(true).promise();
        }
        this.auditsPromise.then(() => {
                def.resolve(true);
            },
                err => def.reject(err)
        );
        return def.promise();
    }
};

/**
 * Creates a db error
 * @param {string} message
 * @param {boolean} post
 */
BusinessLogicResult.prototype.makeDbError = function (message,post){
    return new BusinessMessage({post:post,shortMsg:"Generic error", longMsg:message,canIgnore:false});
};

/**
 * Adds a db error
 * @param {string} message
 * @param {boolean} post
 */
BusinessLogicResult.prototype.addDbError = function (message,post){
    message = message.stack||message.message||message;
    return this.addMessage(this.makeDbError(message,post));
};




/**
 * Get stored procedure name to be called to check r audits
 * @param {ObjectRow} r
 * @param {boolean} post
 * @return {string}
 */
BusinessLogic.prototype.getProcName = function (r, post){
    let suffix = post? "post":"pre";
    let  row= r.getRow();
    let postingTable = row.table.tableForWriting();
    return "check_"+postingTable+"_"+this.opCode(row)+"_"+suffix;
};

/**
 * Gives a code for operation being applied to r
 * @param {DataRow} r
 * @return {string}
 */
BusinessLogic.prototype.opCode = function (r){
    switch (r.state ){
        case  DataRowState.added: return "i";
        case  DataRowState.deleted: return "d";
        case  DataRowState.modified: return "u";
    }
    return undefined;
};

/**
 * calculate a filter to obtain rule parameters
 * @param {ObjectRow} r
 * @param {boolean} post
 * @return {sqlFun}
 */
BusinessLogic.prototype.getProcFilter= function (r, post) {
    /** {DataTable */
    let  row= r.getRow();
    return q.and (q.eq("precheck", post?"N":"S"),
                        q.isNotNull("sqlcmd"),
                        q.ne("severity","I"),
                        q.eq("tablename",row.table.tableForWriting()),
                        q.eq("opkind",this.opCode(row).toUpperCase())
    );
};

/**
 * Creates a dataset to read db checks
 * @return {DataSet}
 */
BusinessLogic.prototype.createAuditDataSet = function (){
    let ds = new DataSet("audit");
    ds.newTable("tableop");
    let auditcheckview= ds.newTable("auditcheckview");
    ds.newTable("auditparameter");
    ds.newRelation("tableop_auditcheckview",
        "tableop",["tablename","opkind"],
        "auditcheckview", ["tablename","opkind"]);
    ds.newRelation("tableop_auditparameter",
        "tableop",["tablename","opkind"],
        "auditparameter", ["tablename","opkind"]);
    auditcheckview.staticFilter(q.and(q.isNotNull("sqlcmd"),q.ne("severity","I")));
    auditcheckview.orderBy("idaudit ASC, idcheck ASC");
    return ds;
};

/**
 * Gets necessary rules from a database in order to save a set of row change. This can ben invoked
 *  before the start of a transaction.
 * @param {ObjectRow[]} rowChanges  changes made in memory
 * @returns {Deferred<DataSet>}
 */
BusinessLogic.prototype.getRules = function  ( rowChanges){
    let ds = BusinessLogic.prototype.createAuditDataSet();
    let tableOp= ds.tables["tableop"];
    let added= new Set();
    _.forEach(rowChanges,function(r){
        const row= r.getRow();
        const t= row.table.name;
        const kind = BusinessLogic.prototype.opCode(row);
        const k= t+"#"+kind;
        if (!added.has(k)) {
            added.add(k);
            tableOp.newRow({tablename:t, opkind:kind});
        }
    });
    tableOp.acceptChanges();
    let def= Deferred();

    GetDataSpace.getStartingFrom(this.context, tableOp).
        then(function(){
            def.resolve(ds);
        })
        .fail(err=>def.reject(err));

    return def.promise();
};

/**
 * Evaluates a series of messages
 * @param {BusinessLogicResult} result
 * @param {DataAccess} conn Current connection having the transaction attached
 * @param {boolean} post
 * @returns  {Promise<BusinessLogicResult>}
 */
BusinessLogic.prototype.getChecks =  function (result, conn, post) {
    let def= Deferred();
    try {
        this.getChecksAsync(result,conn,post).then(function(r){
            def.resolve(result);
        });
    }
    catch(err){
        def.reject(err);
    }
    return def.promise();
};

/***
 * Extracts audit checks for every row change in input
 * @param {DataTable} auditview
 * @param {ObjectRow[]} changes
 * @param {boolean} post
 * @returns {ObjectRow[]} an array of auditview rows for each audit sp name
 */
BusinessLogic.prototype.groupChecks = function (auditview,changes,post){
    let audits = {};
    changes.forEach(r=> {
        let spName = this.getProcName(r, post);
        if (audits[spName]) {
            return; //already evaluated
        }

        let filterCheck = this.getProcFilter(r, post);
        if (this.ruleFilter) {
            filterCheck = q.and(filterCheck, this.ruleFilter);
        }

        audits[spName] = auditview.select(filterCheck)
            .sort(function (a, b) { //sort by idaudit asc, idcheck asc
                if (a.idaudit > b.idaudit) {
                    return 1;
                }
                if (a.idaudit < b.idaudit) {
                    return -1;
                }
                if (a.idcheck > b.idcheck) {
                    return 1;
                }
                if (a.idcheck < b.idcheck) {
                    return -1;
                }
                return 0;
            });

    });
    return  audits;
};

/**
 * Evaluates a series of messages
 * @param {BusinessLogicResult} result
 * @param {DataAccess} conn Current connection having the transaction attached
 * @param {boolean} post
 * @returns  {Promise<BusinessLogicResult>}
 */
BusinessLogic.prototype.getChecksAsync = async function (result, conn, post){
    const def = Deferred();



    /* {DataSet} */
    let auditsDS = await this.auditsPromise;

    //extracts only rules applying in this phase (pre/post)
    /* {{objectRow[]}} */
    let auditChecks= this.groupChecks(auditsDS.tables["auditcheckview"], this.rowChanges, post);

    let logCalls = new Set();
    let batchCommand= [];
    let batchLen=0;
    /*{Deferred}*/
    let overallInvoke=null;
    /* {RowChange[]} */
    let changes= [];
    let numAudit=0;

    //this construct is necessary to execute different batch serially
    await this.rowChanges.reduce( async (previousResult,r)=>{
        await previousResult;
        let spName= this.getProcName(r,post);
        if (!auditChecks[spName]){
            return [];
        }
        let nChecks= auditChecks[spName].length;
        if (nChecks===0){
            return [];
        }
        numAudit+=1;
        let varName= this.driver.variableNameForNBits(numAudit, nChecks);
        let sqlType = this.driver.sqlTypeForNBits(nChecks);

        let rc = new RowChange(nChecks, r.getRow(),auditChecks[spName],varName,this.driver.colNameFromVarName(varName));
        changes.push(rc);

        //this is an array of parameters required to invoke the check sp.
        let parameters = this.parametersFor(auditsDS.tables["auditparameter"],rc,post);


        //evaluates an hash to detect if the same call has already been queued
        let proc_sign=spName+":";
        parameters.forEach(p =>{
            proc_sign+= p.name+"="+p.value+";";
        });
        if (logCalls.has(proc_sign)){ //call already queued
            return [];
        }
        logCalls.add(proc_sign);

        //let varDeclaration= this.driver.declareAndClearVariableForNBits(varName,nChecks);
        //batchCommand.push(varDeclaration);
        //puts result in variable named varName, that at the end will go into a column named
        parameters.splice(0,0, this.driver.createSqlParameter(undefined,'@res',varName,sqlType,true));

        let slqCheckInvoke= this.driver.getSqlCallSPWithNamedParams({spName:spName,paramList:parameters,skipSelect:true});
        batchCommand.push(slqCheckInvoke);
        batchLen+=slqCheckInvoke.length;

        if(batchLen>this.maxBatchSize){
            let batch=this.driver.appendCommands(batchCommand);
            //every batch must be executed in sequence, stopping on the first db error
            await  this.execCheckBatch(conn,changes,batch,result,post);
            numAudit=0;
            batchCommand=[];
            batchLen=0;
            changes= [];
        }
        return [];
    },[]);


    if (batchLen>0){ //same as before
        let batch=this.driver.appendCommands(batchCommand);
        await  this.execCheckBatch(conn,changes,batch,result,post);
    }

    //reads missing data to fill messages from database
    await this.refineMessages(conn, result.checks);

    return result;

};

/**
 * Evaluate queries for business messages open substitutions calling setQuery and setCols
 * @param {DataSet} d
 * @param {BusinessMessage[]} results
 * @return {Deferred}
 */
BusinessLogic.prototype.refineMessages_evaluateQueries= async function(d, results){

    return  results.reduce(async (dummyMessage,bm)=>{
        await dummyMessage;
        //console.log("reducing businessmessage "+bm.msg);
        return bm.openSubstitutions.reduce(async (dummySubst,o)=> {
            //console.log(bm.msg+": reducing openSubstitutions "+o.tableName);
            if (o.query) {
                return "query already present";
            }
            await  dummySubst;
            let /*DataTable*/ t = d.tables[o.tableName];
            if (!t){
                try {
                    t = await this.dbDescriptor.createTable(o.tableName);
                }
                catch (err){
                    //console.log(err);
                    return err;
                }

                d.addTable(t);
            }
            let /*DataTable*/ base=d.tables[o.fromTable];
            if(!base){
                try {
                    base = await this.dbDescriptor.createTable(o.fromTable);
                    d.addTable(base);
                }
                catch (err){
                    //console.log(err);
                    return err;
                }
            }
            if (base.key().length === 0 || t.key().length===0){
                let postingT;
                try {
                    postingT = await this.dbDescriptor.createTable(bm.r.table.tableForWriting());
                }
                catch (err){
                    //console.log(err);
                    return err;
                }

                if (base.key().length === 0 && postingT.key().length>0){
                    let absentColumns= postingT.key().filter(c=>base.columns[c]===undefined);
                    if (absentColumns.length===0){
                        //console.log("base key set to "+base.name+" from table "+postingT.name);
                        t.key(postingT.key());
                        base.key(postingT.key());
                    }
                }
                if (t.key().length === 0 && postingT.key().length>0){
                    let absentColumns= postingT.key().filter(c=>t.columns[c]===undefined);
                    if (absentColumns.length===0){
                        //console.log("t key set to "+t.name+" from table "+postingT.name);
                        t.key(postingT.key());
                    }
                }
            }
            let cols= [];
            let /*jsDataQuery*/ query = this.getQuery(base,bm.r, t, cols);//fromT = base, toTable= t
            if (query===undefined){ //empty query
                //console.log("assigning true to o.error");
                o.error=true;
                // results.push(new BusinessMessage({
                //     rowChange:bm.rowChange,post:bm.post,shortMsg:"Error in Business rule",
                //     longMsg:"Reference to table "+o.tableName+"."+o.field+" in rule "+
                //         bm.idRule+" "+bm.r.table.name+ " "+bm.idDetail+" is not valid.",canIgnore:false
                // }));
                let err="Reference to table "+o.tableName+"."+o.field+" in rule "+
                    bm.idRule+" on "+bm.r.table.name+ " id:"+bm.idDetail+" is not valid (missing key column).";
                //console.log(err);
                return err;
            }
            if (!t.columns[o.field]){ //empty query
                //console.log("assigning true to o.error");
                o.error=true;
                // results.push(new BusinessMessage({
                //     rowChange:bm.rowChange,post:bm.post,shortMsg:"Error in Business rule",
                //     longMsg:"Reference to table "+o.tableName+"."+o.field+" in rule "+
                //         bm.idRule+" "+bm.r.table.name+ " "+bm.idDetail+" is not valid.",canIgnore:false
                // }));
                let err="Reference to table "+o.tableName+"."+o.field+" in rule "+
                    bm.idRule+" on "+bm.r.table.name+ " id:"+bm.idDetail+" is not valid (missing  column "+o.field+").";
                //console.log(err);
                return err;
            }
            o.setCols(cols);
            o.setQuery(query);

            //Sets query for all substitutions for that message on the same table
            bm.openSubstitutions.forEach(oo=>{
                if (oo.tableName!== o.tableName || oo.fromTable !== o.fromTable || oo.query!==null) {
                    return;
                }
                oo.setQuery(o.query);
                oo.setCols(cols);
                if (!t.columns[oo.field]){
                    oo.error=true; //t does not contain that field
                }
            });

            return "Ok";
        },undefined);

    },undefined);

};

/**
 * Group all queries into SubstGroup
 * @param {BusinessMessage[]} results
 * @param {int} maxQueryLength max len for queries
 * @return {SubstGroup[]}
 */
BusinessLogic.prototype.refineMessages_groupQueries= function(results, maxQueryLength){
    /*{SubstGroup[]}*/
    if (maxQueryLength===undefined){
        maxQueryLength = this.maxQueryLength;
    }
    let subs = [];
    results.forEach(bm =>{
        if (bm.error) {
            return;
        }
        bm.openSubstitutions.forEach(o=>{
            if (o.error || o.query===null) {
                return;
            }
            let found= subs.find(s=>{
                return s.mergeQuery(o,maxQueryLength);
            });
            if (found===undefined){
                let g = new SubstGroup(o.tableName);
                g.mergeQuery(o,maxQueryLength); //surely returns true, because it is empty and on the same table
                subs.push(g);
            }
        });
    } );
    return subs;
};

/**
 * Execute queries stored in grouped substitutions
 * @param {SubstGroup[]} subs
 */
BusinessLogic.prototype.refineMessages_executeQueries= async function(subs){
    return await subs.reduce(async (dummy,s)=>{
        await  dummy; //executes query one at a time
        s.data= await this.context.dataAccess.select({
            tableName:s.tableName,
            filter: q.or(s.query),
            columns: Array.from(s.queryCols).join(","),
            environment: this.environment
        });
        return subs;
    },null);
};


/**
 * Apply substitutions basing on data got in subs
 * @param {SubstGroup[]} subs
 * @param {BusinessMessage[]} msgs
 * @return {*}
 */
BusinessLogic.prototype.refineMessages_applySubstitutions= function(subs, msgs){
    msgs.forEach(bm => {
        bm.openSubstitutions.forEach(o => {
            if (o.error){
                o.newValue= "[bad reference to "+o.tableName+"."+o.field+"]";
            }
            else {
                let somethingFound= subs.find(s=>{
                    if (!s.data){
                        return  false;
                    }
                    if (s.tableName!==o.tableName) {
                        return false;
                    }
                    let rowFound=  s.data.find(o.query);
                    if (!rowFound){
                        return  false;
                    }
                    o.newValue = rowFound[o.field];
                    return true;
                });
                if (!somethingFound){
                    o.newValue="[row not found in table "+o.tableName+" with filter "+o.queryString+"]";
                    o.error=true;
                }
            }
            bm.setMessage(bm.msg.split(o.original).join(o.newValue)); //replaceAll is not supported in node.js 14
        });
    });
};

/**
 * returns a Deferred that resolves when f resolves or throw
 * @param f
 */
function fromAsyncToDeferred(f){

}

/**
 * Reads data from db in order to compile messages. Tries to optimize db access performing as little reads as possible
 * @param {DataAccess} conn
 * @param {BusinessMessage[]} results
 * @return {Promise<BusinessMessage[]>}
 */
BusinessLogic.prototype.refineMessages= async function (conn, results){
    let allReads = new Set(); //hashes of already appended query
    let d = new DataSet("rules");

    //step 1: evaluate query to apply to calc all message fields
    await  this.refineMessages_evaluateQueries(d,results);

    //step 2: group all queries
    /*{SubstGroup[]}*/
    let subs = this.refineMessages_groupQueries(results, this.maxQueryLength);

    //step 3: executes queries
    await this.refineMessages_executeQueries(subs);

    //step 4: apply substitutions
    this.refineMessages_applySubstitutions(subs,results);

};
//= this.getQuery(base,bm.rowChange, t, cols);

/**
*  Evaluates a jsDataQuery to read data of toTable from database
 * FromT is a table while toTable could be a view, so could not have a primary key
 * @param {DataTable} fromT
 * @param {DataRow} fromR
 * @param {DataTable} toTable
 * @param {Array.<string>} cols key columns  and eventually  ayear field if it belongs to table columns
 * @return {jsDataQuery}
 */
BusinessLogic.prototype.getQuery = function (fromT, fromR, toTable, cols){
    let /*jsDataQuery*/ filter;
    //Tries to complete toTable's key with the key of fromT if it exists
    //console.log("getQuery("+fromT.name+",fromR,"+toTable.name+",cols)");
    if (toTable.key().length ===0){
        //console.log("setting key from "+fromT.name);
        let newKey= fromT.key().reduce((/*string[]*/ keys, /*string*/keyField)=>{
            if (!toTable.columns[keyField]){
                //console.log("skipping "+keyField);
                return;
            }
            let clause=q.eq(keyField,fromR.current[keyField]);
            filter =  filter?  q.and(filter,clause):  clause;
            cols.push(keyField);
            //console.log("adding "+keyField+" from "+fromT.name);
        },[]);
        if (toTable.columns["ayear"] && fromT.isKey("ayear")===false){
            let clause=q.eq("ayear",this.environment.field("ayear"));
            filter = filter? q.and(filter, clause): clause;
            cols.push("ayear");
        }
        return filter;
    }
    let primaryKeyIncomplete=false;

    toTable.key().forEach(k=>{
        if (! fromT.columns[k]){
            //console.log("skipping 2 "+k+" from "+fromT.name);
            primaryKeyIncomplete=true;
            return;
        }
        let clause=q.eq(k,fromR.current[k]);
        filter =  filter? q.and(filter,clause): clause ;
        cols.push(k);
        //console.log("adding 2 "+k+" from "+fromT.name);
    });

    if (toTable.columns["ayear"] && primaryKeyIncomplete && fromT.isKey("ayear")===false){
        filter = q.and(filter, q.eq("ayear",this.environment.field("ayear")));
        cols.push("ayear");
    }
    return  filter;

};

/**
 * Executes a batch and adds messages to results
 * @param {DataAccess} conn
 * @param {RowChange[]}  checks
 * @param {string} cmd
 * @param {BusinessLogicResult} result used to push found errors
 * @param {boolean} post
 * @return {*}
 */
BusinessLogic.prototype.execCheckBatch=  async function (conn,
                                                  checks,
                                                  cmd,
                                                         result,
                                                  post) {
    let mapNames= _.map(checks,c=>{
        return {varName:c.varName,colName:this.driver.colNameFromVarName(c.varName)};
    });
    let sql = this.driver.appendCommands([cmd, this.driver.getSelectListOfVariables(mapNames)]);
    try {
        let res = await conn.runSql(sql); //returns an array of objects
        //res is an object with a column for each var name contained in checks
        if (res === undefined || res === null || res.length === 0) {
            result.addDbError("Error invoking business logic\nNo result got from business logic", post);
            return;
        }
        let valueRead= res[0];
        //converts results in messages
        checks.forEach(c => {
            let colName= this.driver.colNameFromVarName(c.varName);
            //every column in the result relates to the RowChange having same index
            if (valueRead[colName]===undefined){
                result.addDbError("Error invoking business logic\ncolumn "+
                    colName+" has not been included in the result.", post);
                return;
            }
            /* {string} 01 sequence decoding the result*/
            let bits  = this.driver.getBitArray(valueRead[colName],c.nChecks);
            this.addMessages(c,bits,result,post);
        });
    }
    catch (err) {
        result.addDbError("Error invoking business logic\nRunning command +" + cmd + ".\n" + err, post);
    }
};

/**
 * Takes error messages and append them to results
 * @param {RowChange} rowChange
 * @param {string} bits 01 representation of sp result
 * @param {BusinessLogicResult} result set, messages are added to this list
 * @param {boolean} post  true if post message
 * @return {*}
 */
BusinessLogic.prototype.addMessages = function(rowChange,bits, result, post){
    ///static void EasyProcedureMessageCollection.DO_ADD_MESSAGES
    for(let i=0; i<rowChange.nChecks; i++){

        if (bits[i]==="1"){
            let audit=rowChange.audits[i];      //row of auditcheckview

            //pushes current message evaluated to the output list
            //there can be more than one BusinessMessage attached to the same rowChange object
            //every BusinessMessage has a list of open substitutions
            result.addMessage(new BusinessMessage({
                rowChange:rowChange,
                post:post,
                shortMsg: audit["title"],
                longMsg:    audit["message"],
                canIgnore:  audit["severity"].toLowerCase()==="w",
                idDetail : audit["idcheck"],
                idRule: audit["idaudit"],
                environment: this.environment
            }));

        }
    }

};

/**
 * Evaluates the filter to obtain parameters for a audit call
 * @param {DataRow} r
 * @param {boolean} post
 */
BusinessLogic.prototype.filterParameters = function (r,post){
    return q.mcmpEq({
                tablename:r.table.tableForWriting(),
                opkind:this.opCode(r).toUpperCase(),
                isprecheck: post?"N":"S"
    });
};

/**
 * Establish if a field must be passed to Business audits
 * @param {DataRow} r
 * @param {string} colName
 */
BusinessLogic.prototype.isTempAutoIncrement = function ( r, colName) {
    if (r.state === DataRowState.added && r.table.autoIncrementColumns[colName]!==undefined) {
        return true;
    }
    if (r.state !== DataRowState.added) {
        return  false;
    }
    let result= false;
    _.forEach(r.table.dataset.relationsByChild[r.table.name],rParentRelation=>{
        if (result){
            return;
        }
        let colRelIndex = rParentRelation.childCols.indexOf(colName);
        if (colRelIndex<0){
            return;
        }
        let parentRows = rParentRelation.getParents(r.current);
        if (parentRows.length===0){
            return;
        }
        let parentRow=parentRows[0];
        if (parentRow.getRow().state!== DataRowState.added){
            return;
        }
        result= this.isTempAutoIncrement(parentRow.getRow(), rParentRelation.parentCols[colRelIndex]);
    });

    return  result;
};


/**
 * Returns a collection of (name, value) couples, evaluated basing on auditParameters
 * @param {DataTable} auditParameters
 * @param {RowChange} rc
 * @param {boolean} post
 * @returns  {Array.<{name:string, value}>}
 */
BusinessLogic.prototype.parametersFor = function (auditParameters, rc,post) {
    /* {DataRow} */
    let row = rc.r;
    let filter = this.filterParameters(row, post);
    /* Array.<{tablename:string, parameterid:int, paramtable:string, paramcolumn:string, flagoldvalue:string}> */
    let pp = _.sortBy(auditParameters.select(filter), ["parameterid"]);

    let result = [];
    let that = this;

    let namedParamSupported= this.driver.namedParameterSupported();
    let pushOptionalParam = function (){
        if (!namedParamSupported){
            result.push(that.driver.createSqlParameter(null));
        }
    };

    pp.forEach(
        /** {tablename:string, parameterid:int, paramtable:string, paramcolumn:string, flagoldvalue:string} */
        p => {
            if (p.paramtable === "sys") {
                let o;
                if (p.paramcolumn.startsWith("sys_")) {
                    o = this.environment.sys(p.paramcolumn.substr(4));
                }
                else {
                    o = this.environment.sys(p.paramcolumn);
                }
                result.push(that.driver.createSqlParameter(o, '@'+p.paramcolumn));
                return;
            }
            if (p.paramtable === "usr") {
                let o;
                if (p.paramcolumn.startsWith("usr")) {
                    o = this.environment.usr(p.paramcolumn.substr(4));
                }
                else {
                    o = this.environment.usr(p.paramcolumn);
                }
                result.push(that.driver.createSqlParameter(o, '@usr_'+p.paramcolumn));
                return;
            }
            let newValueParameter = p.flagoldvalue.toUpperCase() !== "S";
            let paramName = newValueParameter ? "@NEW" : "@OLD";
            if (p.paramtable.toLowerCase() !== p.tablename.toLowerCase()) {
                paramName += "_" + p.paramtable;
            }
            paramName += "_" + p.paramcolumn;

            /*{DataRow} */
            let relatedDataRow = rc.getRelated(p.paramtable);
            if (relatedDataRow === null) {
                pushOptionalParam();
                return;
            }

            let rowVer;
            let rState = relatedDataRow.state;
            if (rState === DataRowState.deleted) {
                rowVer = DataRowVersion.original;
                newValueParameter = false;
            }
            else {
                rowVer = newValueParameter || (rState === DataRowState.added) ? DataRowVersion.current : DataRowVersion.original;
            }
            let foundColumn = BusinessMessage.prototype.findPostingColumn(relatedDataRow.table, p.paramcolumn);
            if (foundColumn === null) {
                pushOptionalParam();
                return;
            }
            if (newValueParameter && that.isTempAutoIncrement(relatedDataRow, foundColumn)) {
                pushOptionalParam();
                return;
            }
            let paramValue= relatedDataRow.getValue(foundColumn, rowVer);
            if (paramValue!==null){
                result.push(that.driver.createSqlParameter(paramValue, paramName));
            }
            else {
                pushOptionalParam();
            }
        });
    return result;
};


/**
 *
 * @class
 * @param {string} field
 * @param {string} tableName
 * @param {string}  original Table name.field as in original message
 * @param {string} fromTable Table name of changed row
 * @constructor
 */
function OneSubst(field, tableName,original,fromTable){
    /**
     * when true, substitution is wrong
     * @property {boolean} error
     */
    this.error=false;

    this.tableName = tableName;

    /**
     * %<table.field>% or %<field>%
     * @property {string} original
     */
    this.original= original;

    /**
     * string that will replace the "original" sequence in the message
     * @property {string|null} newValue
     */
    this.newValue = null;

    /**
     * Table name of changed row
     * @property {string} fromTable
     */
    this.fromTable = fromTable;

    /**
     * Field name
     * @property {string} field
     */
    this.field= field;



    /**
     *
     * @property {string}
     */
    this.queryString= null;

    /**
     *
     * @property {jsDataQuery}
     */
    this.query= null;

    /**
     * Columns present
     * @property {Set<string>} queryCols
     */
    this.queryCols  =  new Set();
}

OneSubst.prototype = {
    constructor: OneSubst,

    /**
     * Sets the first query and puts the hash in a property
     *  @param {jsDataQuery} query
     */
    setQuery : function (query){
        this.queryString = query.toString();
        this.query = query;
    },
    /**
     *
     * @param {string[]}cols
     */
    setCols : function (cols){
        cols.forEach(c => this.queryCols.add(c));
    },


};

/**
 * Groups a set of OneSubst
 * @class
 * @param {string} tableName
 * @constructor
 */
function SubstGroup(tableName){
    /**
     * @property {string} tableName
     */
    this.tableName= tableName;

    /**
     * @property {jsDataQuery[]} query
     */
    this.query  =  [];

    /**
     * @property {Set<string>} querySet
     */
    this.querySet  =  new Set();

    /**
     * @property {Set<string>} queryCols
     */
    this.queryCols  =  new Set();

    this.querySize=0;


    /**
     * @property {ObjectRow[]} data
     */
    this.data = null;
}


SubstGroup.prototype = {
    constructor: SubstGroup,

    /**
     * adds a new query if it is on same table and it is not already present
     * @param {OneSubst} subst
     * @param {int} maxQueryLength
     * @return {boolean} true if could merge
     */
    mergeQuery: function (subst,maxQueryLength){
        if(subst.error){
            return false;
        }
        if (subst.tableName!== this.tableName){
            return false;
        }

        if (this.querySet.has(subst.queryString)){
            this.queryCols.add(subst.field);
            return true;
        }

        if (this.querySize>=maxQueryLength){
            return  false;
        }
        this.querySet.add(subst.queryString);
        if (this.querySize>0){
            this.querySize+=5;
        }
        this.querySize+= subst.queryString.length;
        this.query.push(subst.query);
        subst.queryCols.forEach(c => this.queryCols.add(c));
        this.queryCols.add(subst.field);
        return true;
    }
};

/**
 * Represents a changed row with related information to display a message
 * @class
 * @param {int} nChecks number of checks  applied to the row
 * @param {DataRow} r   DataRow being changed (added/modified/deleted)
 * @param {ObjectRow[]} audits  rows from auditcheckview related to this change
 * @param {string} varName  variable name used in stored procedure invocation
 * @param {string} colName  column name that will receive the result
 * @constructor
 */
function RowChange(nChecks,r,audits,varName,colName){
    this.nChecks = nChecks;

    /**
     * changed DataRow
     * @property {DataRow} r
     */
    this.r=r;

    /**
     * @property {string} tableName
     */
    this.tableName = r.table.name;

    this.audits=audits;
    this.varName = varName;
    this.colName = colName;


    /* {{DataRow}} dictionary of related rows*/
    this.related = {};

    this.hasBeenScanned = new Set();

}


RowChange.prototype = {
    constructor: RowChange
};


/**
 * Get a DataRow related to the RowChange, in a given tablename
 * @param {string} tableName
 * @return {DataRow|undefined}
 */
RowChange.prototype.getRelated = function(tableName){
    let realName = this.r.table.tableForWriting();
    if (realName=== tableName){
        return this.r;
    }
    let related = this.related[tableName];
    if (related){
        return  related;
    }
    this.searchRelated(tableName);
    return  this.related[tableName];
};

/**
 * Fills related searching the specified table
 * @param {string} tableName
 * @return {*}
 */
RowChange.prototype.searchRelated = function(tableName){
    if (this.hasBeenScanned.has(tableName)){
        return;
    }
    this.hasBeenScanned.add(tableName);

    let r=this._getRelatedRow(tableName);
    if(r){
        this.related[tableName]=r.getRow();
    }
};


/**
 * Searches a row in parent/child tables
 * @param {string} relatedTableName
 * @return {ObjectRow|null}
 */
RowChange.prototype._getRelatedRowExactTable= function (relatedTableName) {
    let related = this.r.getChildInTable(relatedTableName);
    if (related.length === 1) {
        return related[0];
    }
    related = this.r.getParentsInTable(relatedTableName);
    if (related.length === 1) {
        return related[0];
    }
    return null;
};

/**
 * Searches a row in parent/child tables
 * @param {string} relatedTableName
 * @return {ObjectRow|null}
 */
RowChange.prototype._getRelatedRow= function (relatedTableName) {
    let exact = this._getRelatedRowExactTable(relatedTableName);
    if (exact){
        return exact;
    }
    let result=null;
    let that=this;
    Object.values(this.r.table.dataset.tables).some(t=>{
        if (t.tableForWriting()===relatedTableName && t.name!== relatedTableName){
            result=that._getRelatedRowExactTable(t.name);
            return  (result!==null);
        }
    });
    return result;
};


/**BusinessPostData
 * A class able to save data invoking business rules
 * @class BusinessPostData
 * @augments PostData
 * @method PostData
 * @param {Context} context
 * @constructor
 */
function BusinessPostData (context){
    PostData.apply(this);

    /* {Context} */
    this.context = context;

    /*{BusinessLogic}*/
    this.businessLogic= null;

}

BusinessPostData.prototype =  _.extend(
    new PostData(),
    {
        constructor: BusinessPostData,
        superClass: PostData.prototype,

        createBusinessLogicResult: function (){
            return new BusinessLogicResult();
        },

        /***
         *
         * @param ds
         * @return {Promise<SinglePostData>}
         */
        init : function ( ds) {
            return this.superClass.init.call(this, ds, this.context);
        },


        /**
         * This is meant to be replaced or overridden in derived classes
         * @param {Context} context
         * @param {ObjectRow[]} rowChanges
         * @return {BusinessLogicResult}
         */
        getBusinessLogic : function (context, rowChanges){
            let bl= new BusinessLogic(context, rowChanges);
            return bl.auditsPromise
                .then(()=>{
                    return bl;
                });
        }

    }
);



module.exports = {
    BusinessPostData:BusinessPostData,
    BusinessLogic: BusinessLogic,
    BusinessMessage:BusinessMessage,
    OneSubst:OneSubst,
    SubstGroup:  SubstGroup,

    _RowChange:RowChange
};
