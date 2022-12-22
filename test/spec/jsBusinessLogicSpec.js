/* globals describe, beforeEach,it,expect,jasmine,spyOn */
'use strict';
/*jshint -W069*/
/*jshint -W083*/
console.log("running BusinessLogicSpec");

const BusinessLogic = require('../../src/jsBusinessLogic').BusinessLogic,
    BusinessMessage = require('../../src/jsBusinessLogic').BusinessMessage,
    OneSubst = require('../../src/jsBusinessLogic').OneSubst,
    SubstGroup= require('../../src/jsBusinessLogic').SubstGroup,
    dsNameSpace = require('../../client/components/metadata/jsDataSet'),
    DataRow = dsNameSpace.DataRow,
    q = require('../../client/components/metadata/jsDataQuery'),
    CType = dsNameSpace.CType,
    DA = require('../../src/jsDataAccess'),
    GetDataSpace = require('../../src/jsGetData'),
    RowChange=require('../../src/jsBusinessLogic')._RowChange,
    BusinessLogicResult = require("../../src/jsPostData").BusinessLogicResult;


const Deferred = require("JQDeferred");
const FakeEnvironment = require('../data/BusinessLogic/fakeEnvironment'),
    dsProvider = require('../data/BusinessLogic/fakeDataSetProvider'),
    dbList = require('../../src/jsDbList'),
    DataRowState = dsNameSpace.dataRowState,
    DataSet = dsNameSpace.DataSet,
    DataTable = dsNameSpace.DataTable,
    DataColumn = dsNameSpace.DataColumn,
    Select = require('../../src/jsMultiSelect').Select,
    OptimisticLocking = dsNameSpace.OptimisticLocking,
    fs = require('fs'),
    path = require('path'),
    _ = require('lodash');
const {v4: uuidv4} = require("uuid");
const mySqlDriver = require("../../src/jsMySqlDriver");



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
const configName = path.join('test', 'dbMySql.json');
let dbConfig;

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


/**
 * setup the dbList module
 */
dbList.init({
    encrypt: false,
    decrypt: false,
    encryptedFileName: 'test/dbList.bin'
});
let dbName = "jsBLogic_drv_"+ uuidv4().replace(/\-/g, '_').substring(0,30);

const good = {
    server: dbConfig.server,
    useTrustedConnection: false,
    user: dbConfig.user,
    pwd: dbConfig.pwd,
    database: dbConfig.database,
    sqlModule: 'jsMySqlDriver'
};
good.database = dbName;


describe ("jsBusinessLogic",function () {
    let masterConn;
    let sqlConn;
    var originalTimeout;

    beforeAll(function(done){
        originalTimeout = jasmine.DEFAULT_TIMEOUT_INTERVAL;
        jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;

        masterConn= null;
        sqlConn= null;
        dbList.setDbInfo('testMainMySqlDriver', good);
        let sqlOpen = Deferred();
        let options =  _.extend({},good);
        if (options) {
            options.database = null;
            options.dbCode = "good";
            masterConn = new mySqlDriver.Connection(options);
            masterConn.open()
                .then(function () {
                    return masterConn.run("create database "+dbName);
                })
                .then(function(){
                    dbList.setDbInfo('testMySqlDriver', good);
                    sqlConn = dbList.getConnection('testMySqlDriver');
                    sqlConn.open()
                        .then((rr)=>sqlOpen.resolve(rr))
                        .fail(rr=>sqlOpen.reject(rr));
                    })
                .fail((err)=>{
                    console.log(err);
                });
        }
        sqlOpen.then(()=>{
            sqlConn.run(fs.readFileSync(path.join('test', 'data', 'BusinessLogic', 'setup.sql')).toString())
                .then(()=>{
                    return sqlConn.close();
                })
                .then(done);
        });

    });

    afterAll(function (done){
        jasmine.DEFAULT_TIMEOUT_INTERVAL = originalTimeout;
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

        /*
         if (sqlConn) {
                sqlConn.destroy();
            }
         */
    });


    describe('js prerequisites', function () {
        it ("Throwing exceptions generates a rejected promise ",function(done){
            let DefHelp = Deferred();

            setTimeout(() => {
                try {
                    DefHelp.resolve(null.divideByZero());
                }
                catch (e){
                    DefHelp.reject("division by 0");
                }

            }, 100);

            let intermediate=0;

            let res = DefHelp
                .fail((res) => {
                    expect(res).toBe("division by 0");
                    intermediate=12;
                })
                .always((res)=>{
                    expect(intermediate).toBe(12);
                    done();
                });
        });

        it("checking captured values in functions", function (done) {
            let fn = [];
            for (let i = 0; i <= 10; i++) {
                fn.push(function () {
                    let def = new Deferred();
                    def.resolve(i);
                    return def.promise();
                });
            }
            fn[3]().then(function (res) {
                expect(res).toBe(3);
                done();
            });


        });


        it("checking captured values in then sequence", function (done) {
            let baseDeferred = new Deferred();
            let totalDeferred = baseDeferred;
            let arr = [];
            let f = null;
            for (let i = 0; i < 10; i++) {
                f = function () {
                    let def = new Deferred();
                    def.resolve(i);
                    arr[i] = i;
                    return def.promise();
                };
                totalDeferred = totalDeferred.then(f);
            }
            let failed = false;
            totalDeferred.fail(() => failed = true);

            expect(arr.length).toBe(0);
            baseDeferred.resolve(0);
            expect(arr.length).toBe(10);
            expect(arr[3]).toBe(3);
            expect(failed).toBe(false);
            totalDeferred.then(() => done());
        });

        it("checking captured values in then sequence with reject", function (done) {
            let baseDeferred = new Deferred();
            let totalDeferred = baseDeferred;
            let arr = [];
            let f = null;
            for (let i = 0; i < 10; i++) {
                f = function () {
                    let def = new Deferred();
                    if (i < 5) {
                        def.resolve(i);
                    }
                    else {
                        def.reject(i);
                    }

                    arr[i] = i;
                    return def.promise();
                };
                totalDeferred = totalDeferred.then(f);
            }
            let failed = false;
            totalDeferred.fail(() => failed = true);
            let failed2 = false;
            totalDeferred.fail(() => failed2 = true);
            expect(arr.length).toBe(0);
            baseDeferred.resolve(0);
            expect(arr.length).toBe(6);
            expect(arr[3]).toBe(3);
            expect(failed).toBe(true);
            expect(failed2).toBe(true);
            done();
        });

        it("checking sequence of deferred returning functions", function (done) {
            let arr = [];
            let f = null;
            let returnDef = (x) => {
                arr[x] = x;
                return Deferred().resolve(x);
            };
            for (let i = 0; i < 10; i++) {
                f = f ? f.then(returnDef(i)) : returnDef(i);
            }
            let failed = false;
            f.fail(() => failed = true);
            expect(arr.length).toBe(10);
            expect(arr[3]).toBe(3);
            expect(failed).toBe(false);
            done();
        });

        it("checking sequence of deferred returning functions with some fail", function (done) {
            let arr = [];
            let f = null;
            let returnDef = (x) => {
                arr[x] = x;
                return Deferred().resolve(x);
            };
            let returnFail = (x) => {
                return Deferred().reject(x);
            };
            let fun = function (i) {
                if (i === 5) {
                    return returnDef(i);
                }
                else {
                    return returnFail(i);
                }
            };
            expect(arr.length).toBe(0);
            for (let i = 0; i < 10; i++) {
                f = f ? f.then(fun(i)) : fun(i);
            }
            expect(arr.length).toBe(6);
            let failed = false;
            f.fail(() => failed = true);
            expect(arr.length).toBe(6);
            expect(arr[3]).toBe(undefined);
            expect(arr[5]).toBe(5);
            expect(failed).toBe(true);
            done();
        });

        it("A Deferred should be awaitable", async function () {

            let Def = Deferred();
            setTimeout(() => Def.resolve(10), 50);
            let res = await Def;
            expect(res).toBe(10);

        });

        it("An async should be then-able", function (done) {

            let DefHelp = Deferred();
            setTimeout(() => DefHelp.resolve(14), 50);

            async function f() {
                return await DefHelp;
            }

            let res = f()
                .then((res) => {
                    expect(res).toBe(14);
                    done();
                });
        });

        it ("Always is always called (then-always)",function(done){
            let DefHelp = Deferred();
            setTimeout(() => DefHelp.reject(14), 100);

            let res = DefHelp
                .then((res) => {
                    expect(true).toBe(false);
                    done();
                })
                .always((res)=>{
                    expect(res).toBe(14);
                    done();
                });
        });

        it ("Always is always called (done-always)",function(done){
            let DefHelp = Deferred();
            setTimeout(() => DefHelp.reject(14), 1000);



            let res = DefHelp
                .done((res) => {
                    expect(true).toBe(false);
                    done();
                })
                .always((res)=>{
                    expect(res).toBe(14);
                    done();
                });
        });

        it ("Always is always called (fail-always)",function(done){
            let DefHelp = Deferred();
            setTimeout(() => DefHelp.reject(14), 1000);

            let intermediate=0;

            let res = DefHelp
                .fail((res) => {
                    expect(res).toBe(14);
                    intermediate=12;
                })
                .always((res)=>{
                    expect(intermediate).toBe(12);
                    expect(res).toBe(14);
                    done();
                });
        });

        it ("Always is always called (reject-done-fail-always)",function(done){
            let DefHelp = Deferred();
            setTimeout(() => DefHelp.reject(14), 1000);

            let intermediate=0;

            let res = DefHelp
                .done((res) => {
                    expect(1).toBe(0);
                    intermediate=10;
                })
                .fail((res) => {
                    expect(res).toBe(14);
                    intermediate=12;
                })
                .always((res)=>{
                    expect(intermediate).toBe(12);
                    expect(res).toBe(14);
                    done();
                });
        });




    });

    describe("RowChange", function () {
        describe("getRelated", function () {
            it("Should find same table", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let rc = new RowChange(0, rCustomerPhone.getRow(), [], 'dummy', 'dummy');

                expect(rc.getRelated("customerphone").current).toBe(rCustomerPhone);
            });

            it("Should return undefined if no parent present", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});

                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomerPhone = tCustomerPhone.newRow({idcustomer: 3, idcustomerphone: 1});
                let rc = new RowChange(0, rCustomerPhone.getRow(), [], 'dummy', 'dummy');

                expect(rc.getRelated("customer")).toBeUndefined();
            });


            it("Should find parent table", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let rc = new RowChange(0, rCustomerPhone.getRow(), [], 'dummy', 'dummy');

                expect(rc.getRelated("customer").current).toBe(rCustomer2);
            });

            it("Should find parent table by tableForWriting", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                tCustomer.tableForWriting("different");
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let rc = new RowChange(0, rCustomerPhone.getRow(), [], 'dummy', 'dummy');

                expect(rc.getRelated("different").current).toBe(rCustomer2);
            });

            it("Should find child table if one child row present ", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let rc = new RowChange(0, rCustomer2.getRow(), [], 'dummy', 'dummy');

                expect(rc.getRelated("customerphone").current).toBe(rCustomerPhone);
            });

            it("Should not find child table if two child row present ", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let rCustomerPhone2 = tCustomerPhone.newRow(null, rCustomer2);
                let rc = new RowChange(0, rCustomer2.getRow(), [], 'dummy', 'dummy');

                expect(rc.getRelated("customerphone")).toBeUndefined();
            });


        });


    });

    describe("BusinessMessage", function () {
        describe("Constructor", function () {
            it("msg should be set to Long Message (plain message)", function () {
                let bm = new BusinessMessage({
                    shortMsg: "Error",
                    longMsg: "Long Message",
                    canIgnore: false
                });
                expect(bm.msg).toBe("Long Message");
                expect(bm.getMessage()).toBe("Long Message");
            });

            it("msg should be set to Long Message (plain message)", function () {
                let bm = new BusinessMessage({
                    shortMsg: "Error",
                    longMsg: "Long Message",
                    canIgnore: false
                });
                expect(bm.msg).toBe("Long Message");
                expect(bm.getMessage()).toBe("Long Message");
                expect(bm.openSubstitutions.length).toBe(0);
            });

            it("msg should compile same table fields", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let rc = new RowChange(0, rCustomerPhone.getRow(), [], 'dummy', 'dummy');
                rCustomerPhone.idcustomerphone = 12;
                let bm = new BusinessMessage({
                    rowChange: rc,
                    shortMsg: "Error",
                    longMsg: "Text about %<customerphone.idcustomerphone>% and other things",
                    canIgnore: false
                });

                expect(bm.msg).toBe("Text about 12 and other things");

            });

            it("msg should compile parent table fields", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                rCustomer2.idcustomer = 30;
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let rc = new RowChange(0, rCustomerPhone.getRow(), [], 'dummy', 'dummy');

                let bm = new BusinessMessage({
                    rowChange: rc,
                    shortMsg: "Error",
                    longMsg: "Text about %<customer.idcustomer>% and other things",
                    canIgnore: false
                });

                expect(bm.msg).toBe("Text about 30 and other things");
            });

            it("msg should compile child table fields", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                rCustomer2.idcustomer = 30;
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                rCustomerPhone.idcustomerphone = 12;
                let rc = new RowChange(0, rCustomer2.getRow(), [], 'dummy', 'dummy');

                let bm = new BusinessMessage({
                    rowChange: rc,
                    shortMsg: "Error",
                    longMsg: "Text about %<customerphone.idcustomerphone>% and other things",
                    canIgnore: false
                });

                expect(bm.msg).toBe("Text about 12 and other things");
            });

            it("msg should not compile child table fields if not really child rows", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                rCustomer2.idcustomer = 30;
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                rCustomerPhone.idcustomerphone = 12;
                let rc = new RowChange(0, rCustomer1.getRow(), [], 'dummy', 'dummy');

                let bm = new BusinessMessage({
                    rowChange: rc,
                    shortMsg: "Error",
                    longMsg: "Text about %<customerphone.idcustomerphone>% and other things",
                    canIgnore: false
                });

                expect(bm.msg).toBe("Text about %<customerphone.idcustomerphone>% and other things");
            });

            it("msg should compile multiple fields", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                rCustomer2.idcustomer = 30;
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                rCustomerPhone.idcustomerphone = 12;

                let rc = new RowChange(0, rCustomerPhone.getRow(), [], 'dummy', 'dummy');

                let bm = new BusinessMessage({
                    rowChange: rc,
                    shortMsg: "Error",
                    longMsg: "Text about %<customer.idcustomer>% - %<customerphone.idcustomer>% %<customerphone.idcustomerphone>% and other things",
                    canIgnore: false
                });

                expect(bm.msg).toBe("Text about 30 - 30 12 and other things");
            });


        });

        describe('findPostingColumn', function () {

            it('should give the exact column where it exists', function () {
                let t = new DataTable("test");
                t.columns.col1 = new DataColumn("col1", "int");
                t.columns.col2 = new DataColumn("col2", "int");
                t.columns.col3 = new DataColumn("col3", "int");
                let findCol = BusinessMessage.prototype.findPostingColumn(t, "col2");
                expect(findCol).toBe("col2");
            });

            it('should be null when a column is not found', function () {
                let t = new DataTable("test");
                t.columns.col1 = new DataColumn("col1", "int");
                t.columns.col2 = new DataColumn("col2", "int");
                t.columns.col3 = new DataColumn("col3", "int");
                let findCol = BusinessMessage.prototype.findPostingColumn(t, "col4");
                expect(findCol).toBeNull();
            });


            it('should give the column if has forPosting set with that field name', function () {
                let t = new DataTable("test");
                t.columns.col1 = new DataColumn("col1", "int");
                t.columns.col2 = new DataColumn("col2", "int");
                t.columns.col3 = new DataColumn("col3", "int");
                t.columns.col3.forPosting = "col4";
                t.tableForWriting("tt");
                let findCol = BusinessMessage.prototype.findPostingColumn(t, "col4");
                expect(findCol).toBe("col3");
            });

            it('should not give column if Table has no alias for writing', function () {
                let t = new DataTable("test");
                t.columns.col1 = new DataColumn("col1", "int");
                t.columns.col2 = new DataColumn("col2", "int");
                t.columns.col3 = new DataColumn("col3", "int");
                t.columns.col3.forPosting = "col4";
                let findCol = BusinessMessage.prototype.findPostingColumn(t, "col4");
                expect(findCol).toBeNull();
            });

            it('should not give the column if has forPosting set with a different name', function () {
                let t = new DataTable("test");
                t.columns.col1 = new DataColumn("col1", "int");
                t.columns.col2 = new DataColumn("col2", "int");
                t.columns.col3 = new DataColumn("col3", "int");
                t.columns.col3.forPosting = "col4";
                t.tableForWriting("tt");
                let findCol = BusinessMessage.prototype.findPostingColumn(t, "col3");
                expect(findCol).toBeNull();
            });

            it('should  give the column if has forPosting set with same name', function () {
                let t = new DataTable("test");
                t.columns.col1 = new DataColumn("col1", "int");
                t.columns.col2 = new DataColumn("col2", "int");
                t.columns.col3 = new DataColumn("col3", "int");
                t.columns.col3.forPosting = "col3";
                t.tableForWriting("tt");
                let findCol = BusinessMessage.prototype.findPostingColumn(t, "col3");
                expect(findCol).toBe("col3");
            });
        });

    });

    describe("BusinessLogic", function () {
        let context;

        let nSpecs=0;
        beforeEach(function (done) {
            nSpecs++;
            //console.log("beforeEach called "+nSpecs);
            //dbList.setDbInfo('test', good);
            //sqlConn = dbList.getConnection('test');
            //sqlConn.open().done(function () {
            context = new dbList.Context();
            context.dbCode = "testMySqlDriver";
            dbList.getDataAccess("testMySqlDriver").then(function (DA) {
                context.dataAccess = DA;
                context.sqlConn = context.dataAccess.sqlConn;
                expect(context.sqlConn).toBeDefined();
                context.dbDescriptor = dbList.getDescriptor("testMySqlDriver");
                context.environment = new FakeEnvironment();
                context.getDataSpace = GetDataSpace;
                //console.log("beforeEach Done "+nSpecs);
                done();
            });

            //});
        });

        afterEach(function (done) {
            //console.log("afterEach called "+nSpecs);
            if (context.sqlConn) {
                context.sqlConn.destroy()
                    .always(()=>{
                        return context.dataAccess.destroy();
                    })
                    .always (()=>{
                        //console.log("afterEach Done "+nSpecs);
                        done();
                    })
                .fail(err=>{console.log(err);});
            }
            else {
                done();
            }
            sqlConn = null;
        });


        describe("getProcName", function () {
            it("inserted row gives check_table_i_pre/post", function () {
                let t = new DataTable("tab1");
                let r = t.newRow();
                expect(BusinessLogic.prototype.getProcName(r, true)).toBe("check_tab1_i_post");
                expect(BusinessLogic.prototype.getProcName(r, false)).toBe("check_tab1_i_pre");
            });

            it("modified row gives check_table_i_pre/post", function () {
                let t = new DataTable("tab1");
                let r = t.newRow();
                r.$acceptChanges();
                r.a = 2;
                expect(BusinessLogic.prototype.getProcName(r, true)).toBe("check_tab1_u_post");
                expect(BusinessLogic.prototype.getProcName(r, false)).toBe("check_tab1_u_pre");
            });

            it("inserted row gives check_table_i_pre/post", function () {
                let t = new DataTable("tab1");
                let r = t.newRow();
                r.a = 2;
                r.$acceptChanges();
                r.$del();
                expect(BusinessLogic.prototype.getProcName(r, true)).toBe("check_tab1_d_post");
                expect(BusinessLogic.prototype.getProcName(r, false)).toBe("check_tab1_d_pre");
            });
        });


        describe("getRules", function () {

            it("should call getStartingFrom with right arguments", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let dsRules;
                spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                    const def = Deferred().resolve();
                    dsRules = ds;
                    return def.promise();
                });

                let BL = new BusinessLogic(context, [rCustomer1, rCustomer2, rCustomerPhone]);
                BL.auditsPromise.then(function (auditsDS) {
                    expect(auditsDS).toBeDefined();
                    expect(auditsDS.tables["tableop"]).toBeDefined();
                    let tableop = auditsDS.tables["tableop"];
                    expect(tableop.rows.length).toBe(2);
                    let resCust = tableop.select(q.and(q.eq("tablename", "customer"), q.eq("opkind", "i")));
                    let resCustPhone = tableop.select(q.and(q.eq("tablename", "customerphone"), q.eq("opkind", "i")));
                    expect(resCust.length).toBe(1);
                    expect(resCustPhone.length).toBe(1);
                    BL.destroy().always(()=>{
                        done();
                    });
                });

            });

        });

        describe("filterParameters", function () {
            it("should return a filter using table,op,isprecheck", function () {
                let t = new DataTable("dummyTable");
                let r = t.newRow({a: 1, b: 2});
                let filter = BusinessLogic.prototype.filterParameters(r.getRow(), true);
                expect(filter).toBeDefined();
                let expected = q.and(q.eq("tablename", "dummyTable"),
                    q.eq("opkind", "I"),
                    q.eq("isprecheck", "N"));
                expect(filter.toString()).toBe(expected.toString());
            });

            it("should return a filter with preCheck true ", function () {
                let t = new DataTable("dummyTable");
                let r = t.newRow({a: 1, b: 2});
                r.getRow().acceptChanges();
                r.getRow().del();
                //this causes the row to be in deleted state
                let filter = BusinessLogic.prototype.filterParameters(r.getRow(), false);
                expect(filter).toBeDefined();
                let expected = q.and(q.eq("tablename", "dummyTable"),
                    q.eq("opkind", "D"),
                    q.eq("isprecheck", "S"));
                expect(filter.toString()).toBe(expected.toString());
            });

            it("should use tableForWriting as table name", function () {
                let t = new DataTable("dummyTable");
                t.tableForWriting("toWrite");
                let r = t.newRow({a: 1, b: 2});
                r.getRow().acceptChanges();
                r.c = 10;     //this causes the row to be in "modified" state
                let filter = BusinessLogic.prototype.filterParameters(r.getRow(), true);
                expect(filter).toBeDefined();
                let expected = q.and(q.eq("tablename", "toWrite"),
                    q.eq("opkind", "U"),
                    q.eq("isprecheck", "N"));
                expect(filter.toString()).toBe(expected.toString());
            });
        });


        describe('isTempAutoIncrement', function () {
            it("should give true on auto increment column if state is added", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);

                let resIdCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomer1.getRow(), "idcustomer");
                expect(resIdCustomer).toBe(true);

                let resDataCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomer1.getRow(), "data_customer");
                expect(resDataCustomer).toBe(false);

            });

            it("should give true on autoincrement detail column if state is added", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);

                let resIdCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomerPhone.getRow(), "idcustomerphone");
                expect(resIdCustomer).toBe(true);

            });

            it("should give true on auto increment column if state is unchanged or modified", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);

                rCustomer1.getRow().acceptChanges();
                let resIdCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomer1.getRow(), "idcustomer");
                expect(resIdCustomer).toBe(false);

                let resDataCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomer1.getRow(), "data_customer");
                expect(resDataCustomer).toBe(false);

                rCustomer1.data_customer = 41;
                expect(rCustomer1.getRow().state).toBe(DataRowState.modified);

                resIdCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomer1.getRow(), "idcustomer");
                expect(resIdCustomer).toBe(false);

                resDataCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomer1.getRow(), "data_customer");
                expect(resDataCustomer).toBe(false);

            });

            it("should give true on parent autoincrement column if parent state is added", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);

                let resIdCustomer = BusinessLogic.prototype.isTempAutoIncrement(rCustomerPhone.getRow(), "idcustomer");
                expect(resIdCustomer).toBe(true);

                let resDataCustomerPhone = BusinessLogic.prototype.isTempAutoIncrement(rCustomerPhone.getRow(), "data_customerphone");
                expect(resDataCustomerPhone).toBe(false);

            });

            it("should give false on parent autoincrement column if parent state is unchanged", function () {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                rCustomer2.getRow().acceptChanges();

                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);

                let resIdCustomerPhone = BusinessLogic.prototype.isTempAutoIncrement(rCustomerPhone.getRow(), "idcustomer");
                expect(resIdCustomerPhone).toBe(false);
            });


        });


        describe("parametersFor", function () {
            it("should evaluate an array of parameters", function (done) {
                let /*DataSet*/ auditDs = BusinessLogic.prototype.createAuditDataSet();
                let tableOp = auditDs.tables["tableop"];
                tableOp.newRow({tablename: 'tab1', opkind: 'I'});
                tableOp.newRow({tablename: 'tab2', opkind: 'U'});

                let /*DataTable*/ auditParameter = auditDs.tables["auditparameter"];
                auditParameter.newRow({
                    tablename: 'tab1',
                    parameterid: 1,
                    paramtable: 'tab1',
                    paramcolumn: 'col1',
                    flagoldvalue: 'S',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'tab1',
                    parameterid: 2,
                    paramtable: 'tab1',
                    paramcolumn: 'col2',
                    flagoldvalue: 'S',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'tab1',
                    parameterid: 4,
                    paramtable: 'tab1',
                    paramcolumn: 'col4',
                    flagoldvalue: 'S',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'tab1',
                    parameterid: 3,
                    paramtable: 'tab1',
                    paramcolumn: 'col3',
                    flagoldvalue: 'N',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'tab1',
                    parameterid: 5,
                    paramtable: 'sys',
                    paramcolumn: 'var1',
                    flagoldvalue: 'N',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'tab1',
                    parameterid: 6,
                    paramtable: 'usr',
                    paramcolumn: 'var2',
                    flagoldvalue: 'N',
                    opkind: "I",
                    isprecheck: "S"
                });

                let /*DataTable*/ auditCheckView = auditDs.tables["auditcheckview"];
                auditCheckView.newRow({idaudit: 'audit00', idcheck: 1, severity: 'E', message: 'Error'});

                let ds = new DataSet();
                let t1 = ds.newTable("tab1");
                t1.columns.col1 = new DataColumn("col1", "int");
                t1.columns.col2 = new DataColumn("col2", "int");
                t1.columns.col3 = new DataColumn("col3", "int");
                t1.columns.col4 = new DataColumn("col3", "int");

                let r = t1.newRow({col1: "column 1", col2: "column 2", col4: "column 4", col3: 33});
                context.environment.sys("var1", "valueVar1");
                context.environment.usr("var2", "valueVar2");

                let /*ObjectRow[]*/ checks = auditCheckView.select();
                let rc = new RowChange(10, r.getRow(), checks, '@tab1_col1', 'col1');

                let BL = new BusinessLogic(context, [r]);
                let params = BL.parametersFor(auditParameter, rc, false);
                expect(params).toBeDefined();
                expect(params.constructor).toBe(Array);
                expect(params.find(p => p.name === "@var1" && p.value === "valueVar1")).toBeDefined();
                expect(params.find(p => p.name === "@var1" && p.value === "valueVar2")).not.toBeDefined(); //to be sure
                expect(params.find(p => p.name === "@OLD_col1" && p.value === "column 1")).toBeDefined(); //to be sure
                expect(params.find(p => p.name === "@OLD_col2" && p.value === "column 2")).toBeDefined(); //to be sure
                expect(params.find(p => p.name === "@NEW_col3" && p.value === 33)).toBeDefined(); //to be sure
                expect(params.find(p => p.name === "@usr_var2" && p.value === "valueVar2")).toBeDefined(); //to be sure
                BL.destroy().always(()=>{
                    done();
                });
            });

            it("should not append autoincrement columns as parameters if state added", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({
                    idcustomer: 2,
                    col1: "column 1", col2: "column 2", col4: "column 4", col3: 33
                });
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);

                let /*DataSet*/ auditDs = BusinessLogic.prototype.createAuditDataSet();
                let tableOp = auditDs.tables["tableop"];
                tableOp.newRow({tablename: 'customer', opkind: 'I'});

                let /*DataTable*/ auditParameter = auditDs.tables["auditparameter"];
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 1,
                    paramtable: 'customer',
                    paramcolumn: 'col1',
                    flagoldvalue: 'S',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 2,
                    paramtable: 'customer',
                    paramcolumn: 'col2',
                    flagoldvalue: 'S',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 3,
                    paramtable: 'customer',
                    paramcolumn: 'col3',
                    flagoldvalue: 'N',
                    opkind: "I",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 3,
                    paramtable: 'customer',
                    paramcolumn: 'idcustomer',
                    flagoldvalue: 'N',
                    opkind: "I",
                    isprecheck: "S"
                });

                let /*DataTable*/ auditCheckView = auditDs.tables["auditcheckview"];
                auditCheckView.newRow({idaudit: 'audit00', idcheck: 1, severity: 'E', message: 'Error'});

                let /*ObjectRow[]*/ checks = auditCheckView.select();
                let rc = new RowChange(10, rCustomer2.getRow(), checks, '@tab1_col1', 'col1');

                let BL = new BusinessLogic(context, [rCustomer2]);
                let params = BL.parametersFor(auditParameter, rc, false);
                expect(params).toBeDefined();
                expect(params.constructor).toBe(Array);
                expect(params.find(p => p.name === "@OLD_col1" && p.value === "column 1")).toBeDefined();
                expect(params.find(p => p.name === "@OLD_col2" && p.value === "column 2")).toBeDefined();
                expect(params.find(p => p.name === "@NEW_col3" && p.value === 33)).toBeDefined();
                expect(params.find(p => p.name === "@NEW_idcustomer")).toBeUndefined();
                BL.destroy().always(()=>{done();});
            });

            it("should  append autoincrement columns as parameters if state not added", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({
                    idcustomer: 2,
                    col1: "column 1", col2: "column 2", col4: "column 4", col3: 33
                });
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                rCustomer2.getRow().acceptChanges();
                rCustomer2.col33 = "column 3"; //to change rCustomer2 state to modified

                let /*DataSet*/ auditDs = BusinessLogic.prototype.createAuditDataSet();
                let tableOp = auditDs.tables["tableop"];
                tableOp.newRow({tablename: 'customer', opkind: 'U'});

                let /*DataTable*/ auditParameter = auditDs.tables["auditparameter"];
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 1,
                    paramtable: 'customer',
                    paramcolumn: 'col1',
                    flagoldvalue: 'S',
                    opkind: "U",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 2,
                    paramtable: 'customer',
                    paramcolumn: 'col2',
                    flagoldvalue: 'S',
                    opkind: "U",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 3,
                    paramtable: 'customer',
                    paramcolumn: 'col3',
                    flagoldvalue: 'N',
                    opkind: "U",
                    isprecheck: "S"
                });
                auditParameter.newRow({
                    tablename: 'customer',
                    parameterid: 3,
                    paramtable: 'customer',
                    paramcolumn: 'idcustomer',
                    flagoldvalue: 'N',
                    opkind: "U",
                    isprecheck: "S"
                });

                let /*DataTable*/ auditCheckView = auditDs.tables["auditcheckview"];
                auditCheckView.newRow({
                    tablename: 'customer',
                    opkind: 'U',
                    idaudit: 'audit00',
                    idcheck: 1,
                    severity: 'E',
                    message: 'Error'
                });

                let /*ObjectRow[]*/ checks = auditCheckView.select();
                let rc = new RowChange(10, rCustomer2.getRow(), checks, '@tab1_col1', 'col1');

                let BL = new BusinessLogic(context, [rCustomer2]);
                let params = BL.parametersFor(auditParameter, rc, false);
                expect(params).toBeDefined();
                expect(params.constructor).toBe(Array);
                expect(params.find(p => p.name === "@OLD_col1" && p.value === "column 1")).toBeDefined();
                expect(params.find(p => p.name === "@OLD_col2" && p.value === "column 2")).toBeDefined();
                expect(params.find(p => p.name === "@NEW_col3" && p.value === 33)).toBeDefined();
                expect(params.find(p => p.name === "@NEW_idcustomer" && p.value === 2)).toBeDefined();
                BL.destroy().always(()=>{done();});

            });
        });


        describe("ruleFilter", function () {
            it("should be taken from environment", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                let dsRules;
                spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                    const def = Deferred().resolve();
                    dsRules = ds;
                    return def.promise();
                });
                context.environment.sys("filterrule", q.eq("cash", 1));

                let BL = new BusinessLogic(context, [rCustomer1, rCustomer2, rCustomerPhone]);
                expect(BL.ruleFilter).toBe(context.environment.sys["filterrule"]);
                BL.destroy().always(()=>{done();});
            });
        });


        describe("getQuery", function () {

            it("should give key columns", function () {
                let t1 = new dsNameSpace.DataTable("table1");
                t1.setDataColumn("k1", CType.string);
                t1.setDataColumn("k2", CType.int);
                t1.setDataColumn("d1", CType.int);
                t1.key("k1", "k2");
                let t2 = new dsNameSpace.DataTable("table2");
                t2.setDataColumn("k1", CType.string);
                t2.setDataColumn("k2", CType.int);
                t2.setDataColumn("d1", CType.int);
                t2.key("k1", "k2");
                let r = t1.newRow({k1: 1, k2: 2, d1: 'dd'}).getRow();
                let cols = [];
                let query = BusinessLogic.prototype.getQuery(t1, r, t2, cols);

                expect(cols.length).toBe(2);
                expect(cols.indexOf("k1")).toBe(0);
                expect(cols.indexOf("k2")).toBe(1);
                expect(cols.indexOf("d1")).toBe(-1);
                expect(query.toString()).toBe("k1==1 AND k2==2");

            });

            it("should give key columns basing on source table", function () {
                let t1 = new dsNameSpace.DataTable("table1");
                t1.setDataColumn("k1", CType.string);
                t1.setDataColumn("k2", CType.int);
                t1.setDataColumn("d1", CType.int);
                t1.key("k1", "k2");
                let t2 = new dsNameSpace.DataTable("table2");
                t2.setDataColumn("k1", CType.string);
                t2.setDataColumn("k2", CType.int);
                t2.setDataColumn("d1", CType.int);
                //t2.key("k1","k2");
                let r = t1.newRow({k1: 1, k2: 2, d1: 'dd'}).getRow();
                let cols = [];
                let query = BusinessLogic.prototype.getQuery(t1, r, t2, cols);

                expect(cols.length).toBe(2);
                expect(cols.indexOf("k1")).toBe(0);
                expect(cols.indexOf("k2")).toBe(1);
                expect(cols.indexOf("d1")).toBe(-1);
                expect(query.toString()).toBe("k1==1 AND k2==2");

            });

            it("should give key columns basing on source table, skipping not existing columns", function () {
                let t1 = new dsNameSpace.DataTable("table1");
                t1.setDataColumn("k1", CType.string);
                t1.setDataColumn("k2", CType.int);
                t1.setDataColumn("d1", CType.int);
                t1.key("k1", "k2");
                let t2 = new dsNameSpace.DataTable("table2");
                t2.setDataColumn("k0", CType.string);
                t2.setDataColumn("k2", CType.int);
                t2.setDataColumn("d1", CType.int);
                //t2.key("k1","k2");
                let r = t1.newRow({k0: 1, k2: 2, d1: 'dd'}).getRow();
                let cols = [];
                let query = BusinessLogic.prototype.getQuery(t1, r, t2, cols);

                expect(cols.length).toBe(1);
                expect(cols.indexOf("k1")).toBe(-1);
                expect(cols.indexOf("k2")).toBe(0);
                expect(cols.indexOf("d1")).toBe(-1);
                expect(query.toString()).toBe("k2==2");

            });

            it("should give key columns basing on source table,adding ayear if it is present", function () {
                let t1 = new dsNameSpace.DataTable("table1");
                t1.setDataColumn("k1", CType.string);
                t1.setDataColumn("k2", CType.int);
                t1.setDataColumn("d1", CType.int);
                t1.key("k1", "k2");
                let t2 = new dsNameSpace.DataTable("table2");
                t2.setDataColumn("k0", CType.string);
                t2.setDataColumn("k2", CType.int);
                t2.setDataColumn("d1", CType.int);
                t2.setDataColumn("ayear", CType.int);
                //t2.key("k1","k2");
                let r = t1.newRow({k0: 1, k2: 2, d1: 'dd'}).getRow();
                context.environment.field("ayear", 3000);
                let cols = [];
                BusinessLogic.prototype.environment = context.environment;

                let query = BusinessLogic.prototype.getQuery(t1, r, t2, cols);

                expect(cols.length).toBe(2);
                expect(cols.indexOf("k1")).toBe(-1);
                expect(cols.indexOf("k2")).toBeGreaterThan(-1);
                expect(cols.indexOf("ayear")).toBe(1);
                expect(cols.indexOf("d1")).toBe(-1);
                expect(query.toString()).toContain("ayear==3000");
                expect(query.toString()).toContain("k2==2");
            });


        });

        describe("refineMessages", function () {
            /*BusinessMessage[]*/
            let bm = [];
            let changes = [];
            let mainDataSet;
            beforeEach(function () {
                let ds = dsProvider("customerphone");
                mainDataSet = ds;
                let tCustomer = ds.tables["customer"];
                let tCustomerView = ds.tables["customerview"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow();
                let rCustomer2 = tCustomer.newRow();
                rCustomer1.idcustomer = 29;
                rCustomer2.idcustomer = 30;

                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                rCustomerPhone.idphone = 12;
                let rc1 = new RowChange(0, rCustomer1.getRow(), [], 'var1', 'a');
                let rc2 = new RowChange(0, rCustomer2.getRow(), [], 'var2', 'b');
                let rcp1 = new RowChange(0, rCustomerPhone.getRow(), [], 'var3', 'c');
                changes = [rCustomer1, rCustomer2, rCustomerPhone];

                bm = [];
                bm.push(new BusinessMessage({
                    rowChange: rc1,
                    shortMsg: "Error",
                    longMsg: "Text about %<customer.age>% and other things",
                    canIgnore: false
                }));
                bm.push(new BusinessMessage({
                    rowChange: rc2,
                    shortMsg: "Error",
                    longMsg: "Text about %<customer.surname>% and other things",
                    canIgnore: false
                }));
                bm.push(new BusinessMessage({
                    rowChange: rcp1,
                    shortMsg: "Error",
                    longMsg: "Text about %<customerphone.phonekind>% and other things",
                    canIgnore: false
                }));

                bm.push(new BusinessMessage({
                    rowChange: rc1,
                    shortMsg: "Error",
                    longMsg: "Text about %<customerview.customerkind>% and other things",
                    canIgnore: false
                }));

                bm.push(new BusinessMessage({
                    rowChange: rc1,
                    shortMsg: "Error",
                    longMsg: "Text about %<customer.age>% and other things, except for %<customer.surname>%",
                    canIgnore: false
                }));


            });


            describe("evaluateQueries", function () {
                it("should  set queries and columns for table having a key", function (done) {
                    let ds = new DataSet("temp");
                    expect(context).toBeDefined();
                    let BL = new BusinessLogic(context, changes);

                    BL.refineMessages_evaluateQueries(ds, bm)
                        .then(function () {
                            expect(bm[0].openSubstitutions[0].query).toBeDefined();
                            expect(bm[1].openSubstitutions[0].query).toBeDefined();
                            expect(bm[2].openSubstitutions[0].query).toBeDefined();

                            expect(bm[0].openSubstitutions[0].queryCols.size).toBe(1);
                            expect(bm[1].openSubstitutions[0].queryCols.size).toBe(1);
                            expect(bm[2].openSubstitutions[0].queryCols.size).toBe(2);

                            expect(bm[0].openSubstitutions[0].queryCols.has("idcustomer")).toBeTruthy();
                            expect(bm[0].openSubstitutions[0].queryCols.has("idphone")).toBeFalsy();
                            expect(bm[0].openSubstitutions[0].queryString).toBe("idcustomer==29");

                            expect(bm[1].openSubstitutions[0].queryCols.has("idcustomer")).toBeTruthy();
                            expect(bm[1].openSubstitutions[0].queryCols.has("idphone")).toBeFalsy();
                            expect(bm[1].openSubstitutions[0].queryString).toBe("idcustomer==30");

                            expect(bm[2].openSubstitutions[0].queryCols.has("idcustomer")).toBeTruthy();
                            expect(bm[2].openSubstitutions[0].queryCols.has("idphone")).toBeTruthy();
                            expect(bm[2].openSubstitutions[0].queryString).toBe("idcustomer==30 AND idphone==12");


                            BL.destroy().always(()=>{done();});
                        })
                        .catch(function (err) {
                            console.log("error");
                            console.log(err);
                            expect(err).toBeUndefined();
                            BL.destroy().always(()=>{done();});
                        });

                });


                it("should  set queries and columns for views without a key", async function () {
                    let ds = new DataSet("temp");
                    expect(context).toBeDefined();
                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);

                    try {
                        await BL.refineMessages_evaluateQueries(ds, bm);

                        expect(bm[3].openSubstitutions[0].query).toBeDefined();
                        expect(bm[3].openSubstitutions[0].queryCols.size).toBe(1);

                        expect(bm[3].openSubstitutions[0].queryCols.has("idcustomer")).toBeTruthy();
                        expect(bm[3].openSubstitutions[0].queryString).toBe("idcustomer==29");


                    } catch (err) {
                        console.log("error");
                        console.log(err);
                        expect(err).toBeUndefined();

                    }
                    await BL.destroy();

                });

                it("should  set error if key column does not exist", function (done) {
                    let ds = new DataSet("temp");
                    expect(context).toBeDefined();

                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);
                    context.dbDescriptor.table("customerview")
                        .then(function (descrView) {
                            //remove idcustomer from table structure, mimicking it does not exists
                            let colIndex = descrView.columns.findIndex(c => c.name === "idcustomer");
                            descrView.columns.splice(colIndex, 1);
                        })
                        .then(() => {
                            let def = Deferred();
                            //console.log("refineMessages_evaluateQueries called");
                            BL.refineMessages_evaluateQueries(ds, bm).then(x => def.resolve(x));
                            return def;
                        })
                        .then(function (result) {
                            //console.log(result);
                            //console.log(bm[3].openSubstitutions[0]);
                            //console.log("refineMessages_evaluateQueries fullfilled");
                            expect(bm[3].openSubstitutions[0].error).toBe(true);
                            expect(bm[3].openSubstitutions[0].query).toBeNull();
                            expect(bm[3].openSubstitutions[0].queryCols.size).toBe(0);

                            BL.destroy().always(()=>{done();});
                        })
                        .fail(function (err) {
                            console.log("error");
                            console.log(err);
                            expect(err).toBeUndefined();
                            BL.destroy().always(()=>{done();});
                        });


                });

                it("should  set error if message column does not exist", function (done) {
                    let ds = new DataSet("temp");
                    expect(context).toBeDefined();
                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);
                    context.dbDescriptor.table("customerview")
                        .then(function (descrView) {
                            //remove customerkind from table structure, mimicking it does not exists
                            let colIndex = descrView.columns.findIndex(c => c.name === "customerkind");
                            descrView.columns.splice(colIndex, 1);
                        })
                        .then(() => {
                            let def = Deferred();
                            //console.log("refineMessages_evaluateQueries called");
                            BL.refineMessages_evaluateQueries(ds, bm).then(x => def.resolve(x));
                            return def;
                        })
                        .then(function (result) {
                            //console.log(result);
                            //console.log(bm[3].openSubstitutions[0]);
                            //console.log("refineMessages_evaluateQueries fullfilled");
                            expect(bm[3].openSubstitutions[0].error).toBe(true);
                            expect(bm[3].openSubstitutions[0].query).toBeNull();
                            expect(bm[3].openSubstitutions[0].queryCols.size).toBe(0);

                            BL.destroy().then(()=>{done();});
                        })
                        .fail(function (err) {
                            console.log("error");
                            console.log(err);
                            expect(err).toBeUndefined();
                            BL.destroy().always(()=>{done();});
                        });

                });

            });


            describe("groupQueries", function () {
                it("should group subst basing on table names", async function () {
                    let ds = new DataSet("temp");

                    expect(context).toBeDefined();

                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);

                    let sub1 = new OneSubst("age", "customer", "%<customer.age>%", "customer");
                    sub1.setQuery(q.eq("idcustomer", "value1"));
                    sub1.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub1);
                    let sub2 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub2.setQuery(q.eq("idcustomer", "value2"));
                    sub2.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub2);
                    let sub3 = new OneSubst("phonekind", "customerphone", "%<customerphone.phonekind>%", "customerphone");
                    sub3.setQuery(q.and(q.eq("idcustomer", "value4"), q.eq("idphone", "value3")));
                    sub3.queryCols.add("idcustomer");
                    sub3.queryCols.add("idphone");
                    bm[2].openSubstitutions.push(sub3);
                    let sub4 = new OneSubst("customerkind", "customerview", "%<customerview.customerkind>%", "customerphone");
                    sub4.setQuery(q.eq("idcustomer", "value5"));
                    sub4.queryCols.add("idcustomer");
                    bm[3].openSubstitutions.push(sub4);
                    let groups = await BL.refineMessages_groupQueries(bm);

                    expect(groups.length).toBe(3);
                    expect(groups[0].tableName).toBe("customer");
                    expect(groups[0].querySet.has("idcustomer==value1")).toBe(true);
                    expect(groups[0].querySet.has("idcustomer==value2")).toBe(true);
                    expect(groups[0].queryCols.has("idcustomer")).toBe(true);

                    expect(groups[1].tableName).toBe("customerphone");
                    expect(groups[1].querySet.has("idcustomer==value4 AND idphone==value3")).toBe(true);
                    expect(groups[1].queryCols.has("idcustomer")).toBe(true);
                    expect(groups[1].queryCols.has("idphone")).toBe(true);


                    expect(groups[2].tableName).toBe("customerview");
                    expect(groups[2].querySet.has("idcustomer==value5")).toBe(true);
                    expect(groups[2].queryCols.has("idcustomer")).toBe(true);

                    await BL.destroy();
                });


                it("should not merge over queryLimit chars (case one clause only)", async function () {
                    let ds = new DataSet("temp");
                    expect(context).toBeDefined();

                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);

                    let sub1 = new OneSubst("age", "customer", "%<customer.age>%", "customer");
                    sub1.setQuery(q.eq("idcustomer", "value1"));
                    sub1.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub1);
                    let sub2 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub2.setQuery(q.eq("idcustomer", "value2"));
                    sub2.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub2);
                    let sub3 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub3.setQuery(q.eq("idcustomer", "value3"));
                    sub3.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub3);

                    let groups = await BL.refineMessages_groupQueries(bm, 10);
                    expect(groups.length).toBe(3);
                    expect(groups[0].tableName).toBe("customer");
                    expect(groups[0].querySet.has("idcustomer==value1")).toBe(true);
                    expect(groups[0].queryCols.has("idcustomer")).toBe(true);

                    expect(groups[1].tableName).toBe("customer");
                    expect(groups[1].querySet.has("idcustomer==value2")).toBe(true);
                    expect(groups[1].queryCols.has("idcustomer")).toBe(true);


                    expect(groups[2].tableName).toBe("customer");
                    expect(groups[2].querySet.has("idcustomer==value3")).toBe(true);
                    expect(groups[2].queryCols.has("idcustomer")).toBe(true);

                    await BL.destroy();
                });

                it("should not merge over queryLimit chars (case multiple clauses)", async function () {
                    let ds = new DataSet("temp");
                    expect(context).toBeDefined();

                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);

                    let sub1 = new OneSubst("age", "customer", "%<customer.age>%", "customer");
                    sub1.setQuery(q.eq("idcustomer", "value1"));
                    sub1.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub1);
                    let sub2 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub2.setQuery(q.eq("idcustomer", "value2"));
                    sub2.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub2);
                    let sub3 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub3.setQuery(q.eq("idcustomer", "value3"));
                    sub3.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub3);
                    let sub4 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub4.setQuery(q.eq("idcustomer", "value4"));
                    sub4.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub4);
                    let sub5 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub5.setQuery(q.eq("idcustomer", "value5"));
                    sub5.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub5);

                    let groups = await BL.refineMessages_groupQueries(bm, 48);
                    expect(groups.length).toBe(2);
                    expect(groups[0].tableName).toBe("customer");
                    expect(groups[0].querySet.has("idcustomer==value1")).toBe(true);
                    expect(groups[0].querySet.has("idcustomer==value2")).toBe(true);
                    expect(groups[0].querySet.has("idcustomer==value3")).toBe(true);
                    expect(groups[0].queryCols.has("idcustomer")).toBe(true);

                    expect(groups[1].tableName).toBe("customer");
                    expect(groups[1].queryCols.has("idcustomer")).toBe(true);
                    expect(groups[1].querySet.has("idcustomer==value4")).toBe(true);
                    expect(groups[1].querySet.has("idcustomer==value5")).toBe(true);
                    try {
                        await BL.destroy();
                    }
                    catch (e){
                        expect(1).toBe(0);
                        console.log(e);
                    }

                });

            });


            describe("executeQueries", function () {
                it("should invoke dataAccess.select for every group (same table)", async function () {
                    let ds = new DataSet("temp");
                    expect(context).toBeDefined();
                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);

                    let sub1 = new OneSubst("age", "customer", "%<customer.age>%", "customer");
                    sub1.setQuery(q.eq("idcustomer", "value1"));
                    sub1.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub1);
                    let sub2 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub2.setQuery(q.eq("idcustomer", "value2"));
                    sub2.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub2);
                    let sub3 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub3.setQuery(q.eq("idcustomer", "value3"));
                    sub3.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub3);
                    let sub4 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub4.setQuery(q.eq("idcustomer", "value4"));
                    sub4.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub4);
                    let sub5 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub5.setQuery(q.eq("idcustomer", "value5"));
                    sub5.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub5);

                    let groups = await BL.refineMessages_groupQueries(bm, 48);

                    //console.log(bm);
                    let selectParams = [];
                    spyOn(BL.context.dataAccess, 'select').and.callFake(function (p) {
                        const def = Deferred();
                        setTimeout(() => {
                            def.resolve();
                        }, 10);
                        selectParams.push(p);
                        return def.promise();
                    });


                    expect(groups.length).toBe(2);

                    groups = await BL.refineMessages_executeQueries(groups);

                    //console.log(selectParams);
                    expect(selectParams.length).toBe(2);

                    expect(selectParams[0].tableName).toBe("customer");
                    expect(selectParams[0].filter.toString()).toBe("idcustomer==value1 OR idcustomer==value2 OR idcustomer==value3");
                    expect(selectParams[0].columns).toBe("idcustomer,age,surname");

                    expect(selectParams[1].tableName).toBe("customer");
                    expect(selectParams[1].filter.toString()).toBe("idcustomer==value4 OR idcustomer==value5");
                    expect(selectParams[1].columns).toBe("idcustomer,surname");

                    await BL.destroy();
                });

                it("should invoke dataAccess.select for every group (two tables )", async function () {
                    let ds = new DataSet("temp");

                    expect(context).toBeDefined();

                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });


                    let BL = new BusinessLogic(context, changes);

                    let sub1 = new OneSubst("age", "customer", "%<customer.age>%", "customer");
                    sub1.setQuery(q.eq("idcustomer", "value1"));
                    sub1.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub1);
                    let sub2 = new OneSubst("surname", "customer", "%<customer.surname>%", "customer");
                    sub2.setQuery(q.eq("idcustomer", "value2"));
                    sub2.queryCols.add("idcustomer");
                    bm[0].openSubstitutions.push(sub2);
                    let sub3 = new OneSubst("phonekind", "customerphone", "%<customerphone.phonekind>%", "customerphone");
                    sub3.setQuery(q.and(q.eq("idcustomer", "value4"), q.eq("idphone", "value3")));
                    sub3.queryCols.add("idcustomer");
                    sub3.queryCols.add("idphone");
                    bm[2].openSubstitutions.push(sub3);
                    let sub4 = new OneSubst("customerkind", "customerview", "%<customerview.customerkind>%", "customerphone");
                    sub4.setQuery(q.eq("idcustomer", "value5"));
                    sub4.queryCols.add("idcustomer");
                    bm[3].openSubstitutions.push(sub4);

                    let groups = await BL.refineMessages_groupQueries(bm);

                    //console.log(bm);
                    let selectParams = [];
                    spyOn(BL.context.dataAccess, 'select').and.callFake(function (p) {
                        const def = Deferred();
                        setTimeout(() => {
                            def.resolve();
                        }, 10);
                        selectParams.push(p);
                        return def.promise();
                    });


                    expect(groups.length).toBe(3);

                    groups = await BL.refineMessages_executeQueries(groups);

                    expect(selectParams.length).toBe(3);

                    expect(selectParams[0].tableName).toBe("customer");
                    expect(selectParams[0].filter.toString()).toBe("idcustomer==value1 OR idcustomer==value2");
                    expect(selectParams[0].columns).toBe("idcustomer,age,surname");

                    expect(selectParams[1].tableName).toBe("customerphone");
                    expect(selectParams[1].filter.toString()).toBe("idcustomer==value4 AND idphone==value3");
                    expect(selectParams[1].columns).toBe("idcustomer,idphone,phonekind");

                    expect(selectParams[2].tableName).toBe("customerview");
                    expect(selectParams[2].filter.toString()).toBe("idcustomer==value5");
                    expect(selectParams[2].columns).toBe("idcustomer,customerkind");

                    await BL.destroy();
                });
            });


            describe("applySubstitutions", function () {

                it("should replace placeholders with values obtained from db", async function () {
                    let ds = new DataSet("temp");

                    expect(context).toBeDefined();

                    let dsRules;
                    spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(function (context, ds) {
                        const def = Deferred().resolve();
                        dsRules = ds;
                        return def.promise();
                    });

                    let BL = new BusinessLogic(context, changes);


                    bm[0].openSubstitutions[0].setQuery(q.eq("idcustomer", "value1"));
                    bm[0].openSubstitutions[0].queryCols.add("idcustomer");

                    bm[1].openSubstitutions[0].setQuery(q.eq("idcustomer", "value2"));
                    bm[1].openSubstitutions[0].queryCols.add("idcustomer");

                    bm[2].openSubstitutions[0].setQuery(q.and(q.eq("idcustomer", "value1"), q.eq("idphone", 3)));
                    bm[2].openSubstitutions[0].queryCols.add("idcustomer");
                    bm[2].openSubstitutions[0].queryCols.add("idphone");

                    bm[3].openSubstitutions[0].setQuery(q.eq("idcustomer", "value5"));
                    bm[3].openSubstitutions[0].queryCols.add("idcustomer");

                    bm[4].openSubstitutions[0].setQuery(q.eq("idcustomer", "value1"));
                    bm[4].openSubstitutions[0].queryCols.add("idcustomer");
                    bm[4].openSubstitutions[1].setQuery(q.eq("idcustomer", "value1"));
                    bm[4].openSubstitutions[1].queryCols.add("idcustomer");

                    let groups = await BL.refineMessages_groupQueries(bm);

                    expect(groups.length).toBe(3);

                    //simulate data read from db
                    let dCustomer = [];
                    dCustomer.tableName = "customer";
                    dCustomer.push({idcustomer: "value1", age: 20, surname: "Red"});
                    dCustomer.push({idcustomer: "value2", age: 30, surname: "Black"});
                    dCustomer.push({idcustomer: "value3", age: 40, surname: "Green"});
                    dCustomer.push({idcustomer: "value4", age: 50, surname: "Pink"});
                    dCustomer.push({idcustomer: "value5", age: 60, surname: "White"});
                    groups[0].data = dCustomer;


                    let dCustomerPhone = [];
                    dCustomerPhone.tableName = "customerphone";
                    dCustomerPhone.push({idcustomer: "value1", idphone: 1, phonekind: "Mobile"});
                    dCustomerPhone.push({idcustomer: "value2", idphone: 2, phonekind: "Fixed"});
                    dCustomerPhone.push({idcustomer: "value1", idphone: 3, phonekind: "Small"});
                    dCustomerPhone.push({idcustomer: "value4", idphone: 3, phonekind: "Smart"});
                    groups[1].data = dCustomerPhone;

                    let dCustomerView = [];
                    dCustomerView.tableName = "customerview";
                    dCustomerView.push({idcustomer: "value1", idphone: 1, customerkind: "new"});
                    dCustomerView.push({idcustomer: "value2", idphone: 2, customerkind: "old"});
                    dCustomerView.push({idcustomer: "value5", idphone: 3, customerkind: "plain"});
                    groups[2].data = dCustomerView;

                    BL.refineMessages_applySubstitutions(groups, bm);
                    expect(bm[0].msg).toBe("Text about 20 and other things");   //(q.eq("idcustomer","value1")
                    expect(bm[1].msg).toBe("Text about Black and other things"); //q.eq("idcustomer","value2")
                    expect(bm[2].msg).toBe("Text about Small and other things"); //q.and(q.eq("idcustomer","value1"),q.eq("idphone",3))
                    expect(bm[3].msg).toBe("Text about plain and other things"); //q.eq("idcustomer","value5")
                    expect(bm[4].msg).toBe("Text about 20 and other things, except for Red"); //(q.eq("idcustomer","value1")

                    await BL.destroy();
                });


            });
        });

        describe("groupChecks", function () {
            it("should sort auditcheck by idaudit asc, idcheck asc and separate them by sp name", function () {
                let t1 = new DataTable("tab1");
                let t1r1 = t1.newRow({a: 2});
                let t1r2 = t1.newRow({a: 3});
                t1r2.$acceptChanges();
                t1r2.a = 33;
                let t2 = new DataTable("tab2");
                let t2r1 = t2.newRow({a: 4});
                let t2r2 = t2.newRow({a: 5});
                t2r2.$acceptChanges();
                t2r2.$del();
                let view = new DataTable("auditcheckview");
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab2",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab3",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab3",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 3,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a03",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 4,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });

                let checks = BusinessLogic.prototype.groupChecks(view, [t1r1, t1r2, t2r1, t2r2], true);

                expect(checks["check_tab1_i_post"]).toBeDefined();
                expect(checks["check_tab1_i_post"].length).toBe(8);
                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a01').length).toBe(4);
                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a00').length).toBe(1);
                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a02').length).toBe(2);
                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a03').length).toBe(1);

                let idx_a00 = checks["check_tab1_i_post"].findIndex(x => x.idaudit === 'a00');
                let idx_a01 = checks["check_tab1_i_post"].findIndex(x => x.idaudit === 'a01');
                let idx_a02 = checks["check_tab1_i_post"].findIndex(x => x.idaudit === 'a02');
                let idx_a03 = checks["check_tab1_i_post"].findIndex(x => x.idaudit === 'a03');
                expect(idx_a00).toBeLessThan(idx_a01);
                expect(idx_a01).toBeLessThan(idx_a02);
                expect(idx_a02).toBeLessThan(idx_a03);

                let idx_a01_03 = checks["check_tab1_i_post"].findIndex(x => x.idaudit === 'a01' && x.idcheck === 3);
                let idx_a01_04 = checks["check_tab1_i_post"].findIndex(x => x.idaudit === 'a01' && x.idcheck === 4);
                expect(idx_a01_03).toBeLessThan(idx_a01_04);

            });


            it("should filter operation by opkind", function () {
                let t1 = new DataTable("tab1");
                let t1r1 = t1.newRow({a: 2});
                let t1r2 = t1.newRow({a: 3});
                t1r2.$acceptChanges();
                t1r2.a = 33;
                let t1r3 = t1.newRow({a: 30});
                t1r3.$acceptChanges();
                t1r3.$del();

                let t2 = new DataTable("tab2");
                let t2r1 = t2.newRow({a: 4});
                let t2r2 = t2.newRow({a: 5});
                t2r2.$acceptChanges();
                t2r2.$del();


                let t3 = new DataTable("tab3");
                let t3r1 = t3.newRow({a: 6});

                let t3r2 = t3.newRow({a: 7});
                t3r2.$acceptChanges();
                t3r2.$del();

                let view = new DataTable("auditcheckview");
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "D",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab2",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "U",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab3",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab3",
                    opkind: "D",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 3,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a03",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "U",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 4,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });

                let checks = BusinessLogic.prototype.groupChecks(view, [t1r1, t1r2, t2r1, t2r2, t1r3, t3r1, t3r2], true);

                expect(checks["check_tab1_i_post"]).toBeDefined();
                expect(checks["check_tab1_i_post"].length).toBe(5);
                expect(checks["check_tab1_d_post"].length).toBe(1);
                expect(checks["check_tab1_u_post"].length).toBe(2);

                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a01').length).toBe(3);
                expect(checks["check_tab1_d_post"].filter(x => x.idaudit === 'a00').length).toBe(1);
                expect(checks["check_tab1_u_post"].filter(x => x.idaudit === 'a03').length).toBe(1);
                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a02').length).toBe(2);
                expect(checks["check_tab3_i_post"].filter(x => x.idaudit === 'a01').length).toBe(1);
                expect(checks["check_tab3_d_post"].filter(x => x.idaudit === 'a02').length).toBe(1);

            });


            it("should skip ignorable audits and  audits without sql ", function () {
                let t1 = new DataTable("tab1");
                let t1r1 = t1.newRow({a: 2});
                let t1r2 = t1.newRow({a: 3});
                t1r2.$acceptChanges();
                t1r2.a = 33;
                let t1r3 = t1.newRow({a: 30});
                t1r3.$acceptChanges();
                t1r3.$del();

                let t2 = new DataTable("tab2");
                let t2r1 = t2.newRow({a: 4});
                let t2r2 = t2.newRow({a: 5});
                t2r2.$acceptChanges();
                t2r2.$del();


                let t3 = new DataTable("tab3");
                let t3r1 = t3.newRow({a: 6});

                let t3r2 = t3.newRow({a: 7});
                t3r2.$acceptChanges();
                t3r2.$del();

                let view = new DataTable("auditcheckview");
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'I',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "D",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'I',
                    sqlcmd: null,
                    tablename: "tab2",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "U",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab3",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: null,
                    tablename: "tab3",
                    opkind: "D",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 3,
                    severity: 'E',
                    sqlcmd: null,
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a03",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: null,
                    tablename: "tab1",
                    opkind: "U",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 4,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });

                let checks = BusinessLogic.prototype.groupChecks(view, [t1r1, t1r2, t2r1, t2r2, t1r3, t3r1, t3r2], true);

                expect(checks["check_tab1_i_post"]).toBeDefined();
                expect(checks["check_tab1_i_post"].length).toBe(4);
                expect(checks["check_tab1_d_post"].length).toBe(0);
                expect(checks["check_tab1_u_post"].length).toBe(1);

                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a01').length).toBe(2);
                expect(checks["check_tab1_d_post"].filter(x => x.idaudit === 'a00').length).toBe(0);
                expect(checks["check_tab1_u_post"].filter(x => x.idaudit === 'a03').length).toBe(0);
                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a02').length).toBe(2);
                expect(checks["check_tab3_i_post"].filter(x => x.idaudit === 'a01').length).toBe(1);
                expect(checks["check_tab3_d_post"].filter(x => x.idaudit === 'a02').length).toBe(0);

            });


            it("should filter filter precheck/postcheck operation", function () {
                let t1 = new DataTable("tab1");
                let t1r1 = t1.newRow({a: 2});
                let t1r2 = t1.newRow({a: 3});
                t1r2.$acceptChanges();
                t1r2.a = 33;
                let t1r3 = t1.newRow({a: 30});
                t1r3.$acceptChanges();
                t1r3.$del();

                let t2 = new DataTable("tab2");
                let t2r1 = t2.newRow({a: 4});
                let t2r2 = t2.newRow({a: 5});
                t2r2.$acceptChanges();
                t2r2.$del();


                let t3 = new DataTable("tab3");
                let t3r1 = t3.newRow({a: 6});

                let t3r2 = t3.newRow({a: 7});
                t3r2.$acceptChanges();
                t3r2.$del();

                let view = new DataTable("auditcheckview");
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "D",
                    precheck: "S"
                });
                view.newRow({
                    idaudit: "a00",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab2",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "S"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "U",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "S"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab3",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a02",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab3",
                    opkind: "D",
                    precheck: "S"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 3,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a03",
                    idcheck: 1,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "U",
                    precheck: "S"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 2,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });
                view.newRow({
                    idaudit: "a01",
                    idcheck: 4,
                    severity: 'E',
                    sqlcmd: "x",
                    tablename: "tab1",
                    opkind: "I",
                    precheck: "N"
                });

                let checks = BusinessLogic.prototype.groupChecks(view, [t1r1, t1r2, t2r1, t2r2, t1r3, t3r1, t3r2], true);

                expect(checks["check_tab1_i_post"]).toBeDefined();
                expect(checks["check_tab1_i_post"].length).toBe(3);
                expect(checks["check_tab1_d_post"].length).toBe(0);
                expect(checks["check_tab1_u_post"].length).toBe(1);

                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a01').length).toBe(3);
                expect(checks["check_tab1_d_post"].filter(x => x.idaudit === 'a00').length).toBe(0);
                expect(checks["check_tab1_u_post"].filter(x => x.idaudit === 'a03').length).toBe(0);
                expect(checks["check_tab1_i_post"].filter(x => x.idaudit === 'a02').length).toBe(0);
                expect(checks["check_tab3_i_post"].filter(x => x.idaudit === 'a01').length).toBe(1);
                expect(checks["check_tab3_d_post"].filter(x => x.idaudit === 'a02').length).toBe(0);

            });
        });


        describe("execCheckBatch", function () {

            it("should select messages based on sp result ", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1, col1: 'A'});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2, col1: 'B'});
                let rCustomerPhone = tCustomerPhone.newRow({col1: 'cc', col2: 'dd'}, rCustomer2);
                //let rCustomerPhone1 = tCustomer.newRow({idcustomer: 1,idphone:1});
                let dsRules;
                spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(
                    /**
                     * Fake getStartingFrom
                     * @param {Context} context
                     * @param {DataTable} tableOp
                     * @return {Promise}
                     */
                    function (context, tableOp) {
                        const def = Deferred().resolve();
                        dsRules = tableOp.dataset;

                        let /*DataTable*/ auditParameter = dsRules.tables["auditparameter"];
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 1,
                            paramtable: 'customer',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 2,
                            paramtable: 'customer',
                            paramcolumn: 'col2',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'col3',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'idcustomer',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customerphone',
                            parameterid: 1,
                            paramtable: 'customerphone',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        let /*DataTable*/ auditCheckView = dsRules.tables["auditcheckview"];
                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'audit00 on customer %<customer.col1>%',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit02',
                            idcheck: 1,
                            severity: 'E',
                            message: 'audit02 on customer %<customer.col1>%',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit04',
                            idcheck: 1,
                            severity: 'E',
                            message: 'audit04 on customer %<customer.col1>%',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: null,
                            precheck: 'N'
                        });//sql null
                        auditCheckView.newRow({
                            idaudit: 'audit03',
                            idcheck: 1,
                            severity: 'E',
                            message: 'audit03 on customer %<customer.col1>%',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit01',
                            idcheck: 1,
                            severity: 'E',
                            message: 'audit01 on customer %<customer.col1>%',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'S'
                        });//precheck

                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'audit00 on customerphone %<customerphone.col1>% %<customerphone.col2>%',
                            tablename: 'customerphone',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });

                        return def.promise();
                    });
                //let paramsUsed= [];
                let BL = new BusinessLogic(context, [rCustomer1, rCustomer2, rCustomerPhone]);
                spyOn(BusinessLogic.prototype, 'parametersFor').and.callFake(
                    /**
                     *
                     * @param {DataSet} auditDS
                     * @param {RowChange} rc
                     * @param {boolean}post
                     */
                    function (auditDS, rc, post) {
                        //paramsUsed.push({auditDS:auditDS, rc:rc, post:post});
                        return [];
                    });

                let /*DataTable*/ auditRows = dsRules.tables["auditcheckview"].rows;
                let rc1 = new RowChange(3, rCustomer1.getRow(), [auditRows[0], auditRows[1], auditRows[3]], "@var1", "var1");
                let rc2 = new RowChange(3, rCustomer2.getRow(), [auditRows[0], auditRows[1], auditRows[3]], "@var2", "var2");
                let rc3 = new RowChange(1, rCustomerPhone.getRow(), [auditRows[5]], "@var3", "var3");
                let changes = [rc1, rc2, rc3];
                let runSqlCalls = [];
                spyOn(context.dataAccess, 'runSql').and.callFake(
                    async function (sql) {
                        runSqlCalls.push(sql);
                        return [{var1: 3, var2: 6, var3: 1}];
                    }
                );
                spyOn(BL.driver, 'getBitArray').and.callThrough();
                let busResult = new BusinessLogicResult();
                BL.auditsPromise.then(auditsDS => {
                    BL.execCheckBatch(context.dataAccess, changes, "various sp call", busResult, true)
                        .then(function () {
                            expect(runSqlCalls.length).toBe(1); //['various sp call;\r\nSELECT @var1 AS var1, @var2 AS var2, @var3 AS var3']
                            expect(runSqlCalls[0].indexOf("various sp call")).toBe(0);
                            expect(runSqlCalls[0].indexOf("SELECT")).toBeGreaterThan(0);

                            expect(BL.driver.getBitArray.calls.count()).toBe(3);

                            expect(busResult.checks.length).toBe(5);
                            expect(busResult.checks[0].msg).toBe("audit00 on customer A");
                            expect(busResult.checks[1].msg).toBe("audit02 on customer A");
                            expect(busResult.checks[2].msg).toBe("audit02 on customer B");
                            expect(busResult.checks[3].msg).toBe("audit03 on customer B");
                            expect(busResult.checks[4].msg).toBe("audit00 on customerphone cc dd");

                            BL.destroy().always(()=>{done();});
                        });


                });


            });

            it("should merge identical messages ", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1, col1: 'A'});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2, col1: 'B'});
                let rCustomerPhone = tCustomerPhone.newRow({col1: 'cc', col2: 'dd'}, rCustomer2);
                //let rCustomerPhone1 = tCustomer.newRow({idcustomer: 1,idphone:1});
                let dsRules;
                spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(
                    /**
                     * Fake getStartingFrom
                     * @param {Context} context
                     * @param {DataTable} tableOp
                     * @return {Promise}
                     */
                    function (context, tableOp) {
                        const def = Deferred().resolve();
                        dsRules = tableOp.dataset;

                        let /*DataTable*/ auditParameter = dsRules.tables["auditparameter"];
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 1,
                            paramtable: 'customer',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 2,
                            paramtable: 'customer',
                            paramcolumn: 'col2',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'col3',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'idcustomer',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customerphone',
                            parameterid: 1,
                            paramtable: 'customerphone',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        let /*DataTable*/ auditCheckView = dsRules.tables["auditcheckview"];
                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'error on customer',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit02',
                            idcheck: 1,
                            severity: 'E',
                            message: 'error on customer',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit04',
                            idcheck: 1,
                            severity: 'E',
                            message: 'error on customer',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: null,
                            precheck: 'N'
                        });//sql null
                        auditCheckView.newRow({
                            idaudit: 'audit03',
                            idcheck: 1,
                            severity: 'E',
                            message: 'error on customer',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit01',
                            idcheck: 1,
                            severity: 'E',
                            message: 'error on customer',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'S'
                        });//precheck

                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'error on customerphone',
                            tablename: 'customerphone',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });

                        return def.promise();
                    });


                //let paramsUsed= [];
                let BL = new BusinessLogic(context, [rCustomer1, rCustomer2, rCustomerPhone]);
                spyOn(BusinessLogic.prototype, 'parametersFor').and.callFake(
                    /**
                     *
                     * @param {DataSet} auditDS
                     * @param {RowChange} rc
                     * @param {boolean}post
                     */
                    function (auditDS, rc, post) {
                        //paramsUsed.push({auditDS:auditDS, rc:rc, post:post});
                        return [];
                    });

                let /*DataTable*/ auditRows = dsRules.tables["auditcheckview"].rows;
                let rc1 = new RowChange(3, rCustomer1.getRow(), [auditRows[0], auditRows[1], auditRows[3]], "@var1", "var1");
                let rc2 = new RowChange(3, rCustomer2.getRow(), [auditRows[0], auditRows[1], auditRows[3]], "@var2", "var2");
                let rc3 = new RowChange(1, rCustomerPhone.getRow(), [auditRows[5]], "@var3", "var3");
                let changes = [rc1, rc2, rc3];
                let runSqlCalls = [];
                spyOn(context.dataAccess, 'runSql').and.callFake(
                    async function (sql) {
                        runSqlCalls.push(sql);
                        return [{var1: 3, var2: 6, var3: 1}];
                    }
                );
                spyOn(BL.driver, 'getBitArray').and.callThrough();


                let busResult = new BusinessLogicResult();
                BL.auditsPromise.then(auditsDS => {
                    BL.execCheckBatch(context.dataAccess, changes, "various sp call", busResult, true)
                        .then(function () {
                            expect(runSqlCalls.length).toBe(1); //['various sp call;\r\nSELECT @var1 AS var1, @var2 AS var2, @var3 AS var3']
                            expect(runSqlCalls[0].indexOf("various sp call")).toBe(0);
                            expect(runSqlCalls[0].indexOf("SELECT")).toBeGreaterThan(0);

                            expect(BL.driver.getBitArray.calls.count()).toBe(3);
                            expect(busResult.checks.length).toBe(4);
                            expect(busResult.checks[0].msg).toBe("error on customer");
                            expect(busResult.checks[0].idRule).toBe("audit00");
                            expect(busResult.checks[1].msg).toBe("error on customer");
                            expect(busResult.checks[1].idRule).toBe("audit02");
                            expect(busResult.checks[2].msg).toBe("error on customer");
                            expect(busResult.checks[2].idRule).toBe("audit03");
                            expect(busResult.checks[3].msg).toBe("error on customerphone");
                            expect(busResult.checks[3].idRule).toBe("audit00");

                            BL.destroy().always(()=>{done();});
                        });

                });

            });

        });

        describe("getChecks", function () {

            it("should call parametersFor for every RowChange", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                //let rCustomerPhone1 = tCustomer.newRow({idcustomer: 1,idphone:1});
                let dsRules;
                spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(
                    /**
                     * Fake getStartingFrom
                     * @param {Context} context
                     * @param {DataTable} tableOp
                     * @return {Promise}
                     */
                    function (context, tableOp) {
                        const def = Deferred().resolve();
                        dsRules = tableOp.dataset;

                        let /*DataTable*/ auditParameter = dsRules.tables["auditparameter"];
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 1,
                            paramtable: 'customer',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 2,
                            paramtable: 'customer',
                            paramcolumn: 'col2',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'col3',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'idcustomer',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });
                        auditParameter.newRow({
                            tablename: 'customerphone',
                            parameterid: 1,
                            paramtable: 'customerphone',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        let /*DataTable*/ auditCheckView = dsRules.tables["auditcheckview"];
                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 1',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit02',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit04',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: null,
                            precheck: 'N'
                        });//sql null
                        auditCheckView.newRow({
                            idaudit: 'audit03',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 3',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit01',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'S'
                        });//precheck

                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error p1',
                            tablename: 'customerphone',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });

                        return def.promise();
                    });
                let paramsUsed = [];
                let BL = new BusinessLogic(context, [rCustomer1, rCustomer2, rCustomerPhone]);
                spyOn(BusinessLogic.prototype, 'parametersFor').and.callFake(
                    /**
                     *
                     * @param {DataSet} auditDS
                     * @param {RowChange} rc
                     * @param {boolean}post
                     */
                    function (auditDS, rc, post) {
                        paramsUsed.push({auditDS: auditDS, rc: rc, post: post});
                        return [];
                    });
                spyOn(BusinessLogic.prototype,"execCheckBatch").and.callFake(
                    async (conn,changes,batch,result,post)=>{
                        return {};
                    }
                );

                let result = new BusinessLogicResult();
                BL.auditsPromise.then(auditsDS => {
                    BL.getChecks(result, context.dataAccess, true)
                        .then(function (checks) {
                            expect(paramsUsed.length).toBe(3);
                            expect(paramsUsed[0].rc.r.current).toBe(rCustomer1);
                            expect(paramsUsed[0].rc.nChecks).toBe(3);
                            expect(paramsUsed[0].rc.varName).toBe(context.sqlConn.variableNameForNBits(1, 3));
                            expect(paramsUsed[0].rc.colName).toBe(context.sqlConn.colNameFromVarName(paramsUsed[0].rc.varName));

                            expect(paramsUsed[1].rc.r.current).toBe(rCustomer2);
                            expect(paramsUsed[1].rc.nChecks).toBe(3);
                            expect(paramsUsed[1].rc.varName).toBe(context.sqlConn.variableNameForNBits(2, 3));
                            expect(paramsUsed[1].rc.colName).toBe(context.sqlConn.colNameFromVarName(paramsUsed[1].rc.varName));

                            expect(paramsUsed[2].rc.r.current).toBe(rCustomerPhone);
                            expect(paramsUsed[2].rc.nChecks).toBe(1);
                            expect(paramsUsed[2].rc.varName).toBe(context.sqlConn.variableNameForNBits(3, 1));
                            expect(paramsUsed[2].rc.colName).toBe(context.sqlConn.colNameFromVarName(paramsUsed[2].rc.varName));

                            BL.destroy().always(()=>{done();});
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            BL.destroy().always(()=>{done();});
                        });


                });
            });

            it("should call execCheckBatch with a batch of changes  with correct parameters", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1, col1: 1, col2: 11, col3: 111});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2, col1: 1, col2: 22, col3: 222});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                //let rCustomerPhone1 = tCustomer.newRow({idcustomer: 1,idphone:1});
                let dsRules;
                spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(
                    /**
                     * Fake getStartingFrom
                     * @param {Context} context
                     * @param {DataTable} tableOp
                     * @return {Promise}
                     */
                    function (context, tableOp) {
                        const def = Deferred().resolve();
                        dsRules = tableOp.dataset;

                        let /*DataTable*/ auditParameter = dsRules.tables["auditparameter"];
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 1,
                            paramtable: 'customer',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "N"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 2,
                            paramtable: 'customer',
                            paramcolumn: 'col2',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "N"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'col3',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'idcustomer',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "N"
                        });

                        auditParameter.newRow({
                            tablename: 'customerphone',
                            parameterid: 1,
                            paramtable: 'customerphone',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        let /*DataTable*/ auditCheckView = dsRules.tables["auditcheckview"];
                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 1',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit02',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit04',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: null,
                            precheck: 'N'
                        });//sql null
                        auditCheckView.newRow({
                            idaudit: 'audit03',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 3',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit01',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'S'
                        });//precheck

                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error p1',
                            tablename: 'customerphone',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });

                        return def.promise();
                    });
                let paramsUsed = [];

                let BL = new BusinessLogic(context, [rCustomer1, rCustomer2, rCustomerPhone]);
                spyOn(BusinessLogic.prototype, 'parametersFor').and.callThrough();

                let paramsExecBatchUsed = [];
                spyOn(BusinessLogic.prototype, 'execCheckBatch').and.callFake(
                    function (conn, changes, res, post, results) {
                        paramsExecBatchUsed.push({
                            conn: conn,
                            changes: changes,
                            res: res,
                            post: post,
                            results: results
                        });
                        //eventually add some error to results
                        return [];
                    }
                );
                let result = new BusinessLogicResult();

                BL.auditsPromise.then(auditsDS => {
                    BL.getChecks(result, context.dataAccess, true)
                        .then(function (checks) {

                            expect(BusinessLogic.prototype.parametersFor.calls.count()).toBe(3);
                            expect(paramsExecBatchUsed.length).toBe(1);
                            expect(paramsExecBatchUsed[0].changes.length).toBe(3);
                            expect(paramsExecBatchUsed[0].changes[0].tableName).toBe("customer");
                            expect(paramsExecBatchUsed[0].changes[0].r.current).toBe(rCustomer1);
                            expect(paramsExecBatchUsed[0].changes[0].nChecks).toBe(3); //3 checks on customer
                            let varName = paramsExecBatchUsed[0].changes[0].varName;
                            expect(varName).toBe(context.sqlConn.variableNameForNBits(1, 3));
                            expect(paramsExecBatchUsed[0].changes[0].colName).toBe(context.sqlConn.colNameFromVarName(varName));

                            expect(paramsExecBatchUsed[0].changes[1].r.current).toBe(rCustomer2);
                            expect(paramsExecBatchUsed[0].changes[1].nChecks).toBe(3); //3 checks on customer
                            varName = paramsExecBatchUsed[0].changes[1].varName;
                            expect(varName).toBe(context.sqlConn.variableNameForNBits(2, 3));
                            expect(paramsExecBatchUsed[0].changes[1].colName).toBe(context.sqlConn.colNameFromVarName(varName));

                            expect(paramsExecBatchUsed[0].changes[2].r.current).toBe(rCustomerPhone);
                            expect(paramsExecBatchUsed[0].changes[2].nChecks).toBe(1); //1 check on customer phone
                            varName = paramsExecBatchUsed[0].changes[2].varName;
                            expect(varName).toBe(context.sqlConn.variableNameForNBits(3, 1));
                            expect(paramsExecBatchUsed[0].changes[2].colName).toBe(context.sqlConn.colNameFromVarName(varName));

                            BL.destroy().then(()=>{done();});
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            BL.destroy().then(()=>{done();});
                        });


                });
            });

            it("should call execCheckBatch splitting changes in batches with correct parameters", function (done) {
                let ds = dsProvider("customerphone");
                let tCustomer = ds.tables["customer"];
                let tCustomerPhone = ds.tables["customerphone"];
                let rCustomer1 = tCustomer.newRow({idcustomer: 1, col1: 1, col2: 11, col3: 111});
                let rCustomer2 = tCustomer.newRow({idcustomer: 2, col1: 1, col2: 22, col3: 222});
                let rCustomerPhone = tCustomerPhone.newRow(null, rCustomer2);
                //let rCustomerPhone1 = tCustomer.newRow({idcustomer: 1,idphone:1});
                let dsRules;
                spyOn(context.getDataSpace, 'getStartingFrom').and.callFake(
                    /**
                     * Fake getStartingFrom
                     * @param {Context} context
                     * @param {DataTable} tableOp
                     * @return {Promise}
                     */
                    function (context, tableOp) {
                        const def = Deferred().resolve();
                        dsRules = tableOp.dataset;

                        let /*DataTable*/ auditParameter = dsRules.tables["auditparameter"];
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 1,
                            paramtable: 'customer',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "N"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 2,
                            paramtable: 'customer',
                            paramcolumn: 'col2',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "N"
                        });
                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'col3',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        auditParameter.newRow({
                            tablename: 'customer',
                            parameterid: 3,
                            paramtable: 'customer',
                            paramcolumn: 'idcustomer',
                            flagoldvalue: 'N',
                            opkind: "I",
                            isprecheck: "N"
                        });

                        auditParameter.newRow({
                            tablename: 'customerphone',
                            parameterid: 1,
                            paramtable: 'customerphone',
                            paramcolumn: 'col1',
                            flagoldvalue: 'S',
                            opkind: "I",
                            isprecheck: "S"
                        });

                        let /*DataTable*/ auditCheckView = dsRules.tables["auditcheckview"];
                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 1',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit02',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit04',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: null,
                            precheck: 'N'
                        });//sql null
                        auditCheckView.newRow({
                            idaudit: 'audit03',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 3',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });
                        auditCheckView.newRow({
                            idaudit: 'audit01',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error 2',
                            tablename: 'customer',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'S'
                        });//precheck

                        auditCheckView.newRow({
                            idaudit: 'audit00',
                            idcheck: 1,
                            severity: 'E',
                            message: 'Error p1',
                            tablename: 'customerphone',
                            opkind: 'I',
                            sqlcmd: 'dummy',
                            precheck: 'N'
                        });

                        return def.promise();
                    });
                let paramsUsed = [];

                let BL = new BusinessLogic(context, [rCustomer1, rCustomer2, rCustomerPhone]);
                spyOn(BusinessLogic.prototype, 'parametersFor').and.callThrough();

                let paramsExecBatchUsed = [];
                spyOn(BusinessLogic.prototype, 'execCheckBatch').and.callFake(
                    /**
                     * fake method
                     * @param {DataAccess} conn
                     * @param {RowChange[]}  changes
                     * @param {string} cmd
                     * @param {BusinessLogicResult} result used to push found errors
                     * @param {boolean} post
                     * @return {*}                  */
                    function (conn, changes, cmd, result, post) {
                        paramsExecBatchUsed.push({conn: conn, changes: changes, cmd, result: result, post: post});
                        //eventually add some error to results
                        let i = 0;
                        changes.forEach(c => {
                            result.addMessage(new BusinessMessage({
                                rowChange: c,
                                cmd: cmd,
                                post: post,
                                longMsg: "Fake long msg" + (paramsExecBatchUsed.length + i) + " on " + c.tableName + "(" + i + ")",
                                shortMsg: "Fake short msg" + (paramsExecBatchUsed.length + i) + " on " + c.tableName + "(" + i + ")",
                                idRule: "fake id",
                                canIgnore: false
                            }));
                            i += 1;
                        });
                    }
                );

                let result = new BusinessLogicResult();
                BL.maxBatchSize = 60; //force splitting after 60 bytes
                BL.auditsPromise.then(auditsDS => {
                    BL.getChecks(result, context.dataAccess, true)
                        .then(function (checks) {
                            expect(checks.checks.length).toBe(3);
                            expect(checks.canIgnore).toBe(false);

                            expect(BusinessLogic.prototype.parametersFor.calls.count()).toBe(3);

                            expect(paramsExecBatchUsed.length).toBe(2);
                            expect(paramsExecBatchUsed[0].changes.length).toBe(2);

                            expect(paramsExecBatchUsed[0].changes[0].tableName).toBe("customer");
                            expect(paramsExecBatchUsed[0].changes[0].r.current).toBe(rCustomer1);
                            expect(paramsExecBatchUsed[0].changes[0].nChecks).toBe(3); //3 checks on customer
                            let varName = paramsExecBatchUsed[0].changes[0].varName;
                            expect(varName).toBe(context.sqlConn.variableNameForNBits(1, 3));
                            expect(paramsExecBatchUsed[0].changes[0].colName).toBe(context.sqlConn.colNameFromVarName(varName));
                            expect(paramsExecBatchUsed[0].cmd.indexOf("check_customer_i_post")).toBeGreaterThan(-1);
                            expect(paramsExecBatchUsed[0].cmd.indexOf("(" + varName)).toBeGreaterThan(-1);

                            expect(paramsExecBatchUsed[0].changes[1].r.current).toBe(rCustomer2);
                            expect(paramsExecBatchUsed[0].changes[1].nChecks).toBe(3); //3 checks on customer
                            varName = paramsExecBatchUsed[0].changes[1].varName;
                            expect(varName).toBe(context.sqlConn.variableNameForNBits(2, 3));
                            expect(paramsExecBatchUsed[0].changes[1].colName).toBe(context.sqlConn.colNameFromVarName(varName));

                            expect(paramsExecBatchUsed[1].changes.length).toBe(1);
                            expect(paramsExecBatchUsed[1].changes[0].r.current).toBe(rCustomerPhone);
                            expect(paramsExecBatchUsed[1].changes[0].nChecks).toBe(1); //1 checks on customer phone
                            varName = paramsExecBatchUsed[1].changes[0].varName;
                            expect(varName).toBe(context.sqlConn.variableNameForNBits(1, 1));
                            expect(paramsExecBatchUsed[1].changes[0].colName).toBe(context.sqlConn.colNameFromVarName(varName));
                            expect(paramsExecBatchUsed[1].cmd.indexOf("check_customerphone_i_post")).toBeGreaterThan(-1);
                            expect(paramsExecBatchUsed[1].cmd.indexOf("(" + varName)).toBeGreaterThan(-1);

                            expect(paramsExecBatchUsed[0].conn).toBeDefined();
                            expect(paramsExecBatchUsed[1].conn).toBeDefined();

                            BL.destroy().always(()=>{done();});
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            BL.destroy().always(()=>{done();});
                        });


                });
            });


        });
    });


    describe("BusinessLogicResult", function () {
        describe("addDbError", function () {

            it("should add a blocking error", function () {
                let BLR = new BusinessLogicResult();

                expect(BLR.canIgnore).toBe(true);

                let msg = BLR.addDbError("Unrecoverable", true);
                expect(msg.canIgnore).toBe(false);
                expect(BLR.canIgnore).toBe(false);
            });
        });
    });


    // describe('destroy dataBase', function () {
    //     let sqlConn;
    //     beforeEach(function (done) {
    //         dbList.setDbInfo('test', good);
    //         sqlConn = dbList.getConnection('test');
    //         sqlConn.open().done(function () {
    //             done();
    //         });
    //     });

        // afterEach(function () {
        //     dbList.delDbInfo('test');
        //     if (sqlConn) {
        //         sqlConn.destroy();
        //     }
        //     sqlConn = null;
        //     if (fs.existsSync('test/data/BusinessLogic/dbList.bin')) {
        //         fs.unlinkSync('test/data/BusinessLogic/dbList.bin');
        //     }
        // });
        //
        // //we are dropping database so no need of a destroy script
        // xit('should run the destroy script', function (done) {
        //     sqlConn.run(fs.readFileSync(path.join('test', 'data', 'BusinessLogic', 'destroy.sql')).toString())
        //         .done(function () {
        //             expect(true).toBeTruthy();
        //             done();
        //         })
        //         .fail(function (res) {
        //             expect(res).toBeUndefined();
        //             done();
        //         });
        // });

    // });

});