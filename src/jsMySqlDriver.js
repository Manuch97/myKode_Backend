/*globals  jsDataQuery,ObjectRow */
'use strict';
/**
 * @property Deferred
 * @type {defer}
 */
const defer     = require("JQDeferred");
const CType = require("./../client/components/metadata/jsDataSet").CType;
let  _         = require('lodash');
let formatter = require('./jsMySqlFormatter').jsMySqlFormatter;
//let edge      = require('edge-js');
let EdgeConnection  = require("./edge-sql").EdgeConnection;


/* jshint -W016 */

/**
 * Interface to Microsoft Sql Server
 * @module mySqlDriver
 */

/**
 * Maps Standard isolation levels to DBMS-level isolation levels. In case of MS SqlServer, the corrispondence
 *  is 1:1
 * @property allIsolationLevels
 * @type {{READ_UNCOMMITTED: string, READ_COMMITTED: string, REPEATABLE_READ: string, SNAPSHOT: string, SERIALIZABLE: string}}
 */


const mapIsolationLevels = {
    'READ_UNCOMMITTED': 'READ UNCOMMITTED',
    'READ_COMMITTED': 'READ COMMITTED',
    'REPEATABLE_READ': 'REPEATABLE READ',
    'SNAPSHOT': 'SERIALIZABLE',
    'SERIALIZABLE': 'SERIALIZABLE'
};





const mapping = {
    'CHAR':CType.string,
    'VARCHAR':CType.string,
    'TINYTEXT':CType.string,
    'MEDIUMTEXT':CType.string,
    'MEDIUMBLOB':CType.string,
    'LONGTEXT':CType.string,

    'TINYINT':CType.int,
    'SMALLINT':CType.int,
    'MEDIUMINT':CType.int,
    'INT':CType.int,
    'BIGINT':CType.int,
    'YEAR':CType.int,

    'DECIMAL':CType.number,
    'FLOAT':CType.number,
    'DOUBLE':CType.number,

    'DATE':CType.date,
    'DATETIME':CType.date,
    'TIMESTAMP':CType.date,
    'TIME':CType.date,

    'BOOLEAN':CType.bool
};


/*jslint forin: false */


/**
 * @class SqlParameter
 * @param {object} paramValue
 * @param {string} paramName
 * @param {string} varName
 * @param {string} sqlType
 * @param {boolean} forOutput
 * @constructor
 */
function SqlParameter(paramValue,paramName,varName, sqlType, forOutput){

    /**
     * Optional parameter name, anyway there is no named param columns in mySql so it has no real meaning,
     *  but it is used as a default to colName  (see below)
     * @type {string|undefined}
     */
    this.name=paramName;

    /**
     * Optional name for the variable that will store the result, in case of output variables. When not present, it is assumed to
     *  be equal to paramName.
     * @type {string|undefined}
     */
    this.varName=varName|| paramName;

    /**
     * Parameter value
     * @type {Object|undefined}
     */
    this.value=paramValue;

    /**
     * Sql type declaration for output parameters
     * @type {string|undefined}
     */
    this.sqltype=sqlType;

    /**
     * Output flag , true when it is output parameter
     * @type {boolean|undefined}
     */
    this.out = forOutput;
}


/**
 * Provides function to interact with a Sql Server database
 * @class
 * @name Connection
 * @param {object} options
 * {string} [options.driver='SQL Server Native Client 11.0'] Driver name
 * {string} [options.useTrustedConnection=true] is assumed true if no user name is provided
 * {string} [options.user] user name for connecting to db
 * {string} [options.pwd] user password for connecting to db
 * {string} [options.timeOut] time out to connect default 600
 * {string} [options.database] database name
 * {string} [options.defaultSchema=options.user ||'DBO'] default schema associated with user name
 * {string} [options.connectionString] connection string to connect (can be used instead of all previous listed)
 * @constructor
 */
function Connection(options) {
    /**
     * Stores the sql-connect options used for this connection
     * @property opt
     * @type {object}
     */
    this.opt = _.clone(options);

    ////DBO is the default used for trusted connections
    this.defaultSchema = this.opt.defaultSchema || this.opt.user || 'DBO';

    this.timeOut = this.opt.timeOut || 600;

    /**
     * Indicates the open/closed state of the underlying connection
     * @property isOpen
     * @type {boolean}
     */
    this.isOpen = false;

    /**
     * Current schema in use for this connection
     * @property schema
     * @type {string}
     */
    this.schema = this.defaultSchema;

    /**
     * Current transaction annidation level
     * @private
     * @property transAnnidationLevel
     * @type {number}
     */
    this.transAnnidationLevel = 0;

    /**
     * Current transaction state, true if any rollback has been invoked
     * @propery transError
     * @type {boolean}
     */
    this.transError = false;

    /**
     * current isolation level
     * @property isolationLevel
     * @type {String}
     */
    this.isolationLevel = null;

    this.adoString = 'Server=' + this.opt.server +
        (this.opt.database? ";database=" + this.opt.database : "")+
        (this.opt.useTrustedConnection ?
                ";IntegratedSecurity=yes;uid=auth_windows" :
                ";uid=" + this.opt.user + ";pwd=" + this.opt.pwd) +
        ";Pooling=False" +
        ";Connection Timeout="+this.timeOut+
        ";Allow User Variables=True;";
    /**
     * 
     * @type {EdgeConnection}
     */
    this.edgeConnection = new EdgeConnection(this.adoString,'mySql');
}


Connection.prototype = {
    constructor: Connection
};

/**
 * Change current used schema for this connection. MySql does not support schemas
 * @method useSchema
 * @param {string} schema
 * @returns {*}
 */
Connection.prototype.useSchema = function (schema) {
    this.schema = schema;
    return defer().resolve().promise();
};

/**
 * Destroy this connection and closes the underlying connection
 * @method destroy
 * @return {Deferred}
 */
Connection.prototype.destroy = function () {
    return this.close();
};

/**
 * Creates a duplicate of this connection
 * @method clone
 * @returns {Connection}
 */
Connection.prototype.clone = function () {
    return new Connection({connectionString: this.adoString});
};

/**
 * Sets the Transaction isolation level for current connection
 * @method setTransactionIsolationLevel
 * @param {string} isolationLevel one of 'READ_UNCOMMITTED','READ_COMMITTED','REPEATABLE_READ','SNAPSHOT','SERIALIZABLE'
 * @returns {promise}
 */
Connection.prototype.setTransactionIsolationLevel = function (isolationLevel) {
    var that = this,
        res,
        mappedIsolationLevels = mapIsolationLevels[isolationLevel];
    if (this.isolationLevel === isolationLevel) {
        return defer().resolve().promise();
    }
    if (mappedIsolationLevels === undefined) {
        return defer().reject(isolationLevel + " is not an allowed isolation level").promise();
    }

    res = this.queryBatch('SET TRANSACTION ISOLATION LEVEL ' + mappedIsolationLevels);
    res.done(function () {
        that.isolationLevel = isolationLevel;
    });
    return res.promise();
};


/**
 * Gets data packets row at a time
 * @method queryPackets
 * @param {string} query
 * @param {boolean} [raw=false]
 * @param {number} [packSize=0]
 * @param {number} [timeout]
 * @returns {*}
 */
Connection.prototype.queryPackets = function (query, raw, packSize,timeout) {
    return this.edgeConnection.queryPackets(query,raw,packSize,timeout);
};


/**
 * Check login/password, returns true if successful, false if user/password does not match
 * @param {string} login
 * @param {string} password
 * @returns {boolean}
 */
Connection.prototype.checkLogin = function (login, password) {
    var opt = _.assign({}, this.opt, {user: login, pwd: password}),
        def = defer(),
        testConn = new Connection(opt);
    testConn.open()
        .done(function () {
            def.resolve(true);
            testConn.destroy();
        })
        .fail(function () {
            def.resolve(false);
        });
    return def.promise();
};


/**
 * Opens the underlying connection and sets the current specified schema
 * @method open
 * @returns {Connection}
 */
Connection.prototype.open = function () {
    let connDef = defer(),
        that = this;
    if (this.isOpen) {
        return connDef.resolve(this).promise();
    }
    this.edgeConnection.open()
        .done(function () {
            that.isOpen = true;
            if (that.schema === that.defaultSchema) {
                connDef.resolve(that);
                return;
            }
            that.useSchema(that.schema)
                .done(function () {
                    connDef.resolve(that);
                })
                .fail(function (err) {
                    that.close();
                    connDef.reject('schema fail' + err);
                });
        })
        .fail(function (err) {
            connDef.reject('open fail' + err);
            connDef.reject(err);
        });
    return connDef.promise();
};


/**
 * Closes the underlying connection
 * @method close
 * @returns {promise}
 */
Connection.prototype.close = function () {
    var def  = defer(),
        that = this;
    if (this.edgeConnection !== null) {
        return this.edgeConnection.close();
    } else {
        that.isOpen = false;
        def.resolve();
    }
    return def.promise();
};

Connection.prototype.run = function (script,timeout) {
    return this.edgeConnection.run(script,timeout);
};




/**
 * Gets a table and returns each SINGLE row by notification. Could eventually return more than a table indeed
 * For each table read emits a {meta:[column descriptors]} notification, and for each row of data emits a
 *   if raw= false: {row:object read from db}
 *   if raw= true: {row: [array of values read from db]}

 * @method queryLines
 * @param {string} query
 * @param {boolean} [raw=false]
 * @param {number} [timeout]
 * @returns {*}
 */
Connection.prototype.queryLines = function (query, raw,timeout) {
    return this.edgeConnection.queryLines(query,raw,timeout);
};





/**
 * Begins a  transaction
 * @method beginTransaction
 * @param {string} isolationLevel one of 'READ_UNCOMMITTED','READ_COMMITTED','REPEATABLE_READ','SNAPSHOT','SERIALIZABLE'
 * @returns {*}
 */
Connection.prototype.beginTransaction = function (isolationLevel) {
    let that = this;
    if (!this.isOpen) {
        return defer().reject("Cannot beginTransaction on a closed connection").promise();
    }
    if (this.transAnnidationLevel > 0) {
        this.transAnnidationLevel += 1;
        return defer().resolve().promise();
    }
    return this.setTransactionIsolationLevel(isolationLevel)
        .then(function () {
            var res = that.queryBatch('START TRANSACTION;');
            res.done(function () {
                that.transAnnidationLevel += 1;
                that.transError = false;
            });
            return res;
        });
};

/**
 * Executes a sql command and returns all sets of results. Each Results is given via a notify or resolve
 * @method queryBatch
 * @param {string} query
 * @param {boolean} [raw] if true, data are left in raw state and will be objectified by the client
 * @param {number} [timeout]
 * @returns {defer}  a sequence of {[array of plain objects]} or {meta:[column names],rows:[arrays of raw data]}
 */
Connection.prototype.queryBatch = function (query, raw,timeout) {
    return this.edgeConnection.queryBatch(query,raw,timeout);
};

/**
 * Commits a transaction
 * @method commit
 * @returns {*}
 */
Connection.prototype.commit = function () {
    var that = this,
        res;
    if (!this.isOpen) {
        return defer().reject("Cannot commit on a closed connection").promise();
    }
    if (this.transAnnidationLevel > 1) {
        this.transAnnidationLevel -= 1;
        return defer().resolve().promise();
    }
    if (this.transAnnidationLevel === 0) {
        return defer().reject("Trying to commit but no transaction has been open").promise();
    }
    if (this.transError) {
        return this.rollBack();
    }
    res = this.queryBatch('COMMIT;');
    res.done(function () {
        that.transAnnidationLevel = 0;
    });
    return res.promise();
};

/**
 * RollBacks a transaction
 * @method rollBack
 * @returns {*}
 */
Connection.prototype.rollBack = function () {
    var that = this,
        res;
    if (!this.isOpen) {
        return defer().reject("Cannot rollback on a closed connection").promise();
    }
    if (this.transAnnidationLevel > 1) {
        this.transAnnidationLevel -= 1;
        this.transError = true;
        return defer().resolve().promise();
    }
    if (this.transAnnidationLevel === 0) {
        return defer().reject("Trying to rollBack but no transaction has been open").promise();
    }

    res = this.queryBatch('ROLLBACK;');
    res.done(function () {
        that.transAnnidationLevel = 0;
    });
    return res.promise();
};

/**
 * Get the string representing a select command
 * @method getSelectCommand
 * @param {object} options
 * @param {string} options.tableName
 * @param {string} options.columns list of columns or expressions, this is taken "as is" to compose the command
 * @param {jsDataQuery} [options.filter] this is skipped if it is a constantly true condition
 * @param {string} [options.top]
 * @param {string} [options.orderBy]
 * @param {object} [options.environment]
 * @returns {string}
 */
Connection.prototype.getSelectCommand = function (options) {
    var selCmd = 'SELECT ';
    selCmd += options.columns + ' FROM ' + options.tableName;
    if (options.filter && !options.filter.isTrue) {
        selCmd += " WHERE " + formatter.conditionToSql(options.filter, options.environment);
    }
    if (options.orderBy) {
        selCmd += " ORDER BY " + options.orderBy;
    }
    if (options.top) {
        selCmd += ' LIMIT ' + options.top + ' ';
    }

    return selCmd;
};

/**
 * Get the string representing a select count(*) command
 * @method getSelectCount
 * @param {object} options
 * @param {string} options.tableName
 * @param {jsDataQuery} [options.filter]
 * @param {object} [options.environment]
 * @returns {string}
 */
Connection.prototype.getSelectCount = function (options) {
    var selCmd = 'SELECT count(*) FROM ' + options.tableName;
    if (options.filter) {
        selCmd += " WHERE " + formatter.conditionToSql(options.filter, options.environment);
    }
    return selCmd;
};

/**
 * Get the string representing a delete command
 * @method getDeleteCommand
 * @param {object} options
 * @param {string} options.tableName
 * @param {jsDataQuery} [options.filter]
 * @param {object} [options.environment]
 * @returns {string}
 */
Connection.prototype.getDeleteCommand = function (options) {
    var cmd = 'DELETE FROM ' + options.tableName;
    if (options.filter) {
        cmd += ' WHERE ' + formatter.conditionToSql(options.filter, options.environment);
    } else {
        cmd += ' this command is invalid';
    }
    return cmd;
};

/**
 * Executes a series of sql update/insert/delete commands
 * @method updateBatch
 * @param {string} query
 * @param {number} [timeout]
 * @returns {*}
 */
Connection.prototype.updateBatch = function (query,timeout) {
    return this.edgeConnection.updateBatch(query,timeout);
};

/**
 * Get the string representing an insert command
 * @method getInsertCommand
 * @param {string} table
 * @param {string[]} columns
 * @param {Object[]} values
 * @returns {string}
 */
Connection.prototype.getInsertCommand = function (table, columns, values) {
    return 'INSERT INTO ' + table + '(' + columns.join(',') + ')VALUES(' +
        _.map(values, function (val) {
            return formatter.quote(val, false);
        }).join(',') +
        ')';
};

/**
 * Get the string representing an update command
 * @method getUpdateCommand
 * @param {object} options
 * @param {string} options.table
 * @param {jsDataQuery} options.filter
 * @param {string[]} options.columns
 * @param {Object[]} options.values
 * @param {object} [options.environment]
 * @returns {string}
 */
Connection.prototype.getUpdateCommand = function (options) {
    var cmd = 'UPDATE ' + options.table + ' SET ' +
        _.map(_.zip(options.columns,
            _.map(options.values, function (val) {
                return formatter.quote(val, false);
            })),
            function (cv) {
                return cv[0] + '=' + cv[1];
            }).join();
    if (options.filter) {
        cmd += ' WHERE ' + formatter.conditionToSql(options.filter, options.environment);
    }
    return cmd;
};


/**
 * evaluates the sql command to call aSP with a list of parameters each of which is an object having:
 *  value,
 *  optional 'sqltype' name compatible with the used db. it is mandatory if is an output parameter
 *  optional out: true if it is an output parameter
 *  The SP eventually returns a collection of tables and at the end an object with a property for each output parameter
 *  of the SP
 *  Unfortunately there is NO named parameter calling in MySql so it will call the SP by param order
 *  mysql> CALL test(@a, @b);
 *  mysql> SELECT @a AS a, @b AS b;
 *  User-defined variables (prefixed with @): You can access any user-defined variable without declaring it or initializing it.
 *      If you refer to a variable that has not been initialized, it has a value of NULL and a type of string.
 * @method callSPWithNamedParams
 * @param {object} options
 * @param {string} options.spName
 * @param {SqlParameter[]} options.paramList
 * @param {boolean} [options.skipSelect]    when true, the select of output parameter is omitted
 * @returns {String}
 */
Connection.prototype.getSqlCallSPWithNamedParams = function (options) {
    let anyOutput = options.paramList.find(x=>x.out);

    let cmd = 'CALL  ' + options.spName + '(' +
        _.map(options.paramList, function (p) {
            if (p.name) {
                if (p.out) {
                    return p.varName; //directly with the resulting variable name
                }
            }
            return formatter.quote(p.value);
        }).join(',') + ')';
    let that=this;
    if (anyOutput && options.skipSelect !== true) {
        cmd += ';SELECT ' +
            _.map(
                _.filter(options.paramList, {out: true}),
                function (p) {
                    return p.varName + ' AS ' + that.colNameFromVarName(p.varName);
                }
            ).join(',');
    }
    return cmd;
};

/**
 * call SP with a list of parameters each of which is an object having:
 *  value,
 *  optional 'sqltype' name compatible with the used db, necessary if is an output parameter
 *  optional out: true if it is an output parameter
 *  The SP eventually returns a collection of tables and at the end an object with a property for each output parameter
 *  of the SP
 * @method callSPWithNamedParams
 * @param {object} options
 * @param {string} options.spName
 * @param {SqlParameter[]} options.paramList
 * @param {boolean} [options.raw=false]
 * @param {number} [options.timeout]
 * @returns {ObjectRow[][] }
 */
Connection.prototype.callSPWithNamedParams = function (options) {
    var spDef = defer(),
        cmd = this.getSqlCallSPWithNamedParams(options),
        that=this;
    //noinspection JSUnresolvedFunction
    let results=[];
    this.queryBatch(cmd, options.raw, options.timeout)
        .progress(function (result) {
            spDef.notify(result); //DataTable
            results.push(result);
        })
        .done(function (result) {
            if (_.some(options.paramList,{out:true}) && options.skipSelect!==true) {
                //An object is needed for output row
                var allVar = options.raw ? objectify(result[0].meta, result[0].rows) : result[0];
                _.each(_.keys(allVar), function (k) {
                    _.find(options.paramList, {name: k}).outValue = allVar[k];
                });
                //spDef.resolve(options.paramList);
            }
            else {
                results.push(result);
            }
            spDef.resolve(results);
        })
        .fail(function (err) {
            spDef.reject(err);
        });
    return spDef.promise();
};

/**
 * Transforms raw data into plain objects
 * @method objectify
 * @param {Array} colNames
 * @param {Array} rows
 * @returns {Array}
 */
function objectify(colNames, rows) {
    //noinspection JSUnresolvedVariable
    if (colNames.meta) {
        //noinspection JSUnresolvedVariable
        return objectify(colNames.meta, colNames.rows);
    }
    return _.map(rows, function (el) {
        const obj = {};
        _.each(colNames, function (value, index) {
            obj[value] = el[index];
        });
        return obj;
    });
}


/**
 * @class TableDescriptor
 * The structure of a table is described with a TableDescriptor.
 * The definition of this structure must match that of dbDescriptor module
 * A TableDescriptor is an object having those properties:
 * {string} xtype:      T for  tables, V for Views
 * {string} name:       table or view name
 * {ColumnDescriptor[]} columns
 *
 */

/**
 * @class ColumnDescriptor
 * An object describing a column of a table. It is required to have the following fields:
 *  {string} name        - field name
 *  {string} type        - db type
 *  {number} max_length  - size of field in bytes
 *  {number} precision   - n. of integer digits managed
 *  {number} scale       - n. of decimal digits
 *  {boolean} is_nullable - true if it can be null
 *  {boolean} pk          - true if it is primary key
 */

/**
 * Gets information about a db table
 * @method tableDescriptor
 * @param {string} tableName
 * @returns {TableDescriptor}
 */
Connection.prototype.tableDescriptor = function (tableName) {
    var res  = defer(),
        that = this;


    this.queryBatch(
        'select 1 as dbo, ' +
            'case when T.table_type=\'BASE TABLE\' then \'U\' else \'V\' end as xtype, ' +
            'C.COLUMN_NAME as name, C.DATA_TYPE as \'type\', C.CHARACTER_MAXIMUM_LENGTH as max_length,' +
            'C.NUMERIC_PRECISION as \'precision\', C.NUMERIC_SCALE as \'scale\', ' +
            'case when C.IS_NULLABLE = \'YES\' then 1 else 0 end as \'is_nullable\', ' +
            'case when C.COLUMN_KEY=\'PRI\' then 1 else 0 end as \'pk\' ' +
            '  from INFORMATION_SCHEMA.tables T ' +
            ' JOIN INFORMATION_SCHEMA.columns C ON C.table_schema=T.table_schema and C.table_name=T.table_name ' +
            ' where T.table_schema=\'' + that.opt.database + '\' and T.table_name=\'' + tableName + '\''
    )
        .then(function (result) {
            if (result.length === 0) {
                res.reject('Table named ' + tableName + ' does not exist in ' + that.opt.server + ' - ' + that.opt.database);
                return;
            }

            result.forEach(c=>{
              c.ctype = mapping[c.type.toUpperCase()]||CType.unknown;
            });

            let isDbo = (result[0].dbo !== 0),
                xType;


            if (result[0].xtype.trim() === 'U') {
                xType = 'T';
            } else {
                xType = 'V';
            }

            _.forEach(result, function (col) {
                delete col.dbo;
                delete col.xtype;
            });
            res.resolve({name: tableName, xtype: xType, isDbo: isDbo, columns: result});
        },
            function (err) {
                res.reject(err);
            });
    return res.promise();
};

/**
 * get a sql command given by a sequence of specified sql commands
 * @method appendCommands
 * @param {string[]} cmd
 * @returns {string}
 */
Connection.prototype.appendCommands = function (cmd) {
    return cmd.join(';\r\n');
};

/**
 * get Sql type to contain n bits
 * @method sqlTypeForNBits
 * @param {int} nbits
 * @returns {string}
 */
Connection.prototype.sqlTypeForNBits = function(nbits){
    if (nbits <= 14) {
        return "smallint";
    }
    if (nbits <= 30) {
        return "int";
    }
    if (nbits <= 62) {
        return "bigint";
    }

    return `varchar(${nbits})`;
};


//
// Connection.prototype.declareAndClearVariableForNBits = function(varname,nbits){
//     /*
//                     string varprefix = EasyAudits.GetSqlParameterVarPrefixForResult(ntotalchecks);
//                     string varname = "@"+varprefix+num_audit.ToString();
//                     string res_type = EasyAudits.GetSqlParameterTypeNameForResult(ntotalchecks);
//                     string resetvar = EasyAudits.GetSqlResetVar(varname, ntotalchecks);
//
//                     string cmd = "declare " + varname + " " + res_type+";";
//                      cmd += resetvar;
//                      return cmd
//      */
//     if (nbits <= 14) {
//         return this.appendCommands([`declare ${varname} smallint`,`set ${varname}=0;`]);
//     }
//     if (nbits <= 30) {
//         return this.appendCommands([`declare ${varname} int`,`set ${varname}=0;`]);
//     }
//     if (nbits <= 62) {
//         return this.appendCommands([`declare ${varname} bigint`,`set ${varname}=0;`]);
//     }
//     return this.appendCommands([`declare ${varname} varchar(${nbits})`,`set ${varname}='';`]);
//
// };


/**
 * Returns a command that should return a number if last write operation did not have success
 * @public
 * @method giveErrorNumberDataWasNotWritten
 * @param {number} errNumber
 * @return string
 */
Connection.prototype.giveErrorNumberDataWasNotWritten = function (errNumber) {
    return 'if (ROW_COUNT()=0) BEGIN select ' + formatter.quote(errNumber) + '; RETURN; END';
};


Connection.prototype.namedParameterSupported = function(){
    return false;
};


/**
 * Returns a variable name identified by a number for a variable that can contain n bits of information
 * @param {int} num
 * @param {int} nbits
 */
Connection.prototype.variableNameForNBits = function(num,nbits){
    if (nbits <= 14) {
        return "@s"+num;
    }
    if (nbits <= 30) {
        return "@i"+num;
    }
    if (nbits <= 62) {
        return "@b"+num;
    }
    return "@c"+num;
};



/**
 * Get a command to select a bunch of rows
 * @param options.tableName {string}
 * @param options.nRows {int}
 * @param options.filter {string},
 * @param options.firstRow {int}
 * @param options.sorting {string},
 * @param options.environment {Context}
 * @return {string}
 */
Connection.prototype.getPagedTableCommand = function(options) {
    if (!options.sorting || !options.nRows){
        return Connection.prototype.getSelectCommand({
            tableName:options.tableName,filter:options.filter,environment:options.environment,
            orderBy:options.sorting
        });
    }
    return  "select  * from "+options.tableName+" ORDER BY "+options.sorting+ " LIMIT "+
        (options.firstRow-1)+","+options.nRows;

};




/**
 * Type of value depends on nbits
 * @param {object} value
 * @param {int}nbits
 * return {string}
 */
Connection.prototype.getBitArray = function(value,nbits){
    if (nbits>62){
        return value; //it is already in the desired form of [0|1] sequence
    }
    let result='';
    let n=nbits;
    while(n>0){
        result+=  ((value & 1)!==0)? "1":"0";
        value = value>>1;
        n--;
    }
    return result;
};


/**
 * Gives the column name for a variable name
 * @param {string} varName
 * @return {string}
 */
Connection.prototype.colNameFromVarName = function(varName) {
    return varName.substr(1);
};

/**
 * Get a command to convert a list of variables into a table with a column having a variable for each column
 * @param {Array.<varName:string,colName:string>}vars
 * @return {string}
 */
Connection.prototype.getSelectListOfVariables = function(vars) {
    if (vars.length===0){
        return  null;
    }
    return "SELECT "+vars.map(c=>c.varName+" AS "+c.colName).join(", ");
};



/**
 * Create a sql parameter
 * @param {object} paramValue
 * @param {string} paramName parameter name, as declared in the stored procedure
 * @param {string} varName  column name to extract as output
 * @param {string} sqlType
 * @param {boolean} forOutput
 */
Connection.prototype.createSqlParameter=function(paramValue,paramName,varName, sqlType, forOutput){
    return new  SqlParameter(paramValue,paramName,varName,sqlType, forOutput);
};


/**
 * Gets the sql command to read from a table nRowPerPage rows starting from firstRow
 * @param {string} tableName
 * @param {string} filter
 * @param {number} firstRow
 * @param {number} nRowPerPage
 * @param {string} sortBy
 * @return {string}
 */
Connection.prototype.getPagedTableCommand= function(tableName, filter, firstRow, nRowPerPage, sortBy){
    return "select top " + nRowPerPage + " * from ( SELECT ROW_NUMBER() OVER (ORDER BY " + sortBy +
        ") row_num, * FROM " + tableName +" WHERE " + filter + " ) x where row_num >= " +  firstRow;
};

/**
 * Returns a command that should return a constant number
 * @private
 * @method giveConstant
 * @param {object} c
 * @return string
 */
Connection.prototype.giveConstant = function (c) {
    return 'select ' + formatter.quote(c) + ';';
};


/**
 * Gets the formatter for this kind of connection
 * @method getFormatter
 * @return {sqlFormatter}
 */
Connection.prototype.getFormatter = function () {
    //noinspection JSValidateTypes
    return formatter;
};

Connection.prototype.mapping= mapping;

module.exports = {
    Connection: Connection,
    IsolationLevels:mapIsolationLevels,
    cType: CType,
    objectify:objectify
};
