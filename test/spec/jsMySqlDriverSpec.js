/*globals describe,beforeEach,it,expect,jasmine,spyOn,afterEach,xit,progress*/


console.log("running jsMySqlDriverSpec");


const  $dq = require("../../client/components/metadata/jsDataQuery");
const _ = require("lodash");

const fs = require("fs");
const path = require("path");

/**
 * ******************************************************************************************
 * VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT
 * ******************************************************************************************
 * It's necessary, before start running the test, to create a file templated like:
 *  { "server": "db server address",
 *    "database": "database name",  //this must be an EMPTY database
 *    "user": "db user",
 *    "pwd": "db password"
 *  }
 */
//PUT THE  FILENAME OF YOUR FILE HERE:
var configName = path.join('test', 'dbMySql.json');
var dbConfig;
if (process.env.TRAVIS){
    dbConfig = { "server": "127.0.0.1",
        "database": "test",
        "user": "root",
        "pwd": ""
    };
}
else {
    dbConfig = JSON.parse(fs.readFileSync(configName).toString());
}


var mySqlDriver = require('../../src/jsMySqlDriver'),
    IsolationLevel = {
        readUncommitted: 'READ_UNCOMMITTED',
        readCommitted: 'READ_COMMITTED',
        repeatableRead: 'REPEATABLE_READ',
        snapshot: 'SNAPSHOT',
        serializable: 'SERIALIZABLE'
    };
const {v4: uuidv4} = require("uuid");
const sqlServerDriver = require("../../src/jsSqlServerDriver");


describe('MySqlDriver ', function () {
    var sqlConn,
        dbInfo = {
            good: {
                server: dbConfig.server,
                useTrustedConnection: false,
                user: dbConfig.user,
                pwd: dbConfig.pwd,
                database: dbConfig.database
            },
            bad: {
                server: dbConfig.server,
                useTrustedConnection: false,
                user: dbConfig.user,
                pwd: dbConfig.pwd + 'AA',
                database: dbConfig.database
            }
        };


    function getConnection(dbCode) {
        let  options = dbInfo[dbCode];
        if (options) {
            options.dbCode = dbCode;
            return new mySqlDriver.Connection(options);
        }
        return undefined;
    }
    let canExecute=false;
    beforeEach(function (done) {
        canExecute=false;
        sqlConn = getConnection('good');
        sqlConn.open().done(function () {
                canExecute=true;
                done();
            })
            .fail(function (err) {
                console.log('Error failing '+err||"*");
                done();
            });
    }, 30000);

    afterEach(function () {
        if (sqlConn) {
            sqlConn.destroy();
        }
        sqlConn = null;
    });

    let dbName;
    let masterConn;
    beforeAll(function(done){
        masterConn= null;
        dbName = "mysqldrv_"+ uuidv4().replace(/\-/g, '_');
        let options =  _.extend({},dbInfo["good"]);
        if (options) {
            options.database = null;
            options.dbCode = "good";
            masterConn = new mySqlDriver.Connection(options);
            masterConn.open()
                .then(function () {
                    return masterConn.run("create database "+dbName);
                })
                .then(function () {
                    done();
                })
                .fail((err)=>{
                    console.log(err);
                });
        }

    });

    afterAll(function (done){
        if (!masterConn) {
            done();
        }
        masterConn.run("drop database IF EXISTS "+dbName)
            .then(()=>{
                return masterConn.close();
            })
            .then(()=>{
                done();
            });

    });


    describe('setup dataBase', function () {
        it('should run the setup script', function (done) {
            expect(canExecute).toBeTruthy();
            canExecute=false;
            sqlConn.run(fs.readFileSync(path.join('test', 'data', 'MySqlDriver', 'setup.sql')).toString())
                .done(function () {
                    expect(true).toBeTruthy();
                    done();
                })
                .fail(function (res) {
                    expect(res).toBeUndefined();
                    done();
                });
        }, 30000);

    });


    describe('structure', function () {


        it('should be defined', function () {
            expect(canExecute).toBeTruthy();
            expect(mySqlDriver).toEqual(jasmine.any(Object));
        });

        it('Connection should be a function', function () {
            expect(canExecute).toBeTruthy();
            expect(mySqlDriver.Connection).toEqual(jasmine.any(Function));
        });

        it('Connection should be a Constructor function', function () {
            expect(canExecute).toBeTruthy();
            expect(mySqlDriver.Connection.prototype.constructor).toEqual(mySqlDriver.Connection);
        });

        it('Connection() should return an object', function (done) {
            expect(canExecute).toBeTruthy();
            expect(sqlConn).toEqual(jasmine.any(Object));
            done();
        });

        it('Connection.open should be a function', function (done) {
            expect(canExecute).toBeTruthy();
            expect(sqlConn.open).toEqual(jasmine.any(Function));
            done();
        });
    });

    describe('open', function () {


        it('open should return a deferred', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.open()
                .done(function () {
                    expect(true).toBe(true);
                    sqlConn.destroy()
                        .then(()=>done());
                })
                .fail(function () {
                    expect(true).toBe(true);
                    sqlConn.destroy()
                        .then(()=>done());

                });

        });


        it('open with  right credential should return a success', function (done) {
            expect(canExecute).toBeTruthy();
            var goodSqlConn = getConnection('good');
            goodSqlConn.open()
                .done(function () {
                    expect(true).toBe(true);
                    goodSqlConn.destroy();
                    done();
                })
                .fail(function (errMess) {
                    expect(errMess).toBeUndefined();
                    done();
                });

        });

        it('open with bad credential should return an error', function (done) {
            expect(canExecute).toBeTruthy();
            var badSqlConn = getConnection('bad');
            badSqlConn.open()
                .done(function (res) {
                    expect(res).toBe(undefined);
                    expect(true).toBe(false);
                    done();
                })
                .fail(function (errMess) {
                    expect(errMess).toBeDefined();
                    done();
                });

        }, 3000);
    });



    describe('transactions', function () {


        it('set transaction isolation level should call queryBatch', function (done) {
            expect(canExecute).toBeTruthy();
            spyOn(sqlConn, 'queryBatch').and.callThrough();
            sqlConn.setTransactionIsolationLevel(IsolationLevel.readCommitted)
                .done(function () {
                    expect(sqlConn.queryBatch).toHaveBeenCalled();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('consecutive set transaction with same isolation level should not call queryBatch', function (done) {
            expect(canExecute).toBeTruthy();
            spyOn(sqlConn, 'queryBatch').and.callThrough();
            expect(sqlConn.queryBatch.calls.count()).toEqual(0);
            sqlConn.setTransactionIsolationLevel(IsolationLevel.readCommitted)
                .then(function () {
                    expect(sqlConn.queryBatch.calls.count()).toEqual(1);
                    return sqlConn.setTransactionIsolationLevel(IsolationLevel.readCommitted);
                })
                .then(function () {
                    expect(sqlConn.queryBatch.calls.count()).toEqual(1);
                    return sqlConn.setTransactionIsolationLevel(IsolationLevel.repeatableRead);
                })
                .then(function () {
                    expect(sqlConn.queryBatch.calls.count()).toEqual(2);
                    return sqlConn.setTransactionIsolationLevel(IsolationLevel.repeatableRead);
                })
                .then(function () {
                    expect(sqlConn.queryBatch.calls.count()).toEqual(2);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('begin transaction should return success', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.beginTransaction(IsolationLevel.repeatableRead)
                .done(function () {
                    expect(true).toBe(true);
                    sqlConn.rollBack();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });


        it('rollback transaction should fail without open conn', function (done) {
            expect(canExecute).toBeTruthy();
            var closedSqlConn = getConnection('good');
            closedSqlConn.rollBack()
                .done(function () {
                    expect(true).toBe(false);
                    done();
                })
                .fail(function (err) {
                    expect(err).toContain('closed');
                    done();
                });
        });

        it('rollback transaction should fail without begin tran', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.open()
                .then(function () {
                    sqlConn.rollBack()
                        .done(function (res) {
                            expect(res).toBe(undefined);
                            sqlConn.destroy();
                            done();
                        })
                        .fail(function (err) {
                            expect(err).toBeDefined();
                            sqlConn.destroy();
                            done();
                        });
                });
        });

        it('rollback transaction should success with a begin tran', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.beginTransaction(IsolationLevel.repeatableRead)
                .then(function () {
                    sqlConn.rollBack()
                        .done(function () {
                            expect(true).toBe(true);
                            done();
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            done();
                        });
                });
        });

    });

    describe('commands', function () {


        it('getDeleteCommand should compose a delete', function () {
            expect(canExecute).toBeTruthy();
            expect(sqlConn.getDeleteCommand(
                {
                    tableName: 'customer',
                    filter: $dq.eq('idcustomer', 2)
                }
            )).toEqual('DELETE FROM customer WHERE (idcustomer=2)');
        });

        it('getInsertCommand should compose an insert', function () {
            expect(canExecute).toBeTruthy();
            expect(sqlConn.getInsertCommand('ticket',
                ['col1', 'col2', 'col3'],
                ['a', 'b', 'c']
            )).toEqual('INSERT INTO ticket(col1,col2,col3)VALUES(\'a\',\'b\',\'c\')');
        });

        it('getUpdateCommand should compose an update', function () {
            expect(canExecute).toBeTruthy();
            expect(sqlConn.getUpdateCommand({
                table: 'ticket',
                filter: $dq.eq('idticket', 1),
                columns: ['col1', 'col2', 'col3'],
                values: ['a', 'b', 'c']
            })).toEqual('UPDATE ticket SET col1=\'a\',col2=\'b\',col3=\'c\' WHERE (idticket=1)');
        });

        /*
         CREATE PROCEDURE testSP2
         @esercizio int,   @meseinizio int,   @mess varchar(200),   @defparam decimal(19,2) =  2
         AS
         BEGIN
             if (defparam is null) THEN set defparam=2; 		 END IF;
             select 'aa' as colA, 'bb' as colB, 12 as colC , esercizio as original_esercizio,
             replace(mess,'a','z') as newmess,   defparam*2 as newparam;
         END
         */
        it('callSPWithNamedParams should have success', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.callSPWithNamedParams({
                    spName: 'testSP2',
                    paramList: [
                        {name: 'esercizio', value: 2013},
                        {name: 'meseinizio', value: 1},
                        {name: 'mess', value: 'ciao JS'},
                        {name: 'defparam', value: 10}
                    ]})
                .progress(function (x) {
                    expect(x).toBeUndefined();
                })
                .done(function (res) {
                    expect(_.isArray(res)).toBeTruthy();
                    expect(res.length).toBe(1);

                    var res0 = res[0]; //one result
                    expect(_.isArray(res0)).toBeTruthy();
                    expect(res0.length).toBe(1); //result is an array of 1 row

                    let o = res0[0];
                    //noinspection JSUnresolvedVariable
                    expect(o.colA).toBe('aa');
                    /*jshint camelcase: false */
                    //noinspection JSUnresolvedVariable
                    expect(o.original_esercizio).toBe(2013);
                    //noinspection JSUnresolvedVariable
                    expect(o.newparam).toEqual(20.0);
                    //noinspection JSUnresolvedVariable
                    expect(o.newmess).toBe('cizo JS');
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        /*
       CREATE PROCEDURE testSP2 (IN esercizio int, IN meseinizio int, IN mess varchar(200), IN defparam decimal(19,2) )
        BEGIN
             if (defparam is null) THEN set defparam=2; 		 END IF;
             select 'aa' as colA, 'bb' as colB, 12 as colC , esercizio as original_esercizio,
             replace(mess,'a','z') as newmess,   defparam*2 as newparam;
        END
         */
        it('callSPWithNamedParams with unsorted params should FAIL  - param order matters - named params not supported', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.callSPWithNamedParams({
                    spName: 'testSP2',
                    paramList: [
                        {name: 'defparam', value: 10},
                        {name: 'mess', value: 'ciao JS'},
                        {name: 'esercizio', value: 2013},
                        {name: 'meseinizio', value: 1}
                    ]
                })
                .progress(function (x) {
                    expect(x).toBeUndefined();
                })
                .done(function (res) {
                    //shouldn't have success
                    expect(true).toBe(false);
                    done();
                })
                .fail(function (err) {
                    //console.log(err);//MySql.Data.MySqlClient.MySqlException: Incorrect integer value: 'ciao JS' for column 'meseinizio' at row 1 running CALL  testSP2(10,'ciao JS',2013,1)
                    expect(err).toBeDefined();
                    done();
                });
        });


        /*
         CREATE PROCEDURE testSP1
         @esercizio int, @meseinizio int, @mesefine int out, @mess varchar(200), @defparam decimal(19,2) =  2
         AS
         BEGIN
           if (defparam is null) THEN set defparam=2; 		 END IF;
	           set mesefine= 12;
	           select 'a' as colA, 'b' as colB, 12 as colC , esercizio as original_esercizio,
		            replace(mess,'a','z') as newmess,
		             defparam*2 as newparam;
         END

         */
        it('callSPWithNamedParams with output params should have success', function (done) {
            expect(canExecute).toBeTruthy();
            var table;
            let paramList=[
                {name: 'esercizio', value: 2013},
                {name: 'meseinizio', value: 2},
                {varName: '@mesefine', name: 'mesefine', out: true, sqltype: 'int'},
                {name: 'mess', value: 'ciao JS'},
                {name: 'defparam', value: 10}
            ];
            sqlConn.callSPWithNamedParams({
                    spName: 'testSP1',
                    paramList: paramList
                })
                .progress(function (res) {
                    table = res;
                    expect(_.isArray(res)).toBeTruthy();
                    expect(res.length).toBe(1);
                    var o = res[0];
                    //noinspection JSUnresolvedVariable
                    expect(o.colA).toBe('a');
                    /*jshint camelcase: false */
                    //noinspection JSUnresolvedVariable
                    expect(o.original_esercizio).toBe(2013);
                    //noinspection JSUnresolvedVariable
                    expect(o.newparam).toEqual(20.0);
                    //noinspection JSUnresolvedVariable
                    expect(o.mesefine).toBeUndefined();
                    expect(o.mese).toBe(undefined);
                })
                .done(function (o) {
                    expect(table).toBeDefined();
                    expect(_.isArray(o)).toBeTruthy();
                    expect(o.length).toBe(1);
                    expect(o[0]).toBe(table);

                    expect(paramList[2].value).toBeUndefined();
                    expect(paramList[2].outValue).toBe(12);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });
        /*
        CREATE  PROCEDURE  testSP3 (esercizio int)
        BEGIN
            IF (esercizio IS NULL) then set esercizio=0; end IF;
            select * from customer limit 100;
            select * from seller limit 100;
            select * from customerkind as c2 limit 40;
            select * from sellerkind as s2 limit 50;
        END
         */
        it('callSPWithNamedParams should return multiple tables', function (done) {
            expect(canExecute).toBeTruthy();
            var table;
            let paramList=[
                {name: 'esercizio', value: 2013}
            ];
            let nProgress=0;
            sqlConn.callSPWithNamedParams({
                spName: 'testSP3',
                paramList: paramList
            })
                .progress(function (res) {
                    nProgress++;
                })
                .done(function (o) {
                    expect(nProgress).toBe(3);
                    expect(_.isArray(o)).toBeTruthy();
                    expect(o.length).toBe(4);
                    expect(o[0].length).toBe(100);
                    expect(o[1].length).toBe(100);
                    expect(o[2].length).toBe(40);
                    expect(o[3].length).toBe(50);

                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });
    });

    describe('tableDescriptor',function (){
        it('should return a TableDescriptor',function(done){
            expect(canExecute).toBeTruthy();
            sqlConn.tableDescriptor('customer')
                .then(/*{TableDescriptor}*/t=>{
                    expect(t.xtype).toBe("T");
                    expect(t.name).toBe("customer");
                    expect(t.columns).toBeDefined();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });


    });

    describe('clear dataBase', function () {
        it('should run the destroy script', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.run(fs.readFileSync(path.join('test','data','MySqlDriver', 'destroy.sql')).toString())
                .done(function () {
                    expect(true).toBeTruthy();
                    done();
                })
                .fail(function (res) {
                    expect(res).toBeUndefined();
                    done();
                });
        }, 30000);
    });
});
