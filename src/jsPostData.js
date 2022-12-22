/*globals ObjectRow,Environment,sqlFun,AutoIncrementColumn,DataRowState */
/**
 * Manages data storing
 * @module PostData
 */

/* jshint -W116 */
const dsSpace = require('./../client/components/metadata/jsDataSet');
const DataSet = dsSpace.DataSet;

/**
 * {DataRow}
 */
const DataRow = dsSpace.DataRow;

const DataTable = dsSpace.DataTable;

const jsMultiSelect = require('./jsMultiSelect');
const DataAccess = require('./jsDataAccess').DataAccess;
const Select = jsMultiSelect.Select;
const isolationLevels = require('./jsDataAccess').isolationLevels;
const dataRowState = dsSpace.dataRowState;

const _ = require('lodash');

/* {Deferred} */
const Deferred = require("JQDeferred");

const async = require('async');

/**
 * Manages a cache of select max done in a transaction
 * @class MaxCacher
 * @method MaxCacher
 * @param {DataAccess} conn
 * @param {Environment} environment
 * @constructor
 */
function MaxCacher(conn,environment){
  /**
   * Cache of all calculated max
   * @property {object} allMax
   * @private
   */
  this.allMax = {};

  /* {DataAccess}  */
  this.conn = conn;

  /* {SqlFormatter} */
  this.formatter = conn.getFormatter();

  /* {Environment} */
  this.environment= environment;
}
MaxCacher.prototype = {
  constructor: MaxCacher
};

/**
 * Gets a hash to retrieve a select max
 * @method getHash
 * @private
 * @param {string} table
 * @param {string} column
 * @param {sqlFun} filter
 * @param {sqlFun} expr
 */
MaxCacher.prototype.getHash = function(table, column,filter,expr){
  return table+'§'+ column+'§'+this.formatter.conditionToSql(filter, this.environment)+'§'+
    this.formatter.toSql(expr,this.environment);
};


/**
 * Get the max for an expression eventually getting it from cache or giving null if reasonably there is no row
 *  on that match the filter
 *  If there is no selector, then the result can be taken from cache if a query with same parameters has already
 *   be done.
 * @method getMax
 * @param {ObjectRow} r objectRow for which evaluate the max
 * @param {string} column column to evaluate
 * @param {string[]} selectors selector fields for the calculation
 * @param {sqlFun} filter filter to apply
 * @param {sqlFun} expr expression to evaluate
 * @return {Promise<int>}
 */
MaxCacher.prototype.getMax = function (r, column, selectors, filter, expr) {
  const def = Deferred(),
      that = this,
      table = r.getRow().table,
      k = this.getHash(table.name, column, filter, expr);
  if (this.allMax[k]){
    def.resolve(this.allMax[k]);
    return def.promise();
  }
  const keySelectors = _.intersection(selectors, table.key()); //fields both key and selector
  if (keySelectors.length > 0) {
    if (_.find(table.dataset.relationsByChild[table.name], function (parentRel) {
      const parentRows = parentRel.getParents(r);
      if (parentRows.length !== 1) {
        return false;
      }
      const parentRow = parentRows[0];
      if (parentRow.getRow().state !== dataRowState.added) {
        return false;
      }
      return ( _(_.intersection(parentRel.childCols, keySelectors))
        .map(function (col) {
          return parentRel.parentCols[_.indexOf(parentRel.childCols, col)];
        })
        .find(function (parentCol) {
          return table.dataset.tables[parentRel.parentTable].autoIncrement(parentCol) !== undefined;
        }) !== undefined);

    })) {
      //if such a relation is found, return null to mean that there is no row on db satisfying that condition,
      // so the max can be evaluated basing on in-memory informations (for example a cached value)
      def.resolve(null);
      return def.promise();
    }
  }
  this.conn.readSingleValue({tableName: table.name, expr:expr, filter:filter, environment:this.environment})
    .done(function(res){
      if (res===undefined){
        res=null;
      }
      that.allMax[k]=res; //put the result in cache
      def.resolve(res);
    })
    .fail(function(err){
      def.reject(err);
    });
  return def.promise();
};

/**
 *
 * @param {ObjectRow} r
 * @param {string} column
 * @param {sqlFun} filter
 * @param {sqlFun} expr
 * @param {object} value
 */
MaxCacher.prototype.setMax = function (r, column, filter, expr, value) {
  this.allMax[this.getHash(r.getRow().table.name, column, filter, expr)] = value;
};


/**
 * Saves a single DataSet using a given DataAccess
 * @class PostData
 * @method PostData
 * @constructor
 */
function SinglePostData(){
  /*{ObjectRows[]}*/
  this.changedRows = [];

}
SinglePostData.prototype = {
  constructor: SinglePostData
};


/**
 * This function  is called before and after applying changes to db.
 *  The first time is called with post=false and the second time with post=true.
 *  Should give a list of messages to return to client. If it does return an empty array, the transaction is committed.
 *  If it does return some rows, those are merged and returned to client, and transaction is roll-backed.
 *  if canIgnore is false in the first call, the procedure terminates and no data is written at all
 *  This is meant to be replaced or overridden in derived classes
 * @param {DataSet} ds
 * @param {Context} context
 * @return {Promise<SinglePostData>}
 */
SinglePostData.prototype.init = function ( ds,context){
  this.ds = ds;
  this.rowChanges = this.getChanges(ds);
  this.conn= context.dataAccess;
  this.security = context.security;
  this.environment = context.environment;
  if (this.conn) {
    this.sqlConn = this.conn.sqlConn;
  }
  return new Deferred().resolve(this).promise();
};



/**
 * Compose a list of all tables that satisfy the checkFunction
 * checkFunction is called with 2 parameters: table, list where
 * table is the current evaluated DataTable,
 * list is a hash of tables already added to list, where the key is the name of the DataTable
 * Elements are added to list when checkFunction returns true
 * @param {DataSet} d
 * @param checkFunction
 * @return {DataTable[]}
 */
SinglePostData.prototype.sortTables = function(d, checkFunction){
  const result = [];
  let keep = true;
  let added = new Set();

  while (keep){
    keep = false;
    for(const tName in d.tables){
      if (d.tables.hasOwnProperty(tName)){
        let t = d.tables[tName];
        if (added.has(t.name)|| t.isTemporaryTable){
          continue;
        }
        if (checkFunction(t, added)) {
          result.push(t);
          added.add(t.name);
          keep = true;
        }
      }
    }
  }
  return result;

};


/**
 * Adds all Rows (of every Tables referred by "Tables")with a specified State to result
 * @param {DataTable[]} tables
 * @param {DataRowState} state
 * @return {ObjectRow[]}
 */
SinglePostData.prototype.tableOps =function ( tables,state){
  /*{ObjectRow[]}*/
  let result=[];
  for(let i=0;i<tables.length;i++){
    let t = tables[i];
    if (t.isTemporaryTable){
      continue;
    }
    let sorting= t.postingorder;
    if (state===dataRowState.deleted || sorting===undefined){
      t.rows
          .filter((r) => r.getRow().state === state)
          .forEach((r)=>result.push(r));
      continue;
    }

    return t.getSortedRows(
        t.rows.filter((r) => r.getRow().state === state),
        sorting)
        .forEach((r)=>result.push(r));
  }
  return  result;
};

// /**
//  * Returns modified rows of given tables filtering by rowState
//  * @method getTableOps
//  * @param {DataTable[]} tables
//  * @param {DataRowState|string} rowState
//  */
// function getTableOps(tables, rowState) {
//   return _.reduce(tables, function (list, t) {
//     let res = _.filter(t.rows,
//         function (r) {
//           return (r.getRow().state === rowState);
//         }
//     );
//     if (t.postingOrder) {
//       res = _.sortBy(res, t.postingOrder);
//     }
//     return list.concat(res);
//   }, []);
// }

/**
 *  Evaluates the list of the changes to apply to the DataBase, in the order they should be "reasonably" done:
 *  All operation on None
 *  Deletes on  Child first, Parent last
 *  Insert on Parent first, Child last
 *  Updates on Parent first, Child last
 *  If a DataTable has a 'postingOrder' property, it is used to sort rows of that table
 * @param {DataSet} ds
 * @return {ObjectRow[]}
 */
SinglePostData.prototype.getChanges = function(ds) {
  const parentFirst = this.sortTables(ds, this.checkNotChild),
      childFirst = this.sortTables(ds, this.checkNotParent);
  return this.tableOps(childFirst, dataRowState.deleted).concat(
      this.tableOps(parentFirst, dataRowState.added),
      this.tableOps(parentFirst, dataRowState.modified)
  );
};


/**
 * check if T is not a child of a table, except those parent in toIgnore set and self and those without changes
 * @param {DataTable} t
 * @param {Set<string>} toIgnore
 */
SinglePostData.prototype.checkNotChild =  function(t, toIgnore ) {
  let foundRel=t.parentRelations().find(rel=>{
    if (rel.parentTable=== t.name || toIgnore.has(rel.parentTable)){
      return false;
    }
    let parentTable=t.dataset.tables[rel.parentTable];
    if (parentTable.isTemporaryTable){
      return  false;
    }
    //external function will return false if there is some not-unchanged row in parentTable
    //if parentTable has  no change, relation is skipped
    //if parentTable has changes, this is actually a dependent child of that
    return parentTable.hasChanges();
  });
  return  (foundRel===undefined);
};

/**
 * check if T is not a parent of a table, except those child in toIgnore set
 * @param {DataTable} t
 * @param {Set<string>} toIgnore
 */
SinglePostData.prototype.checkNotParent =  function(t, toIgnore ) {
  let foundRel=t.childRelations().find(rel=>{
    if (rel.childTable=== t.name || toIgnore.has(rel.childTable)){
      return false;
    }
    let childTable=t.dataset.tables[rel.childTable];
    if (childTable.isTemporaryTable){
      return  false;
    }
    //external function will return false if there is some child row
    //return childTable.hasChanges();
    return childTable.rows.length>0;
  });
  return  (foundRel===undefined);
};



/**
 * Function called with a DataAccess and changedRows as parameters in order to do eventual
 *   db transaction logging
 * This is meant to be replaced or overridden in derived classes
 * @param {DataAccess} conn transaction connection
 * @return {Deferred}
 */
SinglePostData.prototype.log = function (conn){
  return new Deferred().resolve(true).promise();
};



/**
 * function called in order to do eventual additionally updates when it's sure the transaction
 *  is to be committed, i.e., no check have been raised. This function must
 *   return an array of checks. If it is empty the transaction is committed otherwise is rollbacked
 *  This is meant to be replaced or overridden in derived classes
 * @param {DataAccess} conn  transaction connection
 * @param {BusinessLogicResult} results
 * @return {Promise<bool>}
 */
SinglePostData.prototype.doUpdate = function (conn,  results){
  return new Deferred().resolve(true).promise();
};


/**
 * Calculates all autoincrement property of a DataRow r
 * @param {ObjectRow} r
 * @returns {promise} return true if NO custom autoincrement was found.
 * when a custom autoincrement is found, rows are saved one at a time
 */
SinglePostData.prototype.calcAllAutoId = function(r) {
  const that = this,
      def = Deferred(),
      table = r.getRow().table;
  if (r.getRow().state !== dataRowState.added){
    def.resolve(true);
    return def.promise();
  }
  Deferred.when.apply(Deferred,
      _.map(table.getAutoIncrementColumns(), function (col) {
        return that.calcAutoId(r, table.autoIncrement(col));
      }))
      .done(function(){
        const arr = Array.prototype.slice.call(arguments);
        def.resolve(_.every(arr,function(el){return el;}));
      });
  return def.promise();
};



/**
 * Gets an array of changed rows and returns a sequence of sql command that does the post.
 * @method getSqlStatements
 * @param {DataRow[]}changedRows
 * @param {OptimisticLocking} optimisticLocking
 * @returns {Deferred} Deferred is notified with n sets of (rows,sql) where sql is the sql command used to
 *   save rows. This is useful if some error is returned, to evaluate messages.
 *   Saving stops as soon as an error occurs.
 */
SinglePostData.prototype.getSqlStatements = function (changedRows, optimisticLocking){
  const def = Deferred(),
      that = this;
  let internalIndex = 0,
      rows = [],
      sql,
      failed = false;

  /**
   * Evaluates a sql command to save a row and sends
   * @param {ObjectRow} preparedRow
   * @param {boolean} hasCustomAutoincrement
   */
  function sqlMerge(preparedRow, hasCustomAutoincrement){
    if (failed){
      return;
    }
    rows.push(preparedRow);
    const cmd = that.conn.getPostCommand(preparedRow, optimisticLocking, that.environment),
        errCmd = that.sqlConn.giveErrorNumberDataWasNotWritten(internalIndex);
    if (sql) { //sqlConn is a SqlDriver and knows how to concatenate single commands
      sql = that.sqlConn.appendCommands([sql, cmd, errCmd]);
    } else {
      sql = that.sqlConn.appendCommands([cmd, errCmd]);
    }
    if (sql.length > that.sqlSizeLimit || hasCustomAutoincrement){
      def.notify(rows,sql);
      internalIndex = 0;
      rows = [];
      sql = '';
    } else {
      internalIndex += 1;
    }
  }

  async.eachSeries(changedRows, function(r,callback){
        that.calcAllAutoId(r)
            .done(function(noCustomAutoincrementFound){
              sqlMerge(r, !noCustomAutoincrementFound);
              callback(null);
            })
            .fail(function(err){
              def.reject(err);
              failed=true;
              callback(err);
            });
      },
      function(err){
        if (err) {
          failed = true;
          def.reject(err);
        }
        if (rows.length>0){
          def.notify(rows, sql);
        }
        def.resolve();
      });

  return def.promise();
};


/**
 * Reads again a row from db
 * @method reselect
 * @param {ObjectRow} row
 * @returns {*}
 */
SinglePostData.prototype.reselect = function(row) {
  const table = row.getRow().table;
  row.getRow().rejectChanges();
  return this.conn.selectIntoTable({
    table: table,
    filter: table.keyFilter(row),
    environment: this.environment
  });

};

/**
 * Runs a sequence of db commands in order to save an array of rows
 * @method physicalPostBatch
 * @param {DataAccess} conn
 * @param {OptimisticLocking} optimisticLocking
 * @returns {*} Resolved promise if all ok, rejected promise if errors
 */
SinglePostData.prototype.physicalPostBatch = function(conn, optimisticLocking){
  const def = Deferred(),
      that = this;
  let sqlCmdLaunched = 0,
      sqlCmdRun = 0,
      endOfCmdReached = false,
      failed = false,
      changedRows = this.rowChanges;
  //assume the OptimisticLocking present in the DataSet as default for optimisticLocking
  optimisticLocking = optimisticLocking || this.ds.optimisticLocking;
  function sqlCmdRunner(rows,sql){
    const sqlComplete = that.sqlConn.appendCommands([sql, that.sqlConn.giveConstant(-1)]);
    sqlCmdLaunched += 1;
    that.conn.runCmd(sqlComplete)
        .done(function(res){

          if (res === -1){
            sqlCmdRun += 1;
            if (endOfCmdReached){
              def.resolve();
            }
            return;
          }
          if (res <0 || res >= rows.length){
            def.reject('internal error running command ' + sqlComplete);
            return;
          }

          const row = rows[res];
          const sqlErrorCmd = that.conn.getPostCommand(row, optimisticLocking, that.environment);
          if (row.getRow().state === dataRowState.modified){
            that.reselect(row)
                .done(function(){
                  def.reject('error running command' + sqlErrorCmd);
                })
                .fail(function(){
                  def.reject('error running command' + sqlErrorCmd);
                });
          } else {
            def.reject('error running command' + sqlErrorCmd);
          }
        })
        .fail(function(err){
          failed=true;
          def.reject('Got Error:'+err+' running '+ sqlComplete.substr(0,500));
        });

  }

  //sets optimistic locking fields
  changedRows.forEach(r =>   optimisticLocking.prepareForPosting(r,that.environment));

  if (that.security) {
    changedRows.forEach(r => {
      if (!that.security.canPost(r, that.environment)) {
        def.reject("Operation on table "+r.getRow().table.name+" is forbidden");
        failed=true;
      }
    });
  }
  if (failed) return;

  that.getSqlStatements(changedRows, optimisticLocking)
      .progress(function(rows, sql){
        if (failed) {
          return;
        }
        sqlCmdRunner(rows,sql);
      })
      .done(function(sqlCmdArray){
        if (failed) {
          return;
        }
        endOfCmdReached=true;
        if (sqlCmdLaunched=== sqlCmdRun){
          def.resolve();
        }
      })
      .fail(function(err){
        if (failed) {
          return;
        }
        def.reject(err);
      });


  return def.promise();
};


/**
 * Get a sql command to select all changed rows that belongs to view tables. Views are identified as tables
 *  having a name different from tableForWriting. It's necessary that they have a key to let this method
 *  consider them.
 * @method  getSelectAllViews
 * @private
 * @param {Array.<ObjectRow>} changedRows
 * @returns {Array.<Select>}
 */
SinglePostData.prototype.getSelectAllViews = function (changedRows) {
  return _.reduce(changedRows, function (list, r) {
    if (!r.getRow())return list;
    const table = r.getRow().table;
    if (table.name === table.tableForWriting()) {
      return list;
    }
    if (table.key().length === 0) {
      return list;
    }
    list.push(new Select(_.keys(r))
        .from(table.tableForReading())
        .intoTable(table.name)
        .multiCompare(table.keyFilter(r))
    );
    return list;
  }, []);
};


/**
 * Read all changed view rows from db
 * @method reselectAllViews
 * @returns {*}
 */
SinglePostData.prototype.reselectAllViews = function(){
  const def = Deferred();
  let selectList;

  if (this.rowChanges.length === 0){
    def.resolve();
    return def.promise();
  }
  //QUI DEVO CORREGGERE, non sono tutte le righe da rileggere ma solo quelle relative a viste e che hanno
  // campi particolari, fare riferimento a ReselectAllViews del c#
  selectList = this.getSelectAllViews(this.rowChanges);

  this.conn.mergeMultiSelect(selectList, this.ds, this.environment)
      .done(function(data){
        def.resolve();
      })
      .fail(function(err){
        def.resolve();
      });
  return def.promise();
};



/**
 * Calculates an autoincrement column checking that there is no other rows with that key in table
 * @method calcAutoId
 * @param {ObjectRow} r
 * @param {AutoIncrementColumn} autoIncrementProperty ({DataRow} r, {string} columnName, {DataAccess} conn}
 * @return {promise} //resolves true if it was a regular auto increment fields, false if it was a custom one
 */
SinglePostData.prototype.calcAutoId = function(r, autoIncrementProperty) {
  const that = this,
      def = Deferred(),
      table = r.getRow().table,
      field = autoIncrementProperty.columnName;

  ///TODO: verificare come operare l'impostazione: se lo fa il client, al momento sicuramente non è ricevuta dal server
  if (autoIncrementProperty.customFunction){
    autoIncrementProperty.customFunction(r, field, this.conn)
        .done(function(res){
          table.safeAssign(r,field,res);
          def.resolve(false);
        });
    return def.promise();
  }

  const selector = autoIncrementProperty.getSelector(r),
      fieldExpr = autoIncrementProperty.getExpression(r),
      prefix = autoIncrementProperty.getPrefix(r);


  this.maxCacher.getMax(r, field, autoIncrementProperty.selector, selector, fieldExpr)
      .then(function (res) {
        let foundID, newID;
        if (res === null || res === undefined) {
          newID = 1;
        } else {
          newID = res+1;
        }
        that.maxCacher.setMax(r, field, selector, fieldExpr, newID);
        if (! autoIncrementProperty.isNumber){
          newID = newID.toString();
          while (newID.length < autoIncrementProperty.idLen) {
            newID = '0' + newID;
          }
          newID = prefix + newID;
        }
        table.safeAssign(r, field, newID);
        def.resolve(true);
      });
  return def.promise();
};



/**
 * Saves one or more DataSet using a given DataAccess
 * @class PostData
 * @method PostData
 * @constructor
 */
function PostData(){
  /* {SinglePostData} */
  this.allPost = [];
 /* IInnerPoster */
 this.innerPostingClass = null;
 /* OptimisticLocking */
 this.defaultOptimistickLocking=null;
}



PostData.prototype = {
  constructor: PostData,
  /**
   *
   * @param ds
   * @param conn
   * @return {SinglePostData}
   */
  createSingleDataSetPost: function(ds,conn){
    return new SinglePostData();
  },
  /**
   * Sets a default for optimistic locking
   * @param {OptimisticLocking} locking
   */
  setOptimisticLocking(locking){
   this.defaultOptimistickLocking = locking;
  }
};


PostData.prototype.createBusinessLogicResult = function (){
  return new BusinessLogicResult();
};


/**
 *
 * @param {DataSet} ds
 * @param {Context} context
 * @return {Promise<SinglePostData>}
 */
PostData.prototype.init = function ( ds,context){
  if (!this.conn){
    this.conn = context.dataAccess;
  }
  let p =this.createSingleDataSetPost();
  this.allPost.push(p);
  this.context = context;

  return  p.init(ds, context)
      .then(()=> this.getBusinessLogic(context, p.rowChanges))
      .then(bl=> {
        p.businessLogic = bl;
        return p;
      });
};

/**
 * @private
 * @return {boolean}
 */
PostData.prototype.someChange = function (){
  return this.allPost.some(p => p.rowChanges.length>0);
};

/**
 * Check if this PostClass is run-time nested insider another one
 * @param {DataSet} ds
 * @param {IInnerPoster} innerPoster
 * @return {boolean}
 */
PostData.prototype.setInnerPosting = function (ds, innerPoster){
  this.innerPostingClass = innerPoster;
  this.innerPostingDataSet = ds;
};

/**
 * Check if this PostClass is run-time nested insider another one
 * @return {boolean}
 */
PostData.prototype.isInnerPoster = function (){
  return this._isInnerPoster;
};

/**
 * Establish that this PostClass is run-time nested insider another one
 */
PostData.prototype.setAsInnerPoster = function (){
  this._isInnerPoster = true;
};







/**
 * Simple check result
 * @class BasicMessage
 * @param {string} msg
 * @param {boolean} canIgnore
 */
function BasicMessage(msg,canIgnore){
  msg = msg.stack || msg.message || msg;

  /**
   * @property {boolean} canIgnore
   */
  this.canIgnore=canIgnore;

  /**
   * @property {string} msg
   */
  this.msg=msg;
}

/**
 * @method setMessage
 * Sets the message of the rule
 * @return {*}
 */
BasicMessage.prototype.setMessage = function (msg){
  this.msg=msg;
};

/**
 * @method getMessage
 * Gets the message of the rule
 * @return {string}
 */
BasicMessage.prototype.getMessage = function (){
  return this.msg;
};


/**
 * Gets an identifier for this message, uses to suppress duplicates messages
 * @return {string|*}
 */
BasicMessage.prototype.getId = function (){
  return this.msg;
};


function BusinessLogicResult(){
  /* {boolean} a message can be ignored if it is a warning*/
  this.canIgnore=true;

  this.autoIgnore = false;

  /* {boolean} if true is a post check*/
  this.post = false;

  /* BasicMessage[] */
  this.checks=[];

  /**
   * Previously ignored warnings
   * {Set<string>}
   */
  this.hashIgnored =  new Set();

  /**
   * Added errors (can't be ignored)
   * {Set<string>}
   */
  this.hashError =  new Set();
}


/**
 * Adds a message to the collection, returns the added message
 * @param {BasicMessage} check
 * @return {BasicMessage}
 * */
BusinessLogicResult.prototype.addMessage = function (check){
  let id = check.getId();
  if (check.canIgnore){
    if (!this.autoIgnore) {
      if (!this.hashIgnored.has(id)) {
        this.hashIgnored.add(id);
        this.checks.push(check);
      }
    }
  }
  else {
    this.canIgnore=false;
    if (!this.hashError.has(id)){
      this.hashError.add(id);
      this.checks.push(check);
    }
  }

  return check;
};

/**
 * Adds an error to the message collection, returns the created message
 * @param {string} message
 * @param {boolean} post
 * @return {BasicMessage}
 */
BusinessLogicResult.prototype.addError = function (message,post){
  return  this.addMessage(new BasicMessage(message,false));
};
/**
 * Adds a warning to the message collection, returns the created message
 * @param {string} message
 * @param {boolean} post
 * @return {BasicMessage}
 */
BusinessLogicResult.prototype.addWarning = function (message,post){
  let m=  this.addMessage(new BasicMessage(message,true));
  m.post = post;
  return  m;
};


/**
 * Adds a db error
 * @param {string} message
 * @param {boolean} post
 */
BusinessLogicResult.prototype.addDbError = function (message,post){
  const check = new BasicMessage(message,false);
  this.checks.push( check);
  return check;
};



/**
 * Merges messages with existing ones
 * @param {BusinessLogicResult} messages
 * @returns {boolean} true if any new message was added to collection
 */
BusinessLogicResult.prototype.mergeMessages = function (messages){
  let that=this;  //to avoid eslint messages
  let nChecks = this.checks.length;
  messages.checks.forEach(/* {BasicMessage} */  m =>{
    that.addMessage(m);
  });
  if (!messages.canIgnore) {
    this.canIgnore=false;
  }
  return nChecks!== this.checks.length;
};



function IBusinessLogic(){

}

IBusinessLogic.prototype = {
  constructor: IBusinessLogic,
  /**
   * @param {BusinessLogicResult} result
   * @param {DataAccess} conn transaction connection
   * @param {boolean} post
   */
  getChecks:function (result, conn,post){
    return  new Deferred().resolve(result).promise();
  }
};

/**
 * This is meant to be replaced or overridden in derived classes
 * @param {Context} context
 * @param {ObjectRow[]} rowChanges
 * @return {Promise<IBusinessLogic>}
 */
PostData.prototype.getBusinessLogic = function (context, rowChanges){
  let bl= new IBusinessLogic();

  return new Deferred().resolve(bl).promise();
};

/**
 * Builds a chained function, chaining each the Deferred function with "then"
 * @param  {Array.<Deferred>} tasks each task is a function that returns a deferred. Not the deferred itself!
 * @return {Promise}
 */
function promiseWaterfall(tasks) {
  let f = Deferred().resolve(true).promise();
  // concateno con then ogni deferred dell'array di input
  _.forEach(
      tasks,
      function(def) {
        f = f.then(()=>{
          try {
            return def();
          }
          catch (err){
            return  Deferred().reject(err).promise();
          }

        } );
      });

  return f;
}

/**
 *
 * @param {function[]} tasks
 */
function promiseParallel(tasks) {
  Deferred.when.apply(Deferred, tasks.map(function (task) {
    return task();
  }));
}


/**
 * This function  is called before and after applying changes to db.
 *  The first time is called with post=false and the second time with post=true.
 *  Should give a list of messages to return to client. If it does return an empty array, the transaction is committed.
 *  If it does return some rows, those are merged and returned to client, and transaction is roll-backed.
 *  if canIgnore is false in the first call, the procedure terminates and no data is written at all
 *  This is meant to be replaced or overridden in derived classes
 * @param {DataAccess} conn
 * @param {boolean} post  True if post check otherwise precheck are requested
 * @return {Promise<BusinessLogicResult>}
 */
PostData.prototype.getChecks = function (conn, post){
  /* BusinessLogicResult */
  let  result = this.createBusinessLogicResult();
  //Merges all checks coming from singlePosts

  let /* Deferred[] */ allChecks = _.map(this.allPost, (p)=> ()=>p.businessLogic.getChecks(result,conn,post));

  return promiseWaterfall(allChecks).
        then(()=>{
          return result;
        }
  );

};


PostData.prototype.clearMaxCache = function (conn){
  this.allPost.forEach(p=>{
    // Resets all evaluated cached max
    p.maxCacher = new MaxCacher(conn, p.environment);
  });
};

/**
 * Executes all data posting
 * @param {DataAccess} conn
 * @param {OptimisticLocking} locking
 * @returns {Promise} promise fails on errors
 */
PostData.prototype.doAllPhisicalPostBatch = function (conn, locking){
  let allPostingFn = _.map(this.allPost, (p)=>  ()=>p.physicalPostBatch(conn, locking));
  return promiseWaterfall(allPostingFn);
};


/**
 * log all operations made
 * @param {DataAccess} conn
 * @returns {Promise} promise fails on errors
 */
PostData.prototype.doAllLog = function (conn){
  let allLoggingFn = _.map(this.allPost, (p)=> ()=>p.log(conn, p.rowChanges) );
  return promiseWaterfall(allLoggingFn);
};


/**
 * Executes all post-saving updates
 * @param {DataAccess} conn
 * @param {BusinessLogicResult} result
 * @returns {Promise} promise fails on errors
 */
PostData.prototype.doAllUpdate = function (conn, result){
  let allUpdateFn = _.map(this.allPost, (p)=> ()=>p.doUpdate(conn, result));
  return promiseWaterfall(allUpdateFn).
    then(()=>result);
};

/**
 * Read again view data from database
 * @param {DataAccess} conn
 * @return {Promise}
 */
PostData.prototype.reselectAllViewsAndAcceptChanges = function(conn){
  let that=this;
  let allReselectFn = _.map(this.allPost, (p)=>()=>{
    return  p.reselectAllViews(conn).then(()=>{
      _.forEach(p.rowChanges, /*ObjectRow */r=> r.getRow().acceptChanges() );
    });
  });
  if (this.innerPostingClass){
    allReselectFn.push(()=>that.innerPostingClass.reselectAllViewsAndAcceptChanges(conn));
  }

  return promiseWaterfall(allReselectFn);
};

/**
 * @returns {Array.<dataSetName:string,  changes:Array.<DataRow>>}
 */
PostData.prototype.getAllChanges = function(){

  let res =   _.map(this.allPost,p=>{return {datasetName: p.ds.name, changes : p.rowChanges};});
  if (res.length===1)return  res[0].changes;
  return  res;

};


/**
 * Saves a dataSet and return empty list if successful or a list of messages if they have to be verified before
 *  effectively committing changes. If successfull, also returns saved DataSet
 * @method doPost
 * @param {object} options
 * @param {string} [options.isolationLevel = DataAccess.isolationLevels.readCommitted]
 * @param {OptimisticLocking} [options.optimisticLocking]
 * @param {BusinessLogicResult} [options.previousRules]
 * @return  { Promise<{canIgnore:boolean, checks:BasicMessage[], data:DataSet}> }
 */
PostData.prototype.doPost = function(options) {
  const opt = options || {},
      that = this;
  let opened = false,
      tranOpen = false,
      terminated = false;
  /* {Deferred}  */
  const def = Deferred();
  _.defaults(opt, {
    isolationLevel: isolationLevels.readCommitted,
    optimisticLocking: this.defaultOptimistickLocking
  });
  function cleanResult(res){
    let r= _.pick(res,["canIgnore","checks"]);
    if (res.data){
      r.data= res.data;
      r.checks=[];
    }
    return r;
  }
  /*{BusinessLogicResult}*/
  let result = opt.previousRules || this.createBusinessLogicResult();
  if (!result.canIgnore) return def.resolve(cleanResult(result)).promise();


  if (!this.someChange()){
    def.resolve(cleanResult(result)); //default response on unchanged dataset
    return def.promise();
  }


  function appendArray(array1, array2) {
    array1.push.apply(array1, array2);
  }

  this.clearMaxCache(this.conn);

  /**
   * Invoke a method if it is not inner posting
   * @param {string} method
   * @return {*}
   */
  function optionalMethod(method){
    if (that.isInnerPoster()){
      return Deferred().resolve(false);
    }
    return  that.conn[method]()
        .then(()=>true);
  }


  /**
   * Resolve the promise with result, and do the necessary cleanup: rollback transaction if a transaction is open,
   *  and close connection if the connection is open. If further errors arise, add them to checks as dbErrors
   * @method resolve
   * @returns {Deferred}
   */
  function resolve() {
    terminated = true;
    //If there is an open transaction, it means that there has been an error
    if (tranOpen) {
      optionalMethod("rollback")
          .then(()=> that.recursiveCallAfterPost(false))
          .then(()=>optionalMethod("close"))
          .then(()=>def.resolve(cleanResult(result)))
          .fail(function (err) {
            optionalMethod("close")
                .done(function () {
                  result.addDbError(err,true);
                  def.resolve(cleanResult(result));
                });
          });
      return def.promise();
    }
    if (opened) {
      optionalMethod("close")
          .done(function () {
            def.resolve(cleanResult(result));
          });
    } else {
      def.resolve(cleanResult(result));
    }
    return def.promise();
  }
  let anyNewMessage=false;


  //open connection
  try {
    optionalMethod("open")
        .then(function () {
          opened= true;
          if (terminated) return;
          //begin transaction
          if (!that.isInnerPoster()) {
            //Only outer poster begins and rollbacks/commits transaction
            return that.conn.beginTransaction(opt.isolationLevel);
          }
          return  true;
        })
        .then(function () {
          tranOpen = true;
          // CALL PRE - CHECKS
          return that.getChecks( that.conn, false);
        })
        .then(function (/*BusinessLogicResult*/    preChecks) {
          anyNewMessage = result.mergeMessages(preChecks);
          if (result.canIgnore === false) {
            return resolve();
          }
        })
        .then(function () {
          if (terminated) return;
          return that.doAllPhisicalPostBatch(that.conn, opt.optimisticLocking);
        })
        .then(function () {
          if (terminated) return;
          return that.doAllLog(that.conn);
        })
        .then(function () {
          if (terminated) return;
          //CALL POST-CHECK
          return that.getChecks( that.conn, true);
        })
        .then(function (/* BusinessLogicResult */ postChecks) {
          if (terminated) return;
          let newMessages = result.mergeMessages(postChecks);
          anyNewMessage = anyNewMessage || newMessages;
          if (anyNewMessage) {
            return resolve(); //forces a rollback
          }

          return that.doAllUpdate(that.conn, that.createBusinessLogicResult());
        })
        .then(function (/*  {BusinessLogicResult} */ extChecks) {
          if (terminated) return;
          anyNewMessage = result.mergeMessages(extChecks);
          if (anyNewMessage) {
            return resolve(); //forces a rollback
          }
          if (!that.innerPostingClass) return;
          let prevRuleLen = result.checks.length;
          return that.innerPostingClass.init(that.innerPostingDataSet, that.context)
              .then(function () {
                return that.innerPostingClass.doPost(_.assign({}, opt, {previousRules: result}));
              })
              .then(
                  /**
                   * @param {boolean} res.canIgnore
                   * @param {BasicMessage[]} res.checks
                   * @param {DataSet} res.data
                   * @return {exports}
                   */
                  function (res) {
                    if (res.checks.length > prevRuleLen) return resolve();
              });
        })
        .then(function () {
          if (terminated) return;
          //all is fine so we can do a commit
          return optionalMethod("commit");
        })
        .then(function (res) {
          if (terminated) return;
          tranOpen = false;
          if (that.isInnerPoster()) return;
          return that.reselectAllViewsAndAcceptChanges();
        })
        .then(function () {
          if (terminated) return;
          if (that.isInnerPoster()) return;
          return that.recursiveCallAfterPost(true);
        })
        .then(function () {
          if (terminated) return;
          result.data = that.getAllChanges();
          resolve(); //closes connection and returns data
        })
        //any fail will be caught here
        .fail(function (err) {
          result.addDbError(err);
          resolve();
        });
  }
  catch (err){
    result.addDbError(err);
    resolve();
  }

  return def.promise();
};
/**
 *
 * @param {boolean} committed
 */
PostData.prototype.recursiveCallAfterPost= function (committed){
  let inner= this.innerPostingClass;
  if (!inner)return;
  let inners=[];
  while (inner){
    inners.push(inner);
    inner = inner.getInnerPostingClass();
  }
  let def  = _.map(inners, inner=> ()=> inner.afterPost(this.conn,committed));
  return promiseWaterfall(def);
};


function IInnerPoster(){
  /* PostData */
  this.p = new PostData(); //this can be another class in derived IInnerPoster class
}

IInnerPoster.prototype = {
  constructor: IInnerPoster,

  /**
   *
   * @param {DataSet} ds
   * @param {Context} context
   * @return {Promise<SinglePostData>}
   */
  init : function ( ds,context){
    this.p.setAsInnerPoster(); //set p as the inner poster
    return this.p.init(ds, context);
  },

  /**
   * Called after data has been committed or rolled back
   * @param {DataAccess} conn
   * @param {boolean} committed
   * @return {*}
   */
  afterPost: function(conn, committed){
    return Deferred().resolve();
  },

  /**
   * Same as PostData method
   * @param {DataAccess} conn
   * @return {Promise}
   */
  reselectAllViewsAndAcceptChanges: function(conn){
    if (this.p===null) return Deferred().resolve();
    return this.p.reselectAllViewsAndAcceptChanges(conn);
  },

  getInnerPostingClass: function (){
    return this.p.innerPostingClass;
  },

  /**
   * Saves a dataSet and return empty list if successful or a list of messages if they have to be verified before
   *  effectively committing changes.
   * @method doPost
   * @param {object} options
   * @param {string} [options.isolationLevel = DataAccess.isolationLevels.readCommitted]
   * @param {OptimisticLocking} [options.optimisticLocking]
   * @param {BusinessLogicResult} [options.previousRules]
   * @return { {canIgnore:boolean, checks:BasicMessage[], data:DataSet} }
   */
  doPost: function (options){
    return this.p.doPost(options);
  }

};


PostData.prototype.sqlSizeLimit = 2000;



module.exports = {
  SinglePostData:SinglePostData,
  IInnerPoster:IInnerPoster,
  PostData: PostData,
  MaxCacher: MaxCacher,
  BusinessLogicResult: BusinessLogicResult,
  BasicMessage:BasicMessage
};
