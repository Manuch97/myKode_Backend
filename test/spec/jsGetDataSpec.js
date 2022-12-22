'use strict';
/*globals describe,beforeEach,it,expect,jasmine,spyOn */
/*jshint jasmine:true */
//admit object[field]
/* jshint -W069 */

console.log("running jsGetDataSpec");

const getData = require('../../src/jsGetData'),
    getContext = require('../data/GetData/fakeContext').getContext,
    dq = require('./../../client/components/metadata/jsDataQuery'),
    dataSetProvider = require('../data/GetData/fakeDataSetProvider'),
    _ = require('lodash'),
    fs = require('fs'),
    path   = require('path'),
    dbList = require('../../src/jsDbList');
const {v4: uuidv4} = require("uuid");
const mySqlDriver = require("../../src/jsMySqlDriver");


/**
 * *****************************************************************************************
 * VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT VERY IMPORTANT
 * *****************************************************************************************
 * It's necessary, before start running the test, to create a file templated like:
 *  { "server": "db server address",
 *    "dbName": "database name",  //this must be an EMPTY database
 *    "user": "db user",
 *    "pwd": "db password"
 *  }
 */
let configName = path.join('test', 'dbMySql.json');
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
    encryptedFileName: 'test/data/DataAccess/dbList.bin'
});

let good = {
    server: dbConfig.server,
    useTrustedConnection: false,
    user: dbConfig.user,
    pwd: dbConfig.pwd,
    database: dbConfig.database,
    sqlModule: 'jsMySqlDriver'
};

let dbName = "jsGetData_" + uuidv4().replace(/\-/g, '_');
good.database = dbName;


describe("jsGetData",function() {

    let masterConn;
    beforeAll(function (done) {
        if (process.env.TRAVIS) return;

        masterConn = null;

        let options = _.extend({}, good);
        //console.log("jsGetData creating db ");
        //console.log(good);
        if (options) {
            options.database = null;
            options.dbCode = "good";
            masterConn = new mySqlDriver.Connection(options);
            masterConn.open()
                .then(function () {
                    return masterConn.run("create database " + dbName);
                })
                .then(function () {
                    done();
                })
                .fail((err) => {
                    console.log(err);
                });
        }

    });

    afterAll(function (done) {
        if (!masterConn) {
            done();
        }
        masterConn.run("drop database IF EXISTS " + dbName)
            .then(() => {
                return masterConn.close();
            })
            .then(() => {
                done();
            });

    });

    describe('setup dataBase', function () {
        var sqlConn;
        beforeEach(function (done) {
            //console.log("jsGetData setup db");
            //console.log(good);

            dbList.setDbInfo('testGetData', good);
            sqlConn = dbList.getConnection('testGetData');
            sqlConn.open().done(function () {
                done();
            });
        });

        afterEach(function () {
            if (sqlConn) {
                sqlConn.destroy();
            }
            sqlConn = null;
        });


        it('should run the setup script', function (done) {
            sqlConn.run(fs.readFileSync(path.join('test', 'data', 'GetData', 'setup.sql')).toString())
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

    describe('getData', function () {
        var ctx,
            dsCustomer;

        beforeEach(function (done) {
            dsCustomer = dataSetProvider('customer', 'default');
            getContext('testGetData', 'nino', 'default', '2014', new Date(2014, 1, 20, 10, 10, 10, 0))
                .then(function (res) {
                    ctx = res;
                    //console.log("to open beforeEach "+ ctx.dataAccess);
                    return ctx.dataAccess.open();
                })
                .then(()=>{
                    //console.log("beforeEach opened "+ ctx.dataAccess.edgeHandler);
                    done();
                })
                .fail(function (err) {
                    done();
                });
        });
        var sqlConn;


        afterEach(function (done) {
            ctx.dataAccess.destroy()
                .then(()=>{
                    dbList.delDbInfo('testGetData');
                    done();
                });
        });

        it('should define getFilterKey', function () {
            expect(getData.getFilterKey).toEqual(jasmine.any(Function));
        });

        it('getFilterKey should filter key fields (single key)', function (done) {
            //customer key  is idcustomer

            getData.getFilterKey(ctx, 'customer', {idcustomer: 1, a: 1, b: 2, c: 3})
                .done(function (filter) { //here dataaccess is not open
                    var arr = [{a: 1, idcustomer: 2}, {a: 3, c: 5}, {a: 4, idcustomer: 1}, {a: 5, idcustomer: 6}],
                        res = _.filter(arr, filter);
                    expect(res).toEqual([{a: 4, idcustomer: 1}]);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    expect(true).toBeUndefined();
                    done();
                });
        });


        it('getFilterKey should filter key fields (multi key)', async function () {
            //customerphone key  is idcustomer idphone
            try {
                let filter = await getData.getFilterKey(ctx, 'customerphone', {idcustomer: 3, idphone: 2, c: 3, a: 4});
                expect(filter.toString()).toEqual('mcmp([idcustomer,idphone],[3,2])');
                let arr = [
                        {a: 1, idcustomer: 1, idphone: 1},
                        {a: 3, c: 5},
                        {a: 4, idcustomer: 3, idphone: 1},
                        {a: 5, idcustomer: 3, idphone: 2},
                        {a: 6, idcustomer: 3, idphone: 3}
                    ],
                    res = _.filter(arr, filter);
                expect(res).toEqual([
                    {a: 5, idcustomer: 3, idphone: 2}
                ]);
                //done();
            } catch (err) {
                expect(err).toBeUndefined();
                expect(true).toBeUndefined();
                //done();
            }
        });

        it('fillDataSetByKey should fill a dataset (single table)', async function () {
            try {
                expect(dsCustomer.tables['customer'].rows.length).toBe(0);
                await getData.fillDataSetByKey(ctx, dsCustomer, dsCustomer.tables['customer'], {idcustomer: 10});
                expect(dsCustomer.tables['customer'].rows.length).toBe(1);
                expect(dsCustomer.tables['customer'].rows[0]['idcustomer']).toBe(10);
                expect(dsCustomer.tables['customer'].rows[0]['name']).toBe('name10');
                //done();
            } catch (err) {
                expect(err).toBeUndefined();
                //done();
            }
        });

        it('fillDataSetByKey should fill main table (multiple table)', function (done) {
            let dsSell = dataSetProvider('sell', 'default');
            getData.fillDataSetByKey(ctx, dsSell, dsSell.tables['sell'], {idsell: 15})
                .done(function () {
                    expect(dsSell.tables['sell'].rows.length).toBe(1);
                    expect(dsSell.tables['sell'].rows[0]['idsell']).toBe(15);
                    expect(dsSell.tables['sell'].rows[0]['place']).toBe('place_15-3');
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });


        it('fillDataSetByKey should call getStartingFrom)', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            spyOn(getData, 'getStartingFrom').and.callThrough();
            getData.fillDataSetByKey(ctx, dsSell, dsSell.tables['sell'], {idsell: 20})
                .done(function () {
                    expect(getData.getStartingFrom).toHaveBeenCalled();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByKey should call getByKey)', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            spyOn(getData, 'getByKey').and.callThrough();
            getData.fillDataSetByKey(ctx, dsSell, dsSell.tables['sell'], {idsell: 20})
                .done(function () {
                    expect(getData.getByKey).toHaveBeenCalled();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByKey should call getStartingFrom)', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            spyOn(getData, 'getStartingFrom').and.callThrough();
            getData.fillDataSetByKey(ctx, dsSell, dsSell.tables['sell'], {idsell: 20})
                .done(function () {
                    expect(getData.getStartingFrom).toHaveBeenCalled();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByKey should call getStartingFrom with given table filled)', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            spyOn(getData, 'getStartingFrom').and.callThrough();
            getData.fillDataSetByKey(ctx, dsSell, dsSell.tables['sell'], {idsell: 20})
                .done(function () {
                    expect(getData.getStartingFrom.calls.argsFor(0)[0]).toBe(ctx);
                    expect(getData.getStartingFrom.calls.argsFor(0)[1]).toBe(dsSell.tables['sell']);
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByKey should call scanTables)', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            spyOn(getData, 'scanTables').and.callThrough();
            getData.fillDataSetByKey(ctx, dsSell, dsSell.tables['sell'], {idsell: 20})
                .done(function () {
                    expect(getData.scanTables).toHaveBeenCalled();
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });


        it('fillDataSetByKey should fill child table (one child table)', function (done) {
            var dsCustomerPhone = dataSetProvider('customerphone', 'default');
            getData.fillDataSetByKey(ctx, dsCustomerPhone, dsCustomerPhone.tables['customer'], {idcustomer: 23})
                .done(function () {
                    expect(dsCustomerPhone.tables['customerphone'].rows.length).toBe(3);
                    if (dsCustomerPhone.tables['customerphone'].rows.length > 0) {
                        expect(dsCustomerPhone.tables['customerphone'].rows[0]['idcustomer']).toBe(23);
                    }
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByKey should fill child table (different parent tables)', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            /*
                SELL row:
                idseller	idcustomer	idcoseller	idcoseller2	idlist	price	place	    idsell	    date
                6	        6	        10	        11	        2	    200.00	place_5-2	5	        NULL

                SELLER rows:
                idseller	idsellerkind	name	age	birth	                surname	        stamp	                random	curr	cf
                6	        1	            name6	16	2010-09-24 12:27:38.030	surname_100012	2015-10-10 21:18:13.200	452	    8420.01	77239.3
                10	        2	            name10	20	2010-09-24 12:27:38.030	surname_100020	2015-10-10 21:18:13.210	335	    7467.36	346.178

                SELLVIEW row:
                idsell	place	    idseller	idsellerkind	idcustomer	idcustomerkind	seller	sellerkind	    customer	customerkind
                5	    place_5-2	6	        1	            6	        1	            name6	seller kind n.1	name6	    custom.kind-1
             */

            getData.fillDataSetByKey(ctx, dsSell, dsSell.tables['sell'], {idsell: 5})
                .done(function () {
                    expect(dsSell.tables['selleractivity'].rows.length).toBe(3);
                    expect(dsSell.tables['seller1'].rows.length).toBe(1);
                    if (dsSell.tables['seller1'].rows.length > 0) {
                        expect(dsSell.tables.seller1.rows[0].idseller).toBe(6);
                    }
                    expect(dsSell.tables['sellsupplement'].rows.length).toBe(2);
                    if (dsSell.tables['selleractivity'].rows.length > 0) {
                        expect(dsSell.tables.selleractivity.rows[0].idseller).toBe(6);
                    }
                    expect(dsSell.tables['sellview'].rows.length).toBe(1);
                    if (dsSell.tables['sellview'].rows.length > 0) {
                        expect(dsSell.tables.sellview.rows[0].idsell).toBe(5);
                        expect(dsSell.tables.sellview.rows[0].seller).toBe('name6');
                        expect(dsSell.tables.sellview.rows[0].place).toBe('place_5-2');
                    }
                    expect(dsSell.tables['sellerkind1'].rows.length).toBe(1);
                    if (dsSell.tables['sellerkind1'].rows.length > 0) {
                        expect(dsSell.tables.sellerkind1.rows[0].idsellerkind).toBe(1);
                        expect(dsSell.tables.sellerkind1.rows[0].name).toBe('seller kind n.1');
                    }
                    expect(dsSell.tables['sellerkind2'].rows.length).toBe(1);
                    if (dsSell.tables['sellerkind2'].rows.length > 0) {
                        expect(dsSell.tables.sellerkind2.rows[0].idsellerkind).toBe(2);
                        expect(dsSell.tables.sellerkind2.rows[0].name).toBe('seller kind n.2');
                    }
                    done();
                })
                .fail(function (err) {
                    expect(err).toBeUndefined();
                    expect(true).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByFilter should fill give same results as fillDataSetByKey when filter is key filter', function (done) {
            var dsSell = dataSetProvider('sell', 'default'),
                dsSell2 = dataSetProvider('sell', 'default');

            getData.fillDataSetByFilter(ctx, dsSell.tables['sell'], dq.eq('idsell', 3))
                .then(function () {
                    return getData.fillDataSetByKey(ctx, dsSell2, dsSell2.tables['sell'], {idsell: 3});
                })
                .done(function () {
                    expect(dsSell.tables['sell'].rows).toEqual(dsSell2.tables['sell'].rows);
                    expect(dsSell.tables['sellview'].rows).toEqual(dsSell2.tables['sellview'].rows);
                    expect(dsSell.tables['seller1'].rows).toEqual(dsSell2.tables['seller1'].rows);
                    expect(dsSell.tables['seller2'].rows).toEqual(dsSell2.tables['seller2'].rows);
                    expect(dsSell.tables['selleractivity'].rows).toEqual(dsSell2.tables['selleractivity'].rows);
                    expect(dsSell.tables['sellerkind1'].rows).toEqual(dsSell2.tables['sellerkind1'].rows);
                    done();
                })
                .fail(function (err) {
                    expect(true).toBeUndefined();
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByFilter should call getParentRows on every single row read', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            spyOn(getData, 'getParentRows').and.callThrough();
            getData.fillDataSetByFilter(ctx, dsSell.tables['sell'], dq.eq('idsell', 6))
                .done(function () {

                    expect(getData.getParentRows.calls.count()).toEqual(
                        _.reduce(dsSell.tables, function (accumulator, t) {
                            accumulator += t.rows.length;
                            return accumulator;
                        }, 0)
                    );
                    done();
                })
                .fail(function (err) {
                    expect(true).toBeUndefined();
                    expect(err).toBeUndefined();
                    done();
                });
        });

        it('fillDataSetByFilter should call getAllChildRows on every not-empty table read', function (done) {
            var dsSell = dataSetProvider('sell', 'default');
            spyOn(getData, 'getAllChildRows').and.callThrough();
            getData.fillDataSetByFilter(ctx, dsSell.tables['sell'], dq.eq('idsell', 13))
                .done(function () {

                    expect(getData.getAllChildRows.calls.count()).toEqual(
                        _.reduce(dsSell.tables, function (accumulator, t) {
                            if (t.rows.length > 0) {
                                accumulator += 1;
                            }
                            return accumulator;
                        }, 0)
                    );
                    done();
                })
                .fail(function (err) {
                    expect(true).toBeUndefined();
                    expect(err).toBeUndefined();
                    done();
                });
        });


    });

    describe('destroy dataBase', function () {
        var sqlConn;
        beforeEach(function (done) {
            dbList.setDbInfo('testGetData', good);
            sqlConn = dbList.getConnection('testGetData');
            sqlConn.open().done(function () {
                done();
            });
        });

        afterEach(function () {
            dbList.delDbInfo('test');
            if (sqlConn) {
                sqlConn.destroy();
            }
            sqlConn = null;
            if (fs.existsSync('test/dbList.bin')) {
                fs.unlinkSync('test/dbList.bin');
            }
        });

        it('should run the destroy script', function (done) {
            sqlConn.run(fs.readFileSync(path.join('test', 'data', 'GetData', 'destroy.sql')).toString())
                .done(function () {
                    expect(true).toBeTruthy();
                    done();
                })
                .fail(function (res) {
                    expect(res).toBeUndefined();
                    done();
                });
        });
    });

});