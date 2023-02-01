/*globals describe,beforeEach,it,expect,jasmine,spyOn,afterEach,xit,progress*/
'use strict';

const { v4: uuidv4 } = require('uuid');

console.log("running jsSqlServerDriverSpec");


const $dq = require('./../../client/components/metadata/jsDataQuery'),
     _ = require('lodash'),
    fs = require("fs"),
    path = require("path");


/**
 * *****************************************************************************************
 * VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT
 * *****************************************************************************************
 * It's necessary, before start running the test, to create a file templated like:
 *  { "server": "db server address",
 *    "database": "database name",  //this must be an EMPTY database
 *    "user": "db user",
 *    "pwd": "db password"
 *  }
 */
//PUT THE  FILENAME OF YOUR FILE HERE:


const configName = path.join('test', 'dbSqlServer.json');
    //path.join('test','data', 'jsSqlServerDriver', 'dbSqlServer.json');

let dbConfig;
if (process.env.TRAVIS){
    dbConfig = { "server": "127.0.0.1",
        "database": "test",
        "user": "sa",
        "pwd": "YourStrong!Passw0rd"
    };
}
else {
    dbConfig = JSON.parse(fs.readFileSync(configName).toString());
}

const sqlServerDriver = require('../../src/jsSqlServerDriver'),
    IsolationLevel = {
        readUncommitted: 'READ_UNCOMMITTED',
        readCommitted: 'READ_COMMITTED',
        repeatableRead: 'REPEATABLE_READ',
        snapshot: 'SNAPSHOT',
        serializable: 'SERIALIZABLE'
    };
const dbList = require("../../src/jsDbList");
const Deferred = require("JQDeferred");
const mySqlDriver = require("../../src/jsMySqlDriver");



let dbName = "sqldrv_"+ uuidv4().replace(/\-/g, '_');

describe('sqlServerDriver ', function () {
    let dbInfo = {
            good: {
                server: dbConfig.server,
                useTrustedConnection: false,
                user: dbConfig.user,
                pwd: dbConfig.pwd,
                database: dbName,
                schema:"DBO",
                defaultSchema:"DBO"
            },
            bad: {
                server: dbConfig.server,
                useTrustedConnection: false,
                user: dbConfig.user,
                pwd: dbConfig.pwd + 'AA',
                database: dbName
            }
        };


    function getConnection(dbCode) {
        let options = _.extend({},dbInfo[dbCode]);
        if (options) {
            options.dbCode = dbCode;
            return new sqlServerDriver.Connection(options);
        }
        return undefined;
    }

    let masterConn;
    let sqlConn;

    beforeAll(function(done){
        masterConn= null;
        let masterConnTemp= null;
        sqlConn= null;
        canExecute=false;
        let sqlOpen = Deferred();
        let options =  _.extend({},dbInfo["good"]);
        if (options) {
            options.database = null;
            options.dbCode = "good";
            masterConnTemp = new sqlServerDriver.Connection(options);
            masterConnTemp.open()
                .then(function () {
                    // console.log("creating db "+dbName);
                    return masterConnTemp.run("drop database IF EXISTS "+dbName+";\n\rcreate database "+dbName);
                })
                .then(function(){
                    // console.log("connecting to db");
                    sqlConn = getConnection('good');
                    sqlConn.open()
                        .then((rr)=> {
                            // console.log("db connected");
                            sqlOpen.resolve(rr);
                        })
                        .fail(rr=> {
                                sqlOpen.reject(rr);
                            });
                })
                .fail((err)=>{
                    console.log(err);
                    sqlOpen.reject(err);
                });

            sqlOpen.then(()=>{
                // console.log("db connected, running setup");
                sqlConn.run(fs.readFileSync(path.join('test', 'data', 'sqlServer', 'Setup.sql')).toString())
                    .then(()=>{
                        // console.log("setup runned, closing");
                        return sqlConn.close();
                    })
                    .then(()=>{
                        // console.log("closed connection 1");
                        masterConn = masterConnTemp;
                        done();
                    })
                    .fail(err=>{
                        console.log(err);
                    });
            });
        }
    },60000);



    afterAll(function (done){
        console.log("running Afterall");
        if (!masterConn) {
            // console.log("no masterConn, quitting afterAll");
            done();
            return;
        }
        console.log("dropping db "+dbName);
        masterConn.run("drop database IF EXISTS "+dbName)
            .then(()=>{
                console.log("DB Dropped");
                masterConn.close()
                    .then(()=>{
                        // console.log("closing connection 0");
                        done();
                    });
            }, (err)=>{
                console.log("dropping error");
                console.log(err);
            });

    },30000);


    let canExecute=false;
    beforeEach(function (done) {
        canExecute=false;
        if (!masterConn){
            console.log("no Master Conn");
            done();
            return;
        }
        sqlConn = getConnection('good');
        sqlConn.open().then(function () {
            canExecute=true;
            done();
        }).fail(function (err) {
            console.log('Error failing '+err);
            done();
        });
    }, 30000);

    afterEach(function (done) {
        if (sqlConn) {
            sqlConn.destroy()
                .then(()=>{
                    done();
                });
        }
        sqlConn = null;
    });




    describe('structure', function () {


        it('should be defined', function () {
            expect(canExecute).toBeTruthy();
            expect(sqlServerDriver).toEqual(jasmine.any(Object));
        });

        it('Connection should be a function', function () {
            expect(canExecute).toBeTruthy();
            expect(sqlServerDriver.Connection).toEqual(jasmine.any(Function));
        });

        it('Connection should be a Constructor function', function () {
            expect(canExecute).toBeTruthy();
            expect(sqlServerDriver.Connection.prototype.constructor).toEqual(sqlServerDriver.Connection);
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
                    sqlConn.destroy();
                    done();
                })
                .fail(function () {
                    expect(true).toBe(true);
                    sqlConn.destroy();
                    done();
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

        }, 30000);
    });

    describe('various', function () {

        it('select getdate() should give results', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.queryBatch('SELECT getdate() as currtime')
                .done(function (result) {
                    expect(result).toBeDefined();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });


        it('select * from table should give results', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.queryBatch('select * from customer')
                .done(function (result) {
                    expect(result).toBeDefined();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('Date should be given as objects', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.queryBatch('SELECT * from customer')
                .done(function (result) {
                    _(result).forEach(function (r) {
                        if (r.idcustomer) {
                            expect(r.idcustomer).toEqual(jasmine.any(Number));
                        }
                        if (r.stamp) {
                            expect(r.stamp).toEqual(jasmine.any(Date));
                        }
                    });
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('notify should be called from queryRaw when multiple result got (two select)', function (done) {
            expect(canExecute).toBeTruthy();
            var progressCalled, nResult = 0;
            sqlConn.queryBatch('select top 5 * from customer ; select top 10 * from seller; ')
            .progress(function (result) {
                expect(result).toBeDefined();
                expect(result.length).toBe(5);
                nResult += 1;
                progressCalled = true;
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
                done();
            })
            .done(function (result) {
                expect(result.length).toBe(10);
                expect(nResult).toBe(1);
                expect(progressCalled).toBeTruthy();
                done();
            });
        });

        it('notify should be called from queryRaw when multiple result got (three select)', function (done) {
            expect(canExecute).toBeTruthy();
            var len            = [];
            sqlConn.queryBatch('select top 1 * from seller;select top 3 * from seller;select top 5 * from customer;'+
                'select top 10 * from seller;select top  2 * from customer;')
            .progress(function (result) {
                len.push(result.length);
                return true;
            })
            .fail(function (err) {
                expect(err).toBeUndefined();
                done();
            })
            .done(function (result) {
                len.push(result.length);
                expect(len).toEqual([1,3, 5, 10, 2]);
                done();
            });
        });
    },30000);


    describe("transactions", function () {


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
                        .done(function () {
                            expect(true).toBe(false);
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
                }
            )).toEqual('UPDATE ticket SET col1=\'a\',col2=\'b\',col3=\'c\' WHERE (idticket=1)');
        });

        /*
         CREATE PROCEDURE testSP2
         @esercizio int,   @meseinizio int,   @mess varchar(200),   @defparam decimal(19,2) =  2
         AS
         BEGIN
         select 'aa' as colA, 'bb' as colB, 12 as colC , @esercizio as original_esercizio,
         replace(@mess,'a','z') as newmess,   @defparam*2 as newparam
         END
         */
        it('callSPWithNamedParams should have success', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.callSPWithNamedParams({
                    spName: 'testSP2',
                    paramList: [
                        {name: '@esercizio', value: 2013},
                        {name: '@meseinizio', value: 1},
                        {name: '@mess', value: 'ciao JS'},
                        {name: '@defparam', value: 10}
                    ]
                })
                .progress(function (x) {
                    expect(x).toBeUndefined();
                })
                .done(function (res) {
                    expect(_.isArray(res)).toBeTruthy();
                    expect(res.length).toBe(1);

                    var res0 = res[0];
                    expect(_.isArray(res0)).toBeTruthy();
                    expect(res0.length).toBe(1);

                    var o = res0[0];
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

        it('callSPWithNamedParams with unsorted params should have success - param order does not matter', function (done) {
            expect(canExecute).toBeTruthy();
            let paramList=[
                {name: '@defparam', value: 10},
                {name: '@mess', value: 'ciao JS'},
                {name: '@esercizio', value: 2013},
                {name: '@meseinizio', value: 1}
            ];
            sqlConn.callSPWithNamedParams({
                    spName: 'testSP2',
                    paramList: paramList
                })
                .progress(function (x) {
                    expect(x).toBeUndefined();
                })
                .done(function (res) {
                    expect(_.isArray(res)).toBeTruthy();
                    expect(res.length).toBe(1);

                    var res0 = res[0];
                    expect(_.isArray(res0)).toBeTruthy();
                    expect(res0.length).toBe(1);

                    var o = res0[0];

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
         CREATE PROCEDURE testSP1
         @esercizio int, @meseinizio int, @mesefine int out, @mess varchar(200), @defparam decimal(19,2) =  2
         AS
         BEGIN
         set @meseinizio= 12
         select 'a' as colA, 'b' as colB, 12 as colC , @esercizio as original_esercizio,
         replace(@mess,'a','z') as newmess,  @defparam*2 as newparam
         END

         */
        it('callSPWithNamedParams with output params should have success', function (done) {
            expect(canExecute).toBeTruthy();
            var table;
            let paramList=[
                {name: '@esercizio', value: 2013},
                {name: '@meseinizio', value: 2},
                {name: '@mesefine', varName:'@mese', out: true, sqltype: 'int'},
                {name: '@mess', value: 'ciao JS'},
                {name: '@defparam', value: 10}
            ];

            sqlConn.callSPWithNamedParams({
                    spName: 'testSP1',
                    paramList:paramList
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
                    expect(o.newmess).toBe('cizo JS');
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
        CREATE  PROCEDURE  testSP3 (@esercizio int=0) AS
        BEGIN
            select top 100 * from customer ;
            select top 100 * from seller ;
            select top 10 * from customerkind as c2 ;
            select top 10 * from sellerkind as s2 ;
        END
         */
        it('callSPWithNamedParams should return multiple tables', function (done) {
            expect(canExecute).toBeTruthy();
            var table;
            let paramList=[
                {name: '@esercizio', value: 2013}
            ];
            let nProgress=0;
            sqlConn.callSPWithNamedParams({
                spName: 'testSP3',
                paramList:paramList
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
                    expect(o[2].length).toBe(10);
                    expect(o[3].length).toBe(10);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

    });

    describe('querylines', function () {


        it('queryLines should return as many meta as read tables ', function (done) {
            expect(canExecute).toBeTruthy();
            var nResp = 0;
            sqlConn.queryLines(
                'select top 10 * from customer; select top 20 * from seller; select top 2 * from customerkind', true)
                .progress(function (r) {
                    expect(r).toBeDefined();
                    if (r.meta) {
                        nResp += 1;
                    }
                })
                .done(function (result) {
                    expect(nResp).toBe(3);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });

        });

        it('meta returned from queryLines should be arrays ', function (done) {
            expect(canExecute).toBeTruthy();
            sqlConn.queryLines(
                'select top 10 * from sellerkind; select top 20 * from seller; select top 2 * from customerkind', true)
                .progress(function (r) {
                    //console.log('GOT:'+JSON.stringify(r))
                    if (r.meta) {
                        expect(r.meta).toEqual(jasmine.any(Array));
                    }
                })
                .done(function () {
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });

        });

        it('queryLines should return all rows one at a time', function (done) {
            expect(canExecute).toBeTruthy();
            var nResp = 0;
            sqlConn.queryLines('select top 5 * from seller', true)
                .progress(function (r) {
                    expect(r).toBeDefined();
                    if (r.row) {
                        nResp += 1;
                         let buff = Buffer.from(r.row[9],"base64");
                         //let text = buff.toString('utf-8');
                         fs.writeFileSync('decifraBase64.txt', buff);
                         //if (nResp===1) console.log(buff);
                    }
                })
                .done(function () {
                    expect(nResp).toBe(5);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });

        });

        it('queryLines should return row as arrays ', function (done) {
            expect(canExecute).toBeTruthy();
            var nResp = 0;
            sqlConn.queryLines('select top 5 * from customerkind', true)
                .progress(function (r) {
                    if (r.row) {
                        nResp += 1;
                        expect(r.row).toEqual(jasmine.any(Array));
                    }
                })
                .done(function () {
                    expect(nResp).toBe(5);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('queryLines should return row as objects when raw=false ', function (done) {
            expect(canExecute).toBeTruthy();
            var nResp = 0;
            sqlConn.queryLines('select top 5 * from customerkind', false)
                .progress(function (r) {
                    if (r.row) {
                        nResp += 1;
                        expect(r.row).toEqual(jasmine.any(Object));
                        //noinspection JSUnresolvedVariable
                        expect(r.row.idcustomerkind).toEqual(jasmine.any(Number));
                        //noinspection JSUnresolvedVariable
                        expect(r.row.name).toEqual(jasmine.any(String));
                    }
                })
                .done(function () {
                    expect(nResp).toBe(5);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('queryLines should work with multiple results ', function (done) {
            expect(canExecute).toBeTruthy();
            var nResp = 0;
            sqlConn.queryLines('select top 5 * from customerkind; select top 10 * from customer', false)
                .progress(function (r) {
                    if (r.row) {
                        nResp += 1;
                        expect(r.row).toEqual(jasmine.any(Object));
                        if (nResp <= 5) {
                            //noinspection JSUnresolvedVariable
                            expect(r.row.idcustomerkind).toEqual(jasmine.any(Number));
                            //noinspection JSUnresolvedVariable
                            expect(r.row.name).toEqual(jasmine.any(String));
                            //noinspection JSUnresolvedVariable
                            expect(r.row.surname).toBeUndefined();
                        }
                        else {
                            //noinspection JSUnresolvedVariable
                            expect(r.row.idcustomer).toEqual(jasmine.any(Number));
                            //noinspection JSUnresolvedVariable
                            expect(r.row.surname).toEqual(jasmine.any(String));
                            //noinspection JSUnresolvedVariable
                            expect(r.row.rnd).toBeUndefined();
                        }
                    }
                })
                .done(function () {
                    expect(nResp).toBe(15);
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


    // describe('clear dataBase', function () {
    //     it('should run the destroy script', function (done) {
    //         expect(canExecute).toBeTruthy();
    //         sqlConn.run(fs.readFileSync('test/data/sqlServer/Destroy.sql').toString())
    //             .done(function () {
    //                 expect(true).toBeTruthy();
    //                 done();
    //             })
    //             .fail(function (res) {
    //                 expect(res).toBeUndefined();
    //                 done();
    //             });
    //     }, 30000);
    // });
});
