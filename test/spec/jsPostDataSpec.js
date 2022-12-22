/*globals describe, beforeEach,it,expect,jasmine,spyOn */
/*jshint -W069 */


console.log("running jsPostDataSpec");

const PostData = require('../../src/jsPostData').PostData,
    SinglePostData=require('../../src/jsPostData').SinglePostData,
    BusinessLogicResult = require('../../src/jsPostData').BusinessLogicResult,
    BasicMessage = require('../../src/jsPostData').BasicMessage,
    MaxCacher = require('../../src/jsPostData').MaxCacher,
    IInnerPoster=require('../../src/jsPostData').IInnerPoster,
    dsNameSpace = require('./../../client/components/metadata/jsDataSet'),
    dq = require('./../../client/components/metadata/jsDataQuery'),
    DA = require('../../src/jsDataAccess');


const Deferred = require("JQDeferred");
const Environment = require('../data/PostData/fakeEnvironment'),
    getContext  =  require('../data/PostData/fakeContext').getContext,
    dbList = require('../../src/jsDbList'),
    dataRowState = dsNameSpace.dataRowState,
    DataSet = dsNameSpace.DataSet,
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
 *    "dbName": "database name",  //this must be an EMPTY database
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

const good = {
    server: dbConfig.server,
    useTrustedConnection: false,
    user: dbConfig.user,
    pwd: dbConfig.pwd,
    database: dbConfig.database,
    sqlModule: 'jsMySqlDriver'
};

let dbName;

describe("jsPostData",function() {

    let masterConn;
    beforeAll(function(done){
        if (process.env.TRAVIS) return;

        masterConn= null;
        dbName = "jsPostData_"+ uuidv4().replace(/\-/g, '_');
        good.database = dbName;



        let options =  _.extend({},good);
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
                    console.log("err"+err);
                });
        }

    },60000);

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
        let sqlConn;
        beforeEach(function (done) {
            dbList.setDbInfo('testPostData', good);


            sqlConn = dbList.getConnection('testPostData');
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
            sqlConn.run(fs.readFileSync(path.join('test', 'data', 'PostData', 'setup.sql')).toString(),6000)
                .done(function () {
                    expect(true).toBeTruthy();
                    done();
                })
                .fail(function (res) {
                    expect(res).toBeUndefined();
                    done();
                });
        },60000);

    });

    function createSet(t) {
        let s = new Set();
        s.add(t);
        return s;
    }

    describe('Deferred Chain', function () {
        it('chain should return the last resolve', function (done) {
            let d1 = new Deferred();
            let d2 = new Deferred();
            let d3 = new Deferred();
            let dAll = d1.then(() => d2)
                .then(() => d3);
            dAll.then((r) => {
                expect(r).toBe("c");
                done();
            })
                .fail(err => {
                    expect(1).toBe(0);
                    done();
                });
            d1.resolve("a");
            d2.resolve("b");
            d3.resolve("c");
        });

        it('fail should work also when it is raided from first Deferred of the chain', function (done) {
            let d1 = new Deferred();
            let d2 = new Deferred();
            let d3 = new Deferred();
            let dAll = d1.then(() => d2)
                .then(() => d3);
            dAll.then(() => {
                expect(1).toBe(0);
                done();
            })
                .fail(err => {
                    expect(err).toBe("a");
                    done();
                });
            d1.reject("a");
            d2.resolve("b");
            d3.resolve("c");
        });

        it('fail should work also when it is raided from second Deferred of the chain', function (done) {
            let d1 = new Deferred();
            let d2 = new Deferred();
            let d3 = new Deferred();
            let dAll = d1.then(() => d2)
                .then(() => d3);
            dAll.then((r) => {
                expect(r).toBe(0);
                done();
            })
                .fail(err => {
                    expect(err).toBe("b");
                    done();
                });
            d1.resolve("a");
            d2.reject("b");
            d3.resolve("c");
        });

        it('a resolved promise should fire every then', function (done) {
            let d1 = new Deferred();
            let d2 = new Deferred();
            let d3 = new Deferred();
            let d4 = new Deferred();
            d1.resolve(2);
            d1.then(x => d2.resolve(x));
            d1.then(x => d3.resolve(x));
            d1.then(x => d4.resolve(x));
            d4.then(x => {
                expect(x).toBe(2);
                done();
            });

        });

        it('then function are implicitly promises', function (done) {
            let d1 = new Deferred();
            d1.then(x => {
                return x + 3;
            })
                .then(function (x) {
                    return x + 1;
                })
                .then(function (x) {
                    return x + 1;
                })
                .then(function (x) {
                    expect(x).toBe(7);
                    done();
                })
            ;
            d1.resolve(2);

        });
    });

    describe('PostData', function () {
        let DAC, env;


        describe('getChanges', function () {
            let d;
            beforeEach(function (done) {
                let i, t, rowCount, row;
                d = new DataSet('D');
                i = 11;
                while (--i > 0) {
                    t = d.newTable('tab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d.newRelation('r' + i + 'a', 'tab' + i, ['idExt' + (i + 1)], 'tab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }

                DAC = undefined;
                env = new Environment();

                dbList.getDataAccess('testPostData')
                    .done(function (conn) {
                        DAC = conn;
                        done();
                    })
                    .fail(function (err) {
                        done();
                    });
            });
            it('should be a function', function () {
                expect(SinglePostData.prototype.getChanges).toEqual(jasmine.any(Function));
            });
            it('should return an array', function () {
                expect(SinglePostData.prototype.getChanges(d)).toEqual(jasmine.any(Array));
            });
            it('should return as many rows as there were modified in d', function () {
                const p = new SinglePostData(),
                    res = p.getChanges(d);
                expect(res.length).toBe(50);
            });
            it('should return as many rows as there were modified in d (2th set)', function () {
                d.tables.tab1.acceptChanges();
                d.tables.tab3.clear();
                const p = new SinglePostData(),
                    res = p.getChanges(d);
                expect(res.length).toBe(40);
            });
            it('should return as many rows as there were modified in d (3th set)', function () {
                d.tables.tab4.rejectChanges();
                const p = new SinglePostData(),
                    res = p.getChanges(d);
                expect(res.length).toBe(45);
            });
            it('should return as many rows as there were modified in d (4th set)', function () {
                d.acceptChanges();
                const p = new SinglePostData(),
                    res = p.getChanges(d);
                expect(res.length).toBe(0);
            });
            it('should return as many rows as there were modified in d (5th set)', function () {
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                const i = 0;
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[3].getRow().del();
                d.tables.tab4.rows[2].data4 = 'ciao';
                d.tables.tab4.rows[4].data4 = 'ciao';

                d.tables.tab8.rows[0].getRow().del();
                d.tables.tab8.rows[1].getRow().del();
                d.tables.tab8.rows[2].data8 = 'hi';
                d.tables.tab8.rows[4].data8 = 'hi';

                d.tables.tab9.rows[1].data9 = 'sayonara';
                d.tables.tab9.rows[2].data9 = 'sayonara';

                const p = new SinglePostData(),
                    res = p.getChanges(d);
                expect(res.length).toBe(40);
            });
            it('should return as many rows as there were modified in d (6th set)', function () {
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                const i = 0;
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[1].getRow().del();
                d.tables.tab4.rows[2].getRow().del();
                d.tables.tab4.rows[3].getRow().del();
                d.tables.tab4.rows[4].getRow().del();

                d.tables.tab8.rows[0].getRow().del();
                d.tables.tab8.rows[1].getRow().del();
                d.tables.tab8.rows[2].data8 = 'hi';
                d.tables.tab8.rows[4].data8 = 'hi';

                d.tables.tab9.rows[1].data9 = 'sayonara';
                d.tables.tab9.rows[2].data9 = 'sayonara';

                const p = new SinglePostData(),
                    res = p.getChanges(d);
                expect(res.length).toBe(41);
            });
            it('checkIsNotParent should return not-parents', function () {
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                const i = 0;
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[1].getRow().del();
                d.tables.tab4.rows[2].getRow().del();
                d.tables.tab4.rows[3].getRow().del();
                d.tables.tab4.rows[4].getRow().del();

                d.tables.tab8.rows[0].getRow().del();
                d.tables.tab8.rows[1].getRow().del();
                d.tables.tab8.rows[2].data8 = 'hi';
                d.tables.tab8.rows[4].data8 = 'hi';

                d.tables.tab9.rows[1].data9 = 'sayonara';
                d.tables.tab9.rows[2].data9 = 'sayonara';


                const p = new SinglePostData();
                expect(p.checkNotParent(d.tables.tab4, new Set())).toBeFalsy();
                expect(p.checkNotParent(d.tables.tab4, createSet("tab5"))).toBeTruthy();
                expect(p.checkNotParent(d.tables.tab5, new Set())).toBeFalsy();
                expect(p.checkNotParent(d.tables.tab5, createSet("tab6"))).toBeTruthy();
                expect(p.checkNotParent(d.tables.tab10, new Set())).toBeTruthy();
                expect(p.checkNotParent(d.tables.tab10, createSet("tab11"))).toBeTruthy();
                expect(p.checkNotParent(d.tables.tab1, new Set())).toBeFalsy();
                expect(p.checkNotParent(d.tables.tab1, createSet("tab2"))).toBeTruthy();
                d.tables.tab2.clear();
                expect(p.checkNotParent(d.tables.tab1, new Set())).toBeTruthy();
                d.tables.tab5.acceptChanges();
                expect(p.checkNotParent(d.tables.tab4, new Set())).toBeFalsy();
                d.tables.tab5.clear();
                expect(p.checkNotParent(d.tables.tab4, new Set())).toBeTruthy();
            });
            it('checkIsNotChild should return not-childs', function () {
                d.tables['tab4'].acceptChanges();
                d.tables['tab6'].acceptChanges();
                d.tables['tab8'].acceptChanges();
                d.tables['tab9'].acceptChanges();
                const i = 0;
                d.tables['tab4'].rows[0].getRow().del();
                d.tables['tab4'].rows[1].getRow().del();
                d.tables['tab4'].rows[2].getRow().del();
                d.tables['tab4'].rows[3].getRow().del();
                d.tables['tab4'].rows[4].getRow().del();

                d.tables['tab8'].rows[0].getRow().del();
                d.tables['tab8'].rows[1].getRow().del();
                d.tables['tab8'].rows[2].data8 = 'hi';
                d.tables['tab8'].rows[4].data8 = 'hi';

                d.tables['tab9'].rows[1].data9 = 'sayonara';
                d.tables['tab9'].rows[2].data9 = 'sayonara';

                const p = new SinglePostData();
                expect(p.checkNotChild(d.tables.tab4, new Set())).toBeFalsy();
                expect(p.checkNotChild(d.tables.tab4, createSet("tab3"))).toBeTruthy();
                expect(p.checkNotChild(d.tables.tab5, new Set())).toBeFalsy();
                expect(p.checkNotChild(d.tables.tab5, createSet("tab4"))).toBeTruthy();
                expect(p.checkNotChild(d.tables.tab10, new Set())).toBeFalsy();
                expect(p.checkNotChild(d.tables.tab10, createSet("tab9"))).toBeTruthy();
                expect(p.checkNotChild(d.tables.tab1, new Set())).toBeTruthy();
                expect(p.checkNotChild(d.tables.tab1, createSet("tab2"))).toBeTruthy();
                d.tables.tab9.acceptChanges();
                expect(p.checkNotChild(d.tables.tab10, new Set())).toBeTruthy();
                d.tables.tab3.acceptChanges();
                expect(p.checkNotChild(d.tables.tab4, new Set())).toBeTruthy();
                d.tables.tab3.clear();
                expect(p.checkNotChild(d.tables.tab4, new Set())).toBeTruthy();
            });
            it('sortTables should work called with checkIsNotChild', function () {
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                const i = 0;
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[1].getRow().del();
                d.tables.tab4.rows[2].getRow().del();
                d.tables.tab4.rows[3].getRow().del();
                d.tables.tab4.rows[4].getRow().del();

                d.tables.tab8.rows[0].getRow().del();
                d.tables.tab8.rows[1].getRow().del();
                d.tables.tab8.rows[2].data8 = 'hi';
                d.tables.tab8.rows[4].data8 = 'hi';

                d.tables.tab9.rows[1].data9 = 'sayonara';
                d.tables.tab9.rows[2].data9 = 'sayonara';
                const p = new SinglePostData(),
                    res = p.sortTables(d, p.checkNotChild);
                // tab 10, 9, 8 are children. Tab7 is not because tab6 is unchanged
                //we have inserted tables in reverse order so tab7 comes before than tab1. After putting tab7, comes
                // tab8 because at that point, tab7 is an allowed parent. Also comes tab2, because tab1 is allowed as
                // parent at that point. Then come tab9 and tab3 because tab2 and tab8 are then allowed parents.
                // Then come tab10 and tab4, then tab5 and finally tab6.
                expect(_.map(res, 'name')).toEqual(['tab7', 'tab1', 'tab8', 'tab2', 'tab9', 'tab3', 'tab10', 'tab4', 'tab5', 'tab6']);

            });
            it('sortTables should work called with checkNotParent', function () {
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                const i = 0;
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[1].getRow().del();
                d.tables.tab4.rows[2].getRow().del();
                d.tables.tab4.rows[3].getRow().del();
                d.tables.tab4.rows[4].getRow().del();
                d.tables.tab5.clear();
                d.tables.tab8.rows[0].getRow().del();
                d.tables.tab8.rows[1].getRow().del();
                d.tables.tab8.rows[2].data8 = 'hi';
                d.tables.tab8.rows[4].data8 = 'hi';

                d.tables.tab9.rows[1].data9 = 'sayonara';
                d.tables.tab9.rows[2].data9 = 'sayonara';
                const p = new SinglePostData(),
                    res = p.sortTables(d, p.checkNotParent);
                // tab 10 is not parent, then comes tab 9 cause tab10 now is an allowed parent then tab8 and so on
                expect(_.map(res, 'name')).toEqual(['tab10', 'tab9', 'tab8', 'tab7', 'tab6', 'tab5', 'tab4', 'tab3', 'tab2', 'tab1']);

            });
            it('sortTables should work called with checkNotParent (2th set)', function () {
                d.newRelation('rel000', 'tab6', 'extid6', 'tab3', 'id3');
                d.newRelation('rel001', 'tab10', 'extid1', 'tab1', 'id1');
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                const i = 0;
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[1].getRow().del();
                d.tables.tab4.rows[2].getRow().del();
                d.tables.tab4.rows[3].getRow().del();
                d.tables.tab4.rows[4].getRow().del();
                d.tables.tab5.clear();
                d.tables.tab8.rows[0].getRow().del();
                d.tables.tab8.rows[1].getRow().del();
                d.tables.tab8.rows[2].data8 = 'hi';
                d.tables.tab8.rows[4].data8 = 'hi';

                d.tables.tab9.rows[1].data9 = 'sayonara';
                d.tables.tab9.rows[2].data9 = 'sayonara';
                const p = new SinglePostData(),
                    res = p.sortTables(d, p.checkNotParent);
                //they are all parents but tab4 because tab5 is empty. So then tab4 becomes an allowed parent and tab3 can follow
                // then tab2 and tab1. At this point, tab1 is an allowed parent for tab10 so comes tab10, then tab8,tab7,6,5
                expect(_.map(res, 'name')).toEqual(['tab4', 'tab3', 'tab2', 'tab1', 'tab10', 'tab9', 'tab8', 'tab7', 'tab6', 'tab5']);

            });
            it('insert on parents should precede insert on child', function () {
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[1].getRow().del();
                d.tables.tab4.rows[2].getRow().del();
                d.tables.tab4.rows[3].getRow().del();
                d.tables.tab4.rows[4].getRow().del();
                d.tables.tab5.clear();
                d.tables.tab8.rows[0].getRow().del();
                d.tables.tab8.rows[1].getRow().del();
                d.tables.tab8.rows[2].data8 = 'hi';
                d.tables.tab8.rows[4].data8 = 'hi';

                d.tables.tab9.rows[1].data9 = 'sayonara';
                d.tables.tab9.rows[2].data9 = 'sayonara';
                let i = 0,
                    j;
                const p = new SinglePostData(),
                    res = p.getChanges(d),
                    childFirst = _.map(p.sortTables(d, p.checkNotParent), 'name'),
                    parentFirst = _.map(p.sortTables(d, p.checkNotChild), 'name');


                for (i = 0; i < res.length; i++) {
                    if (res[i].getRow().state !== dataRowState.added) {
                        continue;
                    }
                    for (j = i + 1; j < res.length; j++) {
                        if (res[j].getRow().state !== dataRowState.added) {
                            continue;
                        }
                        const posI = _.indexOf(parentFirst, res[i].tabRif),
                            posJ = _.indexOf(parentFirst, res[j].tabRif);

                        expect(posI >= 0).toBeTruthy();
                        expect(posJ >= 0).toBeTruthy();
                        expect(posI <= posJ).toBeTruthy();
                    }
                }
            });
            it('deletes on child should precede deletes on parent', function () {
                d.tables.tab4.acceptChanges();
                d.tables.tab6.acceptChanges();
                d.tables.tab8.acceptChanges();
                d.tables.tab9.acceptChanges();
                let i = 0;
                d.tables.tab4.rows[0].getRow().acceptChanges();
                d.tables.tab4.rows[1].getRow().acceptChanges();
                d.tables.tab4.rows[4].getRow().acceptChanges();
                d.tables.tab4.rows[0].getRow().del();
                d.tables.tab4.rows[1].getRow().del();
                d.tables.tab4.rows[4].getRow().del();

                d.tables.tab3.rows[0].getRow().acceptChanges();
                d.tables.tab3.rows[1].getRow().acceptChanges();
                d.tables.tab3.rows[3].getRow().acceptChanges();
                d.tables.tab3.rows[4].getRow().acceptChanges();
                d.tables.tab3.rows[0].getRow().del();
                d.tables.tab3.rows[1].getRow().del();
                d.tables.tab3.rows[3].getRow().del();
                d.tables.tab3.rows[4].getRow().del();


                d.tables.tab5.rows[0].getRow().acceptChanges();
                d.tables.tab5.rows[1].getRow().acceptChanges();
                d.tables.tab5.rows[0].getRow().del();
                d.tables.tab5.rows[1].getRow().del();

                d.tables['tab8'].rows[0].getRow().del();
                d.tables['tab8'].rows[1].getRow().del();
                d.tables['tab8'].rows[2].data8 = 'hi';
                d.tables['tab8'].rows[4].data8 = 'hi';

                d.tables['tab9'].rows[1].data9 = 'sayonara';
                d.tables['tab9'].rows[2].data9 = 'sayonara';
                let j;
                const p = new SinglePostData(),
                    res = p.getChanges(d),
                    childFirst = _.map(p.sortTables(d, p.checkNotParent), 'name'),
                    parentFirst = _.map(p.sortTables(d, p.checkNotChild), 'name');

                for (i = 0; i < res.length; i++) {
                    if (res[i].getRow().state !== dataRowState.deleted) {
                        continue;
                    }
                    for (j = i + 1; j < res.length; j++) {
                        if (res[j].getRow().state !== dataRowState.deleted) {
                            continue;
                        }

                        const posI = _.indexOf(childFirst, res[i].tabRif),
                            posJ = _.indexOf(childFirst, res[j].tabRif);

                        expect(posI >= 0).toBeTruthy();
                        expect(posJ >= 0).toBeTruthy();
                        expect(posI <= posJ).toBeTruthy();
                    }
                }
            });
            it('insert on parents should precede insert on child', function () {
                    d.tables.tab4.acceptChanges();
                    d.tables.tab6.acceptChanges();
                    d.tables.tab8.acceptChanges();
                    d.tables.tab9.acceptChanges();
                    d.tables.tab4.rows[0].getRow().del();
                    d.tables.tab4.rows[1].getRow().del();
                    d.tables.tab4.rows[2].getRow().del();
                    d.tables.tab4.rows[3].getRow().del();
                    d.tables.tab4.rows[4].getRow().del();
                    d.tables.tab5.clear();
                    d.tables.tab8.rows[0].getRow().del();
                    d.tables.tab8.rows[1].getRow().del();
                    d.tables.tab8.rows[2].data8 = 'hi';
                    d.tables.tab8.rows[4].data8 = 'hi';

                    d.tables.tab9.rows[1].data9 = 'sayonara';
                    d.tables.tab9.rows[2].data9 = 'sayonara';
                    let i = 0,
                        j;
                    const p = new SinglePostData(),
                        res = p.getChanges(d),
                        childFirst = _.map(p.sortTables(d, p.checkNotParent), 'name'),
                        parentFirst = _.map(p.sortTables(d, p.checkNotChild), 'name');


                    for (i = 0; i < res.length; i++) {
                        if (res[i].getRow().state === dataRowState.deleted) {
                            continue;
                        }
                        for (j = i + 1; j < res.length; j++) {
                            if (res[j].getRow().state !== dataRowState.deleted) {
                                continue;
                            }
                            expect(true).toBeFalsy(); //should not reach here
                        }
                    }
                    expect(true).toBeTrue();
                });

        });

        describe('MaxCacher', function () {
            let DAC, env;
            beforeEach(function (done) {
                DAC = undefined;
                env = new Environment();

                dbList.getDataAccess('testPostData')
                    .done(function (conn) {
                        DAC = conn;
                        done();
                    })
                    .fail(function (err) {
                        done();
                    });
            });

            it('new MaxCacher(conn,environment) should return a class', function () {
                const M = new MaxCacher(DAC, env);
                expect(M).toEqual(jasmine.any(MaxCacher));
            });
            it('getHash should return a string', function () {
                const M = new MaxCacher(DAC, env);
                expect(M.getHash).toEqual(jasmine.any(Function));
                expect(M.getHash()).toEqual(jasmine.any(String));
            });

            it('getHash should return a string different if parameters are different', function () {
                const M = new MaxCacher(DAC, env);
                const table = 'operator',
                    column = 'noperator',
                    filter = dq.eq('year', 2014),
                    expr = dq.max('noperator'),
                    expr2 = dq.max('anotherfield'),
                    filter2 = dq.eq('year', 2013),
                    column2 = 'anotherid',
                    table2 = 'anothertable',
                    hash1 = M.getHash(table, column, filter, expr),
                    hash2 = M.getHash(table2, column, filter, expr),
                    hash3 = M.getHash(table, column2, filter, expr),
                    hash4 = M.getHash(table, column, filter2, expr),
                    hash5 = M.getHash(table, column, filter, expr2);
                expect(hash1).not.toEqual(hash2);
                expect(hash1).not.toEqual(hash3);
                expect(hash1).not.toEqual(hash4);
                expect(hash1).not.toEqual(hash5);
            });

            it('getMax should call conn.readSingleValue null when there is no selector', function (done) {
                const M = new MaxCacher(DAC, env);
                const table = 'operator',
                    column = 'noperator',
                    filter = dq.eq('year', 2014),
                    expr = dq.max('noperator'),
                    ds = new DataSet('d'),
                    t = ds.newTable('operator'),
                    r = t.newRow({});
                spyOn(DAC, 'readSingleValue').and.callFake(function () {
                    const def = Deferred().resolve(1);
                    return def.promise();
                });
                M.getMax(r, column, null, filter, expr)
                    .done(function (res) {
                        expect(DAC.readSingleValue).toHaveBeenCalled();
                        expect(res).toBe(1);
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

            it('getMax should not call conn.readSingleValue null when there is no selector the 2th time is called',
                function (done) {
                    const M = new MaxCacher(DAC, env);
                    const table = 'operator',
                        column = 'noperator',
                        filter = dq.eq('year', 2014),
                        expr = dq.max('noperator'),
                        ds = new DataSet('d'),
                        t = ds.newTable('operator'),
                        r = t.newRow({});
                    let n = 0;
                    spyOn(DAC, 'readSingleValue').and.callFake(function () {
                        const def = Deferred().resolve(++n);
                        return def.promise();
                    });
                    M.getMax(r, column, null, filter, expr)
                        .done(function (res) {
                            expect(res).toBe(1);
                            expect(DAC.readSingleValue.calls.count()).toEqual(1);
                            M.getMax(r, column, null, filter, expr)
                                .done(function (res) {
                                    expect(res).toBe(1);
                                    expect(DAC.readSingleValue.calls.count()).toEqual(1);
                                })
                                .fail(function (err) {
                                    expect(err).toBeUndefined();
                                    done();
                                });
                            done();
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            done();
                        });
                });

            it('getMax should call conn.readSingleValue  when there is selector but parent not added', function (done) {
                const M = new MaxCacher(DAC, env);
                const table = 'operator',
                    column = 'noperator',
                    filter = dq.eq('year', 2014),
                    expr = dq.max('noperator'),
                    ds = new DataSet('d'),
                    parent = ds.newTable('parent'),
                    t = ds.newTable('operator'),
                    rParent = parent.newRow({idparent: 1}),
                    rChild = t.newRow({idparent: 1});
                parent.acceptChanges();
                parent.key(['idparent']);
                t.key(['idoperator', 'idparent']);
                ds.newRelation('r', 'parent', ['idparent'], 'operator', ['idparent']);
                spyOn(DAC, 'readSingleValue').and.callFake(function () {
                    const def = Deferred().resolve(1);
                    return def.promise();
                });
                M.getMax(rChild, column, null, filter, expr)
                    .done(function (res) {
                        expect(DAC.readSingleValue).toHaveBeenCalled();
                        expect(res).toBe(1);
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

            it('getMax SHOULD call relation.getParents  when there is selector but parent not added', function (done) {
                const M = new MaxCacher(DAC, env);
                const table = 'operator',
                    column = 'noperator',
                    filter = dq.eq('year', 2014),
                    expr = dq.max('noperator'),
                    ds = new DataSet('d');
                let rel;
                const parent = ds.newTable('parent'),
                    t = ds.newTable('operator'),
                    rParent = parent.newRow({idparent: 1}),
                    rChild = t.newRow({idparent: 1});
                parent.acceptChanges();
                parent.key(['idparent']);
                t.key(['idoperator', 'idparent']);
                rel = ds.newRelation('r', 'parent', ['idparent'], 'operator', ['idparent']);
                spyOn(rel, 'getParents').and.callThrough();
                spyOn(DAC, 'readSingleValue').and.callFake(function () {
                    const def = Deferred().resolve(1);
                    return def.promise();
                });
                M.getMax(rChild, column, ['idparent'], filter, expr)
                    .done(function (res) {
                        expect(rel.getParents).toHaveBeenCalled();
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

            it('getMax SHOULD NOT call relation.getParents  when there is selector but parent not added - 2th call in a row',
                function (done) {
                    const M = new MaxCacher(DAC, env);
                    const table = 'operator',
                        column = 'noperator',
                        filter = dq.eq('year', 2014),
                        expr = dq.max('noperator'),
                        ds = new DataSet('d');
                    let rel;
                    const parent = ds.newTable('parent'),
                        t = ds.newTable('operator'),
                        rParent = parent.newRow({idparent: 1}),
                        rChild = t.newRow({idparent: 1});
                    parent.acceptChanges();
                    parent.key(['idparent']);
                    t.key(['idoperator', 'idparent']);
                    rel = ds.newRelation('r', 'parent', ['idparent'], 'operator', ['idparent']);
                    spyOn(rel, 'getParents').and.callThrough();
                    spyOn(DAC, 'readSingleValue').and.callFake(function () {
                        const def = Deferred().resolve(1);
                        return def.promise();
                    });
                    M.getMax(rChild, column, ['idparent'], filter, expr)
                        .done(function (res) {
                            expect(rel.getParents.calls.count()).toEqual(1);
                            M.getMax(rChild, column, ['idparent'], filter, expr)
                                .done(function (res) {
                                    expect(rel.getParents.calls.count()).toEqual(1);
                                    done();
                                })
                                .fail(function (err) {
                                    expect(err).toBeUndefined();
                                    done();
                                });
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            done();
                        });
                });


            it('getMax should NOT call conn.readSingleValue  when there is selector and parent ' +
                'is added and autoincrement',
                function (done) {
                    const M = new MaxCacher(DAC, env);
                    const table = 'operator',
                        column = 'noperator',
                        filter = dq.eq('year', 2014),
                        expr = dq.max('noperator'),
                        ds = new DataSet('d');
                    let rel;
                    const parent = ds.newTable('parent'),
                        t = ds.newTable('operator'),
                        rParent = parent.newRow({idparent: 1}),
                        rChild = t.newRow({idparent: 1});
                    parent.key(['idparent']);
                    t.key(['idoperator', 'idparent']);
                    parent.autoIncrement('idparent', {});
                    //t.autoIncrement('noperator', {selector:['idparent']}); //not necessary for the test
                    rel = ds.newRelation('r', 'parent', ['idparent'], 'operator', ['idparent']);
                    const parRel = rel.getParentsFilter(rChild);
                    spyOn(DAC, 'readSingleValue').and.callFake(function () {
                        const def = Deferred().resolve(1);
                        return def.promise();
                    });
                    M.getMax(rChild, column, ['idparent'], filter, expr)
                        .done(function (res) {
                            expect(DAC.readSingleValue).not.toHaveBeenCalled();
                            expect(res).toBe(null);
                            done();
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            done();
                        });
                });


            it('getMax SHOULD call conn.readSingleValue  when there is selector and parent ' +
                'is added but NOT autoincrement',
                function (done) {
                    const M = new MaxCacher(DAC, env);
                    const table = 'operator',
                        column = 'noperator',
                        filter = dq.eq('year', 2014),
                        expr = dq.max('noperator'),
                        ds = new DataSet('d');
                    let rel;
                    const parent = ds.newTable('parent'),
                        t = ds.newTable('operator'),
                        rParent = parent.newRow({idparent: 1}),
                        rChild = t.newRow({idparent: 1});
                    parent.key(['idparent']);
                    t.key(['idoperator', 'idparent']);
                    //parent.autoIncrement('idparent', {});
                    //t.autoIncrement('noperator', {selector:['idparent']}); //not necessary for the test
                    rel = ds.newRelation('r', 'parent', ['idparent'], 'operator', ['idparent']);
                    const parRel = rel.getParentsFilter(rChild);
                    spyOn(DAC, 'readSingleValue').and.callFake(function () {
                        const def = Deferred().resolve(100);
                        return def.promise();
                    });
                    M.getMax(rChild, column, ['idparent'], filter, expr)
                        .done(function (res) {
                            expect(DAC.readSingleValue).toHaveBeenCalled();
                            expect(res).toBe(100);
                            done();
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            done();
                        });
                });

            it('getMax SHOULD call conn.readSingleValue  when there is selector and parent ' +
                'is autoincrement but NOT added',
                function (done) {
                    const M = new MaxCacher(DAC, env);
                    const table = 'operator',
                        column = 'noperator',
                        filter = dq.eq('year', 2014),
                        expr = dq.max('noperator'),
                        ds = new DataSet('d');
                    let rel;
                    const parent = ds.newTable('parent'),
                        t = ds.newTable('operator'),
                        rParent = parent.newRow({idparent: 1}),
                        rChild = t.newRow({idparent: 1});
                    parent.key(['idparent']);
                    parent.acceptChanges();
                    t.key(['idoperator', 'idparent']);
                    parent.autoIncrement('idparent', {});
                    //t.autoIncrement('noperator', {selector:['idparent']}); //not necessary for the test
                    rel = ds.newRelation('r', 'parent', ['idparent'], 'operator', ['idparent']);
                    const parRel = rel.getParentsFilter(rChild);
                    spyOn(DAC, 'readSingleValue').and.callFake(function () {
                        const def = Deferred().resolve(100);
                        return def.promise();
                    });
                    M.getMax(rChild, column, ['idparent'], filter, expr)
                        .done(function (res) {
                            expect(DAC.readSingleValue).toHaveBeenCalled();
                            expect(res).toBe(100);
                            done();
                        })
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            done();
                        });
                });
        });

        describe('doPost', function () {
            let DAC,
                env,
                ctx,
                postData,
                d,
                changes;

            beforeEach(function (done) {
                let rowCount, row, i, t;
                const d = new DataSet('d');

                i = 11;
                while (--i > 0) {
                    t = d.newTable('tab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d.newRelation('r' + i + 'a', 'tab' + i, ['idExt' + (i + 1)], 'tab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }


                getContext('testPostData', 'nino', 'default', '2014', new Date(2014, 1, 20, 10, 10, 10, 0))
                    .done(function (context) {
                        DAC = context.dataAccess;
                        ctx = context;
                        env = ctx.environment;
                        spyOn(DAC, 'close').and.callThrough();
                        postData = new PostData();
                        postData.init(d, ctx).then(() => {
                            done();
                        });
                    })
                    .fail(function (err) {
                        done();
                    });
            });


            it('should return an instance of a PostData ', function () {
                expect(postData).toEqual(jasmine.any(PostData));
            });

            it('should return a resolved promise to {checks:[]} when called with no change ', function () {
                postData.allPost[0].rowChanges = [];
                postData.doPost({})
                    .done(function (res) {
                        expect(res.checks).toEqual([]);
                        expect(DAC.isOpen).toBeFalsy();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    });
            });

            it('should call opt.callChecks when there is something to save', function (done) {
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };


                postData.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    res.addError("code0");
                    //{checks: [{code: errNum}], shouldContinue: false};
                    def.resolve(res);
                    //console.log('returning checks:'+res);
                    return def.promise();
                };

                spyOn(postData, 'getChecks').and.callThrough();
                expect(postData.getChecks).not.toHaveBeenCalled();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(postData.getChecks).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should append error got from callChecks to output errors', function (done) {

                let errNum = 12;
                let check = null;
                postData.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    check = res.addError("code" + errNum);
                    //{checks: [{code: errNum}], shouldContinue: false};
                    errNum += 1;
                    def.resolve(res);
                    //console.log('returning checks:'+res);
                    return def.promise();
                };
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(postData, 'getChecks').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(res.checks).toContain(check);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should call open and begin transaction if prechecks did not return errors', function (done) {

                //simula la restituzione di un oggetto che implementa l'interfaccia IBusinessLogic
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("code" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                let errNum = 12;
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(postData.allPost[0].physicalPostBatch).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });


            it('should NOT call physicalPostBatch if prechecks returned errors', function (done) {

                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addError("code" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(1).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(postData.allPost[0].physicalPostBatch).not.toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            }, 5000);

            it('should NOT call physicalPostBatch if prechecks throws', function (done) {

                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        throw "Exception threw on purpose";
                    }
                };
                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {

                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(1).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(postData.allPost[0].physicalPostBatch).not.toHaveBeenCalled();
                        expect(_.find(res.checks, {msg:"Exception threw on purpose",canIgnore: false})).toBeDefined();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            }, 5000);

            it('should call physicalPostBatch if prechecks returns warnings', function (done) {

                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("code" + errNum, post);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'rollback').and.callThrough();
                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.allPost[0].physicalPostBatch).toHaveBeenCalled();
                        let warn12 = new BasicMessage("code12", true);
                        warn12.post = false;
                        expect(res.checks).toContain(warn12);
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            }, 5000);

            it('should call opt.log if physicalPostBatch is resolved and opt.log is given', function (done) {

                let errNum = 12;
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                spyOn(postData.allPost[0], 'log').and.callThrough();
                spyOn(DAC, 'commit').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.allPost[0].log.calls.count()).toBe(1);
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.commit).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call getChecks(post) if given opt.log rejects his promise', function (done) {

                let errNum = 12;
                let warn = null;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        warn = res.addWarning("code" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                postData.allPost[0].log = function (conn, changes) {
                    const def = Deferred();
                    def.reject('log reject');
                    return def.promise();
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postData.allPost[0], 'log').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(postData.allPost[0].log.calls.count()).toBe(1);
                        expect(res.checks.find(c => c.msg === "log reject" && c.canIgnore === false)).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call getChecks(post) if given opt.log throws', function (done) {

                let errNum = 12;
                let warn = null;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        warn = res.addWarning("code" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                postData.allPost[0].log = function (conn, changes) {
                    throw  "Exception raised on purpose";
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postData.allPost[0], 'log').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(postData.allPost[0].log.calls.count()).toBe(1);
                        expect(res.checks.find(c => c.msg === "Exception raised on purpose" && c.canIgnore === false)).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should call postChecks if physicalPostBatch is resolved', function (done) {

                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("code" + errNum, post);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };


                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(2);
                        expect(_.find(res.checks,{msg:"code12",canIgnore:true,post:false})).toBeDefined();
                        expect(_.find(res.checks, {msg:"code13",canIgnore:true,post:true})).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call postChecks if physicalPostBatch is rejected', function (done) {

                let errNum = 12;

                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        let check = res.addWarning("code" + errNum, post);
                        check.post = post;
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.reject('physicalPostBatch fake error');
                    return def.promise();
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(_.find(res.checks,_.extend(new BasicMessage("code12", true), {post: false})))
                            .toBeDefined();
                        expect(_.find(res.checks,_.extend(new BasicMessage("code12", true), {post: true})))
                            .toBeUndefined();
                        //expect(_.find(res.checks,new BasicMessage("code12", true))).toBeUndefined();
                        expect(_.find(res.checks, {msg:"physicalPostBatch fake error",canIgnore:false})).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should return some error if physicalPostBatch throws  ', function (done) {

                let errNum = 12;

                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        let check = res.addWarning("code" + errNum, post);
                        check.post = post;
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    throw "DataBase Error threw on purpose";
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(res.checks).toContain(_.extend(new BasicMessage("code12", true), {post: false}));
                        expect(res.checks).not.toContain(_.extend(new BasicMessage("code12", true), {post: true}));
                        expect(_.find(res.checks,{msg:"DataBase Error threw on purpose",canIgnore: false}))
                                    .toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });


            it('should NOT call opt.doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are msgs',
                function (done) {

                    let errNum = 12;

                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("code" + errNum);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });


                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].physicalPostBatch).toHaveBeenCalled();
                            expect(postData.allPost[0].doUpdate).not.toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.close.calls.count()).toBe(1);
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.rollback.calls.count()).toBe(1);
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are no checks',
                function (done) {

                    let errNum = 12;

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].doUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });


            it('should  call opt.doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are checks' +
                ' but they were already present 3',
                function (done) {
                    let errNum = 12;
                    let rules = new BusinessLogicResult();
                    rules.addWarning("code12", false);
                    rules.addWarning("code13", true);

                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("code" + errNum, post);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: rules
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(rules, 'mergeMessages').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(rules.mergeMessages).toHaveBeenCalled();
                            expect(postData.allPost[0].doUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call commit if optional doUpdate resolves',
                function (done) {
                    let errNum = 12;


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function () {
                            //console.log(res);
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if optional doUpdate returns msgs',
                function (done) {
                    let errNum = 12;
                    let check = null;

                    postData.allPost[0].doUpdate = function (conn, res) {
                        const def = Deferred();
                        check = res.addWarning('another doUpdate fake error by addWarning');
                        return def.resolve().promise();
                    };


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(res.checks).toContain(check);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if optional doUpdate is rejected',
                function (done) {

                    postData.allPost[0].doUpdate = function (conn, res) {
                        const def = Deferred();
                        def.reject('another doUpdate fake error by reject');
                        return def.promise();
                    };

                    let errNum = 12;
                    let check = null;
                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(res.checks.filter(c => c.msg === "another doUpdate fake error by reject").length).toBe(1);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call commit  if optional doUpdate is rejected with a previously ignored message 2',
                function (done) {
                    var result = new BusinessLogicResult();
                    const err1 = "another doUpdate fake error";
                    const err2 = "another random fake error A";
                    result.addWarning(err1, false);
                    result.addWarning(err2, true);
                    let check1, check2;
                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            check1 = res.addWarning(err1, post);
                            def.resolve(res);
                            return def.promise();
                        }
                    };

                    postData.allPost[0].doUpdate = function (conn, res) {
                        check2 = res.addWarning(err2, true);
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: result

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.rollback).not.toHaveBeenCalled();
                            expect(res.checks.length).toBe(0);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollback  if optional doUpdate is gives a blocking error previously present as warning',
                function (done) {
                    var result = new BusinessLogicResult();
                    const err1 = "another random fake error";
                    const err2 = "another doUpdate fake error";
                    result.addWarning(err1);
                    result.addWarning(err2);
                    let check1, check2;
                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            check1 = res.addWarning(err1);
                            def.resolve(res);
                            return def.promise();
                        }
                    };


                    postData.allPost[0].doUpdate = function (conn, result) {
                        const def = Deferred();
                        check2 = result.addError(err2);
                        def.resolve(result);
                        return def.promise();
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: result

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(res.checks).toContain(check1);
                            expect(res.checks).toContain(check2);
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if physicalPostBatch is rejected',
                function (done) {

                    let errNum = 12;
                    let check = null;
                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            check = res.addWarning("code" + errNum);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.reject('physicalPostBatch fake error');
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].doUpdate).not.toHaveBeenCalled();
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(res.checks).toContain(check);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });
        });

        describe('getSqlStatements', function () {
            let ctx, DAC,
                env,
                conn,
                postData,
                d,
                optimisticLocking,
                changes;

            beforeEach(function (done) {
                let rowCount, row, i, t;
                const d = new DataSet('d');

                i = 11;
                while (--i > 0) {
                    t = d.newTable('tab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d.newRelation('r' + i + 'a', 'tab' + i, ['idExt' + (i + 1)], 'tab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }
                optimisticLocking = new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']);

                getContext('testPostData', 'nino', 'default', '2014', new Date(2014, 1, 20, 10, 10, 10, 0))
                    .done(function (context) {
                        DAC = context.dataAccess;
                        ctx = context;
                        env = ctx.environment;
                        conn = DAC.sqlConn;
                        spyOn(DAC, 'close').and.callThrough();
                        postData = new PostData();
                        postData.init(d, ctx).then(() => {
                            changes = postData.allPost[0].rowChanges;
                            done();
                        });
                    })
                    .fail(function (err) {
                        done();
                    });


            });

            it('should be a function', function () {
                expect(postData.allPost[0].getSqlStatements).toEqual(jasmine.any(Function));
                expect(postData.allPost[0].sqlConn).toBe(conn);
            });

            it('should call calcAllAutoId for every given row', function (done) {
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    def.resolve(false);
                    return def.promise();
                });
                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].getSqlStatements(changes, optimisticLocking)
                    .done(function (res) {
                        expect(postData.allPost[0].calcAllAutoId).toHaveBeenCalled();
                        expect(postData.allPost[0].calcAllAutoId.calls.count()).toBe(changes.length);
                        done();
                    });
            });

            it('should call calcAllAutoId one at a time', function (done) {
                let overlap = false, isIn = false;
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    if (isIn) {
                        overlap = true;
                    }
                    isIn = true;
                    const def = Deferred();
                    process.nextTick(function () {
                        isIn = false;
                        def.resolve(false);
                    });

                    return def.promise();
                });
                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].getSqlStatements(changes, optimisticLocking)
                    .done(function (res) {
                        expect(postData.allPost[0].calcAllAutoId).toHaveBeenCalled();
                        expect(postData.allPost[0].calcAllAutoId.calls.count()).toBe(changes.length);
                        expect(overlap).toBeFalsy();
                        done();
                    });
            });

            it('if calcAllAutoId one does fail, should reject request and stop', function (done) {
                let overlap = false, isIn = false, nRows = 0;
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    if (isIn) {
                        overlap = true;
                    }
                    const def = Deferred();
                    if (nRows === 5) {
                        def.reject('some reasons');
                        return def.promise();
                    }
                    isIn = true;
                    process.nextTick(function () {
                        isIn = false;
                        nRows += 1;
                        def.resolve(false);
                    });

                    return def.promise();
                });
                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].getSqlStatements(changes, optimisticLocking)
                    .done(function (res) {
                        expect(true).toBeFalsy();
                        done();
                    })
                    .fail(function (err) {
                        expect(postData.allPost[0].calcAllAutoId).toHaveBeenCalled();
                        expect(postData.allPost[0].calcAllAutoId.calls.count()).toBe(6);
                        expect(overlap).toBeFalsy();
                        done();
                    });
            });


            it('should call DAC.getPostCommand and giveErrorNumberDataWasNotWritten for every given row', function (done) {
                let countCommands = 0;
                spyOn(DAC, 'getPostCommand').and.callFake(function (row, locking, env) {
                    const def = Deferred();
                    countCommands += 1;
                    def.resolve('fake sql' + countCommands);
                    return def.promise();
                });
                spyOn(conn, 'giveErrorNumberDataWasNotWritten').and.callThrough();

                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });

                //console.log('from now is the time')
                postData.allPost[0].getSqlStatements(changes, optimisticLocking)
                    .done(function (res) {
                        expect(DAC.getPostCommand).toHaveBeenCalled();
                        expect(DAC.getPostCommand.calls.count()).toBe(changes.length);
                        expect(conn.giveErrorNumberDataWasNotWritten).toHaveBeenCalled();
                        expect(conn.giveErrorNumberDataWasNotWritten.calls.count()).toBe(changes.length);
                        done();
                    });
            });

            it('should call appendCommands for every given row ', function (done) {
                let nRows = 0;
                let countCommands = 0;
                spyOn(DAC, 'getPostCommand').and.callFake(function (row, locking, env) {
                    const def = Deferred();
                    countCommands += 1;
                    const sql = 'fake sql' + countCommands;
                    def.resolve(sql);
                    return def.promise();
                });
                spyOn(conn, 'appendCommands').and.callThrough();
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    process.nextTick(function () {
                        nRows += 1;
                        def.resolve(false);
                    });

                    return def.promise();
                });

                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = new Deferred();
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].getSqlStatements(changes, optimisticLocking)
                    .done(function (res) {
                        expect(conn.appendCommands).toHaveBeenCalled();
                        expect(conn.appendCommands.calls.count()).toBe(changes.length);
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

            it('should call appendCommands for every given row  (all single sql commands)', function (done) {
                let nRows = 0;
                let countCommands = 0;
                const expectedSql = [],
                    results = [];
                spyOn(DAC, 'getPostCommand').and.callFake(function (row, locking, env) {
                    countCommands += 1;
                    const sql = 'fake sql' + countCommands;
                    expectedSql.push(sql);
                    return sql;
                });
                spyOn(conn, 'appendCommands').and.callThrough();
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    process.nextTick(function () {
                        nRows += 1;
                        def.resolve(true);
                    });

                    return def.promise();
                });

                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].getSqlStatements(changes, optimisticLocking)
                    .progress(function (rows, sql) {
                        results.push({rows: rows, sql: sql});
                    })
                    .done(function (res) {
                        expect(conn.appendCommands).toHaveBeenCalled();
                        expect(conn.appendCommands.calls.count()).toBe(changes.length);
                        expect(results.length).toBeGreaterThan(0);
                        _.forEach(expectedSql, function (sql) {
                            expect(_.find(results, function (el) {
                                //console.log(el);
                                return el.sql.indexOf(sql) >= 0;
                            })).toBeDefined();
                        });
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

            it('should call appendCommands for every given row (grouped sql commands)', function (done) {
                let nRows = 0;
                let countCommands = 0;
                const expectedSql = [],
                    results = [];
                spyOn(DAC, 'getPostCommand').and.callFake(function (row, locking, env) {
                    countCommands += 1;
                    const sql = 'fake sql' + countCommands;
                    expectedSql.push(sql);
                    return sql;
                });
                spyOn(conn, 'appendCommands').and.callThrough();
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    process.nextTick(function () {
                        nRows += 1;
                        def.resolve(false);
                    });

                    return def.promise();
                });

                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].getSqlStatements(changes, optimisticLocking)
                    .progress(function (rows, sql) {
                        results.push({rows: rows, sql: sql});
                    })
                    .done(function (res) {
                        expect(conn.appendCommands).toHaveBeenCalled();
                        expect(conn.appendCommands.calls.count()).toBe(changes.length);
                        expect(results.length).toBeGreaterThan(1);
                        _.forEach(expectedSql, function (sql) {
                            expect(_.find(results, function (el) {
                                //console.log(el);
                                return el.sql.indexOf(sql) >= 0;
                            })).toBeDefined();
                        });
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

        });

        describe('physicalPostBatch', function () {
            let ctx,
                DAC, conn,
                env,
                postData,
                d,
                optimisticLocking,
                changes;

            beforeEach(function (done) {
                let rowCount, row, i, t;
                const d = new DataSet('d');

                i = 11;
                while (--i > 0) {
                    t = d.newTable('tab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d.newRelation('r' + i + 'a', 'tab' + i, ['idExt' + (i + 1)], 'tab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }
                optimisticLocking = new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']);

                getContext('testPostData', 'nino', 'default', '2014', new Date(2014, 1, 20, 10, 10, 10, 0))
                    .done(function (context) {
                        DAC = context.dataAccess;
                        conn = DAC.sqlConn;
                        ctx = context;
                        env = ctx.environment;
                        spyOn(DAC, 'close').and.callThrough();
                        postData = new PostData();
                        postData.init(d, ctx).then(() => {
                            done();
                        })
                            .fail(function (err) {
                                done();
                            });
                    });


            });

            it('should be a function', function () {
                expect(postData.allPost[0].physicalPostBatch).toEqual(jasmine.any(Function));
            });

            it('should call getSqlStatements', function (done) {
                spyOn(postData.allPost[0], 'getSqlStatements').and.callThrough();
                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });

                postData.allPost[0].physicalPostBatch(changes, optimisticLocking)
                    .done(function () {
                        expect(postData.allPost[0].getSqlStatements).toHaveBeenCalled();
                        done();
                    });
            });

            it('should call runCmd', function (done) {
                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].physicalPostBatch(changes, optimisticLocking)
                    .done(function () {
                        expect(DAC.runCmd).toHaveBeenCalled();
                        done();
                    });
            });


            it('if runCmd fails then physicalPostBatch should fail too', function (done) {
                let nRows = 0;
                let countCommands = 0;
                const expectedSql = [],
                    results = [];
                spyOn(DAC, 'getPostCommand').and.callFake(function (row, locking, env) {
                    countCommands += 1;
                    const sql = 'fake sql' + countCommands;
                    expectedSql.push(sql);
                    return sql;
                });
                spyOn(conn, 'appendCommands').and.callThrough();
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    process.nextTick(function () {
                        nRows += 1;
                        def.resolve(false);
                    });

                    return def.promise();
                });

                let nOk = 0;
                spyOn(DAC, 'runCmd').and.callFake(function (sqlComplete) {
                    const def = Deferred();
                    nOk += 1;
                    if (nOk < 50) {
                        def.resolve(-1);
                    }
                    else {
                        def.reject('runCmd fake error');
                    }

                    return def.promise();
                });
                postData.allPost[0].physicalPostBatch(changes, optimisticLocking)
                    .done(function (res) {
                        expect(true).toBeFalsy();
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toContain('runCmd fake error');
                        done();
                    });
            });


            it('if runCmd resolves into a bad number, an internal error should be raised', function (done) {
                let nRows = 0;
                let countCommands = 0;
                const expectedSql = [],
                    results = [];
                spyOn(DAC, 'getPostCommand').and.callFake(function (row, locking, env) {
                    countCommands += 1;
                    const sql = 'fake sql' + countCommands;
                    expectedSql.push(sql);
                    return sql;
                });
                spyOn(conn, 'appendCommands').and.callThrough();
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    process.nextTick(function () {
                        nRows += 1;
                        def.resolve(false);
                    });

                    return def.promise();
                });

                let nOk = 0;
                spyOn(DAC, 'runCmd').and.callFake(function () {
                    const def = Deferred();
                    nOk += 1;
                    if (nOk < 50) {
                        def.resolve(-1);
                    }
                    else {
                        def.resolve(99999);
                    }

                    return def.promise();
                });
                postData.allPost[0].physicalPostBatch(changes, optimisticLocking)
                    .done(function () {
                        expect(true).toBeFalsy();
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toContain('internal error');
                        done();
                    });
            });


            it('runCmd should be called with every sql cmd got from getPostCommand (grouped)', function (done) {
                let nRows = 0;
                let countCommands = 0;
                const expectedSql = [],
                    runnedSql = [];
                spyOn(DAC, 'getPostCommand').and.callFake(function (row, locking, env) {
                    countCommands += 1;
                    const sql = 'fake sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>' + countCommands;
                    expectedSql.push(sql);
                    return sql;
                });
                spyOn(conn, 'appendCommands').and.callThrough();
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    process.nextTick(function () {
                        nRows += 1;
                        def.resolve(true);
                    });

                    return def.promise();
                });

                let nOk = 0;
                spyOn(DAC, 'runCmd').and.callFake(function (sqlComplete) {
                    const def = Deferred();
                    nOk += 1;
                    runnedSql.push(sqlComplete);
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].physicalPostBatch(changes, optimisticLocking)
                    .done(function () {
                        _.forEach(expectedSql, function (sql) {
                            expect(_.find(runnedSql, function (el) {
                                //console.log(el);
                                return el.indexOf(sql) >= 0;
                            })).toBeDefined();
                        });
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

            it('runCmd should be called with every sql cmd got from getPostCommand (single)', function (done) {
                let nRows = 0;
                let countCommands = 0;
                const expectedSql = [],
                    runnedSql = [];
                spyOn(DAC, 'getPostCommand').and.callFake(function () {  //row, locking, env
                    countCommands += 1;
                    const sql = 'fake sql >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>' + countCommands;
                    expectedSql.push(sql);
                    return sql;
                });
                spyOn(conn, 'appendCommands').and.callThrough();
                spyOn(postData.allPost[0], 'calcAllAutoId').and.callFake(function (r) {
                    const def = Deferred();
                    process.nextTick(function () {
                        nRows += 1;
                        def.resolve(false);
                    });

                    return def.promise();
                });

                let nOk = 0;
                spyOn(DAC, 'runCmd').and.callFake(function (sqlComplete) {
                    const def = Deferred();
                    nOk += 1;
                    runnedSql.push(sqlComplete);
                    def.resolve(-1);
                    return def.promise();
                });
                postData.allPost[0].physicalPostBatch(changes, optimisticLocking)
                    .done(function (res) {
                        _.forEach(expectedSql, function (sql) {
                            expect(_.find(runnedSql, function (el) {
                                //console.log(el);
                                return el.indexOf(sql) >= 0;
                            })).toBeDefined();
                        });
                        done();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                        done();
                    });
            });

        });


        describe('getSelectAllViews', function () {
            let ctx, DAC,
                env,
                conn,
                postData,
                d,
                optimisticLocking,
                changes;

            beforeEach(function (done) {
                let rowCount, row, i, t;
                d = new DataSet('d');

                i = 11;
                while (--i > 0) {
                    t = d.newTable('tab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d.newRelation('r' + i + 'a', 'tab' + i, ['idExt' + (i + 1)], 'tab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    t.key(['id' + i]);
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }
                optimisticLocking = new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']);

                getContext('testPostData', 'nino', 'default', '2014', new Date(2014, 1, 20, 10, 10, 10, 0))
                    .done(function (context) {
                        DAC = context.dataAccess;
                        conn = DAC.sqlConn;
                        ctx = context;
                        env = ctx.environment;
                        spyOn(DAC, 'close').and.callThrough();
                        postData = new PostData();
                        postData.init(d, ctx).then(() => {
                            changes = postData.allPost[0].getChanges(d);
                            done();
                        })
                            .fail(function (err) {
                                done();
                            });
                    });


            });

            it('should be a function', function () {
                expect(postData.allPost[0].getSelectAllViews).toEqual(jasmine.any(Function));
            });

            it('should return an array', function () {
                expect(postData.allPost[0].getSelectAllViews(changes)).toEqual(jasmine.any(Array));
            });

            it('should return an array of Select', function () {
                d.tables.tab3.tableForWriting('realtable3');
                expect(postData.allPost[0].getSelectAllViews(changes).length).toBeGreaterThan(0);
                expect(postData.allPost[0].getSelectAllViews(changes)[0]).toEqual(jasmine.any(Select));
            });

            it('returned Select should be on view table', function () {
                d.tables.tab3.tableForWriting('realtable3');
                expect(postData.allPost[0].getSelectAllViews(changes)[0].alias).toEqual('tab3');
            });

            it('returned Select should read from view table', function () {
                d.tables.tab3.tableForWriting('realtable3');
                expect(postData.allPost[0].getSelectAllViews(changes)[0].tableName).toEqual('tab3');
            });


        });

        describe('doPost multi DataSet', function () {
            let DAC,
                env,
                ctx,
                postData,
                d1, d2,
                changes;

            beforeEach(function (done) {
                let rowCount, row, i, t;
                const d1 = new DataSet('d1');
                const d2 = new DataSet('d2');

                i = 11;
                while (--i > 0) {
                    t = d1.newTable('tab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d1.newRelation('r' + i + 'a', 'tab' + i, ['idExt' + (i + 1)], 'tab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }

                i = 13;
                while (--i > 0) {
                    t = d2.newTable('tabtab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d2.newRelation('r' + i + 'a', 'tabtab' + i, ['idExt' + (i + 1)], 'tabtab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }


                getContext('testPostData', 'nino', 'default', '2014', new Date(2014, 1, 20, 10, 10, 10, 0))
                    .done(function (context) {
                        DAC = context.dataAccess;
                        ctx = context;
                        env = ctx.environment;
                        spyOn(DAC, 'close').and.callThrough();
                        postData = new PostData();
                        postData.init(d1, ctx).then(() => {
                            postData.init(d2, ctx).then(() => {
                                done();
                            });
                        });
                    })
                    .fail(function (err) {
                        done();
                    });
            });


            it('should return a resolved promise to {checks:[]} when called with no change ', function () {
                postData.allPost[0].rowChanges = [];
                postData.allPost[1].rowChanges = [];
                postData.doPost({})
                    .done(function (res) {
                        expect(res.checks).toEqual([]);
                        expect(DAC.isOpen).toBeFalsy();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    });
            });

            it('should call opt.callChecks when there is something to save', function (done) {
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };


                postData.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    res.addError("code0", post);
                    //{checks: [{code: errNum}], shouldContinue: false};
                    def.resolve(res);
                    //console.log('returning checks:'+res);
                    return def.promise();
                };

                spyOn(postData, 'getChecks').and.callThrough();
                expect(postData.getChecks).not.toHaveBeenCalled();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(postData.getChecks).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should append error got from callChecks to output errors', function (done) {
                let errNum = 12;
                let check = null;
                postData.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    check = res.addError("code" + errNum);
                    //{checks: [{code: errNum}], shouldContinue: false};
                    errNum += 1;
                    def.resolve(res);
                    //console.log('returning checks:'+res);
                    return def.promise();
                };
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(postData, 'getChecks').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(res.checks).toContain(check);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should call open and begin transaction if prechecks did not return errors', function (done) {

                //simula la restituzione di un oggetto che implementa l'interfaccia IBusinessLogic
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("code" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                let errNum = 12;
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(postData.allPost[0].physicalPostBatch).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });


            it('should NOT call physicalPostBatch if prechecks returned errors', function (done) {
                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addError("codeA" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addError("codeB" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(1).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.open.calls.count()).toBe(1);
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(DAC.beginTransaction.calls.count()).toBe(1);
                        expect(postData.allPost[0].physicalPostBatch).not.toHaveBeenCalled();
                        expect(postData.allPost[1].physicalPostBatch).not.toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            }, 5000);

            it('should NOT call physicalPostBatch if prechecks throws', function (done) {

                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        throw "Exception threw on purpose 1";
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        throw "Exception threw on purpose 2";
                    }
                };
                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {

                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {

                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(1).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.open.calls.count()).toBe(1);
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(DAC.beginTransaction.calls.count()).toBe(1);
                        expect(postData.allPost[0].physicalPostBatch).not.toHaveBeenCalled();
                        expect(postData.allPost[1].physicalPostBatch).not.toHaveBeenCalled();
                        expect(_.find(res.checks,{msg:"Exception threw on purpose 1", canIgnore:false})).toBeDefined();
                        expect(res.checks.length).toBe(1);
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            }, 5000);

            it('should call physicalPostBatch if prechecks returned canIgnore is true', function (done) {

                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("codeA" + errNum, post);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("codeB" + errNum, post);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'rollback').and.callThrough();
                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.allPost[0].physicalPostBatch).toHaveBeenCalled();
                        expect(postData.allPost[1].physicalPostBatch).toHaveBeenCalled();
                        expect(res.checks).toContain(_.extend(new BasicMessage("codeA12", true), {post: false}));
                        expect(res.checks).toContain(_.extend(new BasicMessage("codeB13", true), {post: false}));
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            }, 5000);

            it('should call opt.log if physicalPostBatch is resolved and opt.log is given', function (done) {

                let errNum = 12;
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                spyOn(postData.allPost[0], 'log').and.callThrough();
                spyOn(postData.allPost[1], 'log').and.callThrough();
                spyOn(DAC, 'commit').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.allPost[0].log.calls.count()).toBe(1);
                        expect(postData.allPost[1].log.calls.count()).toBe(1);
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.commit).toHaveBeenCalled();
                        expect(DAC.commit.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call getChecks(post) if given opt.log rejects his promise', function (done) {

                let errNum = 12;
                let warn = null;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        warn = res.addWarning("codeA" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        warn = res.addWarning("codeB" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[0].log = function (conn, changes) {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                };
                postData.allPost[1].log = function (conn, changes) {
                    const def = Deferred();
                    def.reject('log reject');
                    return def.promise();
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postData.allPost[0], 'log').and.callThrough();
                spyOn(postData.allPost[1], 'log').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(postData.allPost[0].log.calls.count()).toBe(1);
                        expect(postData.allPost[1].log.calls.count()).toBe(1);
                        expect(res.checks.find(c => c.msg === "log reject" && c.canIgnore === false)).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call getChecks(post) if given opt.log throws', function (done) {

                let errNum = 12;
                let warn = null;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        warn = res.addWarning("codeA" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        warn = res.addWarning("codeB" + errNum);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[0].log = function (conn, changes) {
                    return Deferred().resolve();
                };
                postData.allPost[1].log = function (conn, changes) {
                    throw  "Exception raised on purpose";
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postData.allPost[0], 'log').and.callThrough();
                spyOn(postData.allPost[1], 'log').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(postData.allPost[0].log.calls.count()).toBe(1);
                        expect(postData.allPost[1].log.calls.count()).toBe(1);
                        expect(res.checks.find(c => c.msg === "Exception raised on purpose" && c.canIgnore === false)).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should call postChecks if physicalPostBatch is resolved', function (done) {

                let errNum = 12;
                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("codeA" + errNum, post);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        res.addWarning("codeB" + errNum, post);
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(res.checks).toContain(_.extend(new BasicMessage("codeA12", true), {post: false}));
                        expect(res.checks).toContain(_.extend(new BasicMessage("codeB13", true), {post: false}));
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call postChecks if physicalPostBatch is rejected', function (done) {

                let errNum = 12;

                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        let check = res.addWarning("codeA" + errNum, post);
                        check.post = post;
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        let check = res.addWarning("codeB" + errNum, post);
                        check.post = post;
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.reject('physicalPostBatch fake error');
                    return def.promise();
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(_.find(res.checks,{msg:"codeA12",canIgnore:true,post:false}))
                            .toBeDefined();
                        expect(_.find(res.checks,{msg:"codeA12",canIgnore:true,post:true}))
                        .toBeUndefined();

                        expect(_.find(res.checks,{msg:"codeB13",canIgnore:true,post:false}))
                        .toBeDefined();
                        expect(_.find(res.checks,{msg:"codeB13",canIgnore:true,post:true}))
                        .toBeUndefined();

                        expect(_.find(res.checks,{msg:"physicalPostBatch fake error",canIgnore:false}))
                            .toBeDefined();

                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should return some error if physicalPostBatch throws  ', function (done) {

                let errNum = 12;

                postData.allPost[0].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        let check = res.addWarning("codeA" + errNum, post);
                        check.post = post;
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };
                postData.allPost[1].businessLogic = {
                    getChecks: function (res, conn, post) {
                        const def = Deferred();
                        let check = res.addWarning("codeB" + errNum, post);
                        check.post = post;
                        errNum += 1;
                        def.resolve(res);
                        return def.promise();
                    }
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    return Deferred().resolve();
                });
                spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                    throw "DataBase Error threw on purpose";
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(1);
                        expect(res.checks).toContain(_.extend(new BasicMessage("codeA12", true), {post: false}));
                        expect(res.checks).not.toContain(_.extend(new BasicMessage("codeA12", true), {post: true}));
                        expect(_.find(res.checks,
                            _.extend(new BasicMessage("codeB13", true), {post: false}))).toBeDefined();
                        expect(_.find(res.checks,_.extend(new BasicMessage("codeB13", true), {post: true})))
                                        .toBeUndefined();
                        expect(_.find(res.checks,{msg:"DataBase Error threw on purpose", canIgnore:false}))
                            .toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });


            it('should NOT call opt.doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are msgs - both',
                function (done) {

                    let errNum = 12;

                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("codeA" + errNum);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };
                    postData.allPost[1].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("codeB" + errNum);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                    };
                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].doUpdate).not.toHaveBeenCalled();
                            expect(postData.allPost[1].doUpdate).not.toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.rollback.calls.count()).toBe(1);
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should NOT call opt.doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are msgs - first',
                function (done) {

                    let errNum = 12;

                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("codeA" + errNum);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };
                    postData.allPost[1].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            def.resolve(res);
                            return def.promise();
                        }
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                    };
                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].doUpdate).not.toHaveBeenCalled();
                            expect(postData.allPost[1].doUpdate).not.toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.rollback.calls.count()).toBe(1);
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should NOT call opt.doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are msgs - second',
                function (done) {

                    let errNum = 12;

                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            def.resolve(res);
                            return def.promise();
                        }
                    };
                    postData.allPost[1].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("codeB" + errNum);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                    };
                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].doUpdate).not.toHaveBeenCalled();
                            expect(postData.allPost[1].doUpdate).not.toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.rollback.calls.count()).toBe(1);
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are no errors',
                function (done) {

                    let errNum = 12;

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].doUpdate).toHaveBeenCalled();
                            expect(postData.allPost[1].doUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });


            it('should  call opt.doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are checks' +
                ' but they were already present 1',
                function (done) {
                    let errNum = 12;
                    let rules = new BusinessLogicResult();
                    rules.addWarning("code12");
                    rules.addWarning("code13");

                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("code12");
                            def.resolve(res);
                            return def.promise();
                        }
                    };
                    postData.allPost[1].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            res.addWarning("code13");
                            def.resolve(res);
                            return def.promise();
                        }
                    };


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: rules
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();

                    spyOn(rules, 'mergeMessages').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            expect(rules.mergeMessages).toHaveBeenCalled();
                            expect(postData.allPost[0].doUpdate).toHaveBeenCalled();
                            expect(postData.allPost[1].doUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.commit.calls.count()).toBe(1);
                            expect(DAC.isOpen).toBeFalsy();
                            expect(res.checks.length).toBe(0);
                            done();
                        });
                });

            it('should  call commit if optional doUpdate resolves',
                function (done) {


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            expect(DAC.rollback).not.toHaveBeenCalled();
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if optional doUpdate is rejected',
                function (done) {

                    postData.allPost[1].doUpdate = function () {
                        const def = Deferred();
                        def.reject('another doUpdate fake error by reject');
                        return def.promise();
                    };
                    let errNum = 12;
                    let check = null;
                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if optional doUpdate is errored',
                function (done) {

                    postData.allPost[1].doUpdate = function (conn, res) {
                        const def = Deferred();
                        res.addError("Random error", true);
                        def.resolve();
                        return def.promise();
                    };
                    let errNum = 12;
                    let check = null;
                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(1).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(postData.allPost[0].doUpdate).toHaveBeenCalled();
                            expect(postData.allPost[1].doUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call commit  if optional doUpdate is rejected with a previosly ignored message 3',
                function (done) {
                    var result = new BusinessLogicResult();
                    const err1 = "another doUpdate fake error";
                    const err2 = "another random fake error";
                    result.addWarning(err1);
                    result.addWarning(err2);
                    let check1, check2;
                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            check1 = res.addWarning(err1, post);
                            def.resolve(res);
                            return def.promise();
                        }
                    };


                    postData.allPost[1].doUpdate = function (conn, res) {
                        const def = Deferred();
                        check2 = res.addWarning(err2);
                        def.resolve();
                        return def.promise();
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: result

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.rollback).not.toHaveBeenCalled();
                            expect(res.checks.length).toBe(0);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollback  if optional doUpdate is gives a blocking error previously present as warning',
                function (done) {
                    var result = new BusinessLogicResult();
                    const err1 = "another random fake error";
                    const err2 = "another doUpdate fake error";
                    result.addWarning(err1);
                    result.addWarning(err2);
                    let check1, check2;
                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            check1 = res.addWarning(err1);
                            def.resolve(res);
                            return def.promise();
                        }
                    };


                    postData.allPost[1].doUpdate = function (conn, result) {
                        const def = Deferred();
                        check2 = result.addError(err2);
                        def.resolve(result);
                        return def.promise();
                    };

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: result

                    };

                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(res.checks).toContain(check1);
                            expect(res.checks).toContain(check2);
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if physicalPostBatch is rejected',
                function (done) {

                    let errNum = 12;
                    let check = null;
                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            check = res.addWarning("code" + errNum);
                            errNum += 1;
                            def.resolve(res);
                            return def.promise();
                        }
                    };


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };
                    spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postData.allPost[1], 'physicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.reject('physicalPostBatch fake error');
                        return def.promise();
                    });
                    spyOn(postData.allPost[0], 'doUpdate').and.callThrough();
                    spyOn(postData.allPost[1], 'doUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.allPost[0].doUpdate).not.toHaveBeenCalled();
                            expect(postData.allPost[1].doUpdate).not.toHaveBeenCalled();
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(res.checks).toContain(check);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });
        });

        describe('doPost nested', function () {
            /**
             * How has to be done a nested post?
             * A class implementing IInnerPoster has to be created
             *  so with
             *   init : function ( ds,context)
             *    afterPost: function(conn, committed)
             *     reselectAllViewsAndAcceptChanges: function(conn)
             *      doPost: function (options)
             *      getInnerPostingClass: function ()
             *  Actually, simply using IInnerPoster is sufficient. But it is possible to override
             *   methods to add custom functionalities
             */


            let DAC,
                env,
                ctx,
                postData,
                postDataInner,
                innerPoster,
                d1, d2,
                changes;

            beforeEach(function (done) {
                let rowCount, row, i, t;
                const d1 = new DataSet('d1');
                const d2 = new DataSet('d2');

                i = 11;
                while (--i > 0) {
                    t = d1.newTable('tab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d1.newRelation('r' + i + 'a', 'tab' + i, ['idExt' + (i + 1)], 'tab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }

                i = 13;
                while (--i > 0) {
                    t = d2.newTable('tabtab' + i);
                    t.setDataColumn('id' + i, 'int32');
                    t.setDataColumn('data' + i, 'int32');
                    if (i < 10) {
                        t.setDataColumn('idExt' + (i + 1), 'int32');
                        d2.newRelation('r' + i + 'a', 'tabtab' + i, ['idExt' + (i + 1)], 'tabtab' + (i + 1), ['id' + (i + 1)]);
                    }
                    if (i < 9) {
                        t.setDataColumn('idExt' + (i + 2), 'int32');
                    }
                    if (i < 8) {
                        t.setDataColumn('idExt' + (i + 3), 'int32');
                    }
                    rowCount = 0;
                    while (++rowCount < 6) {
                        row = t.newRow({
                            'id': rowCount,
                            'data': 'about' + rowCount,
                            'idExt': 2 * rowCount,
                            'tabRif': t.name
                        });
                    }
                }


                getContext('testPostData', 'nino', 'default', '2014', new Date(2014, 1, 20, 10, 10, 10, 0))
                    .done(function (context) {
                        DAC = context.dataAccess;
                        ctx = context;
                        env = ctx.environment;
                        spyOn(DAC, 'close').and.callThrough();
                        postData = new PostData();
                        innerPoster = new IInnerPoster();
                        postDataInner = innerPoster.p;
                        postData.setInnerPosting(d2, innerPoster);
                        postData.init(d1, ctx).then(() => {
                            done();
                        });
                    })
                    .fail(function (err) {
                        done();
                    });
            });


            it('should return a resolved promise to {checks:[]} when called with no change ', function () {
                postData.allPost[0].rowChanges = [];
                postData.doPost({})
                    .done(function (res) {
                        expect(res.checks).toEqual([]);
                        expect(DAC.isOpen).toBeFalsy();
                    })
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    });
            });

            it('should call inner getChecks when there is something to save', function (done) {
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                postData.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    def.resolve(res);
                    return def.promise();
                };
                postDataInner.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    res.addError("code0");
                    def.resolve(res);
                    return def.promise();
                };


                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(postData.getChecks).toHaveBeenCalled();
                        expect(postData.allPost[0].physicalPostBatch).toHaveBeenCalled();
                        expect(postDataInner.getChecks).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should not call inner class if outer gives errors', function (done) {
                let errNum = 12;
                let check1 = null,
                    check2 = null;
                postData.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    check1 = res.addError("codeA" + errNum);
                    def.resolve(res);
                    return def.promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    check2 = res.addError("codeB" + errNum);
                    errNum += 1;
                    def.resolve(res);
                    return def.promise();
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(postData.getChecks).toHaveBeenCalled();
                        expect(postDataInner.getChecks).not.toHaveBeenCalled();
                        expect(res.checks).toContain(check1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should append error got from inner getChecks to output errors', function (done) {
                let errNum = 12;
                let check2 = null;
                postData.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    def.resolve(res);
                    return def.promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    const def = Deferred();
                    let res = new BusinessLogicResult();
                    check2 = res.addError("codeB" + errNum);
                    errNum += 1;
                    def.resolve(res);
                    return def.promise();
                };

                spyOn(postData.allPost[0], 'physicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(postData.getChecks).toHaveBeenCalled();
                        expect(postDataInner.getChecks).toHaveBeenCalled();
                        expect(res.checks).toContain(check2);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should call inner doAllPhisicalPostBatch if prechecks did not return errors', function (done) {

                //simula la restituzione di un oggetto che implementa l'interfaccia IBusinessLogic
                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    res.addWarning("code" + errNum);
                    errNum += 1;
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                let errNum = 12;
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(DAC.beginTransaction.calls.count()).toBe(1);
                        expect(postData.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(postDataInner.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });


            it('should NOT call inner physicalPostBatch if prechecks returned errors', function (done) {
                let errNum = 12;
                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    res.addError("code" + errNum);
                    errNum += 1;
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();

                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(1).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.open.calls.count()).toBe(1);
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(DAC.beginTransaction.calls.count()).toBe(1);
                        expect(postData.getChecks).toHaveBeenCalled();
                        expect(postDataInner.getChecks).toHaveBeenCalled();
                        expect(postData.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(postDataInner.doAllPhisicalPostBatch).not.toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        expect(DAC.rollback).toHaveBeenCalled();
                        done();
                    });
            }, 5000);

            it('should NOT call physicalPostBatch if prechecks throws', function (done) {

                let errNum = 12;

                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    throw "Exception threw on purpose 1";
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(1).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.open.calls.count()).toBe(1);
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(DAC.beginTransaction.calls.count()).toBe(1);
                        expect(postData.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(postDataInner.doAllPhisicalPostBatch).not.toHaveBeenCalled();
                        expect(_.find(res.checks,{msg:"Exception threw on purpose 1",canIgnore:false}))
                            .toBeDefined();
                        expect(res.checks.length).toBe(1);
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            }, 5000);

            it('should NOT call inner physicalPostBatch if prechecks returned warnings', function (done) {
                let errNum = 12;
                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    res.addWarning("code" + errNum);
                    errNum += 1;
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };
                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();

                spyOn(DAC, 'open').and.callThrough();
                spyOn(DAC, 'beginTransaction').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(1).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(DAC.open).toHaveBeenCalled();
                        expect(DAC.open.calls.count()).toBe(1);
                        expect(DAC.beginTransaction).toHaveBeenCalled();
                        expect(DAC.beginTransaction.calls.count()).toBe(1);
                        expect(postData.getChecks).toHaveBeenCalled();
                        expect(postDataInner.getChecks).toHaveBeenCalled();
                        expect(postData.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(postDataInner.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.isOpen).toBeFalsy();
                        expect(DAC.rollback).toHaveBeenCalled();
                        done();
                    });
            }, 5000);

            it('should call log if physicalPostBatch is resolved ', function (done) {

                let errNum = 12;
                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                };

                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllLog').and.callThrough();
                spyOn(postData, 'doAllLog').and.callThrough();
                spyOn(DAC, 'commit').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(postDataInner.doAllPhisicalPostBatch).toHaveBeenCalled();
                        expect(postData.doAllLog).toHaveBeenCalled();
                        expect(postDataInner.doAllLog).toHaveBeenCalled();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.commit).toHaveBeenCalled();
                        expect(DAC.commit.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call getChecks(post) if given log rejects his promise', function (done) {

                let errNum = 12;
                let warn = null;
                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                };

                spyOn(postData, 'doAllLog').and.callThrough();
                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();


                spyOn(postDataInner, 'doAllLog').and.callFake(function () {
                    const def = Deferred();
                    def.reject("log rejection on purpose");
                    return def.promise();
                });

                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.getChecks.calls.count()).toBe(2);
                        expect(postData.doAllLog.calls.count()).toBe(1);
                        expect(postDataInner.doAllLog.calls.count()).toBe(1);
                        expect(res.checks.find(c => c.msg === "log rejection on purpose" && c.canIgnore === false)).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call getChecks(post) if given opt.log throws', function (done) {

                let errNum = 12;
                let warn = null;

                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                postDataInner.doAllLog = function (conn, changes) {
                    throw  "Exception raised on purpose";
                };

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                };


                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postData, 'doAllLog').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'doAllLog').and.callThrough();

                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        expect(postData.getChecks.calls.count()).toBe(2);
                        expect(postDataInner.getChecks.calls.count()).toBe(1);
                        expect(postData.doAllLog.calls.count()).toBe(1);
                        expect(postDataInner.doAllLog.calls.count()).toBe(1);
                        expect(res.checks.find(c => c.msg === "Exception raised on purpose" && c.canIgnore === false)).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should call postChecks if physicalPostBatch is resolved', function (done) {

                let errNum = 12;
                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    res.addWarning("codeB" + errNum, post);
                    errNum += 1;
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };

                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(2);
                        expect(postDataInner.getChecks.calls.count()).toBe(2);
                        expect(_.find(res.checks,{msg:"codeB12",canIgnore:true,post:false})).toBeDefined();
                        expect(_.find(res.checks,{msg:"codeB13",canIgnore:true,post:true})).toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should NOT call postChecks if physicalPostBatch is rejected', function (done) {

                let errNum = 12;

                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    res.addWarning("codeB" + errNum, post);
                    errNum += 1;
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.reject('physicalPostBatch fake error');
                    return def.promise();
                });

                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };


                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(2);
                        expect(postDataInner.getChecks.calls.count()).toBe(1);

                        expect(_.find(res.checks,_.extend(new BasicMessage("codeB12", true), {post: false})))
                            .toBeDefined();
                        expect(_.find(res.checks,_.extend(new BasicMessage("codeB13", true), {post: true})))
                            .toBeUndefined();

                        expect(_.find(res.checks,new BasicMessage("physicalPostBatch fake error", false)))
                            .toBeDefined();

                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });

            it('should return some error if physicalPostBatch throws  ', function (done) {

                let errNum = 12;

                postData.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    return Deferred().resolve(res).promise();
                };

                postDataInner.getChecks = function (conn, post) {
                    let res = this.createBusinessLogicResult();
                    res.addWarning("codeB" + errNum, post);
                    errNum += 1;
                    return Deferred().resolve(res).promise();
                };

                spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                    const def = Deferred();
                    def.resolve();
                    return def.promise();
                });


                spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                    throw "DataBase Error threw on purpose";
                });


                const opt = {
                    optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                };


                spyOn(postData, 'getChecks').and.callThrough();
                spyOn(postDataInner, 'getChecks').and.callThrough();
                spyOn(DAC, 'rollback').and.callThrough();

                postData.doPost(opt)
                    .fail(function (err) {
                        expect(err).toBeUndefined();
                    })
                    .always(function (res) {
                        //console.log(res);
                        expect(postData.getChecks.calls.count()).toBe(2);
                        expect(postDataInner.getChecks.calls.count()).toBe(1);
                        expect(res.checks).toContain(_.extend(new BasicMessage("codeB12", true), {post: false}));
                        expect(res.checks).not.toContain(_.extend(new BasicMessage("codeB13", true), {post: true}));
                        expect(_.find(res.checks,new BasicMessage("DataBase Error threw on purpose", false)))
                            .toBeDefined();
                        expect(DAC.close).toHaveBeenCalled();
                        expect(DAC.rollback).toHaveBeenCalled();
                        expect(DAC.rollback.calls.count()).toBe(1);
                        expect(DAC.isOpen).toBeFalsy();
                        done();
                    });
            });


            it('should NOT call inner doUpdate if physicalPostBatch is resolved and there are msgs',
                function (done) {

                    let errNum = 12;

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        res.addWarning("codeB" + errNum, post);
                        errNum += 1;
                        return Deferred().resolve(res).promise();
                    };


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu'])
                    };
                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });


                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.doAllUpdate).toHaveBeenCalled();
                            expect(postDataInner.doAllUpdate).not.toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.rollback.calls.count()).toBe(1);
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });


            it('should  call doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are no errors',
                function (done) {

                    let errNum = 12;

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };
                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });


                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.doAllUpdate).toHaveBeenCalled();
                            expect(postDataInner.doAllUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });


            it('should  call opt.doUpdate if physicalPostBatch is resolved and opt.doUpdate is given and there are checks' +
                ' but they were already present 2',
                function (done) {
                    let errNum = 12;
                    let rules = new BusinessLogicResult();
                    rules.addWarning("code12", false);
                    rules.addWarning("code13", false);

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        res.addWarning("code12", post);
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        res.addWarning("code13", post);
                        return Deferred().resolve(res).promise();
                    };


                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: rules
                    };

                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();

                    spyOn(rules, 'mergeMessages').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            expect(rules.mergeMessages).toHaveBeenCalled();
                            expect(postData.doAllUpdate).toHaveBeenCalled();
                            expect(postDataInner.doAllUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.commit.calls.count()).toBe(1);
                            expect(DAC.rollback).not.toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            expect(res.checks.length).toBe(0);
                            done();
                        });
                });

            it('should  call commit if optional doUpdate resolves',
                function (done) {

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };
                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };

                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();

                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            expect(DAC.rollback).not.toHaveBeenCalled();
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if optional doUpdate is rejected',
                function (done) {

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    postData.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        def.resolve(res);
                        return def.promise();
                    };


                    postDataInner.doAllUpdate = function () {
                        const def = Deferred();
                        def.reject('another doUpdate fake error by reject');
                        return def.promise();
                    };
                    let errNum = 12;
                    let check = null;
                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                    };

                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                            done();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollBack (and not commit) if optional doUpdate is errored',
                function (done) {

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };


                    let errNum = 12;
                    let check = null;
                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),

                    };

                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    postData.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        def.resolve(res);
                        return def.promise();
                    };


                    postDataInner.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        res.addError("Random error", true);
                        def.resolve(res);
                        return def.promise();
                    };

                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(1).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(postData.doAllUpdate).toHaveBeenCalled();
                            expect(postDataInner.doAllUpdate).toHaveBeenCalled();
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call commit  if optional doUpdate is rejected with a previously ignored message 1',
                function (done) {
                    var result = new BusinessLogicResult();
                    const err1 = "another doUpdate fake error";
                    const err2 = "another random fake error";
                    result.addWarning(err1, true);
                    result.addWarning(err2, true);
                    let check1, check2;

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };


                    postData.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        check1 = res.addWarning(err1, true);
                        def.resolve(res);
                        return def.promise();
                    };


                    postDataInner.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        check2 = res.addWarning(err2, true);
                        def.resolve(res);
                        return def.promise();
                    };
                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: result

                    };
                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).toHaveBeenCalled();
                            expect(DAC.rollback).not.toHaveBeenCalled();
                            expect(res.checks.length).toBe(0);  //quando il commit riesce non restituisce messaggi
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });

            it('should  call rollback  if optional doUpdate is gives a blocking error previously present as warning',
                function (done) {
                    var result = new BusinessLogicResult();
                    const err1 = "another doUpdate fake error";
                    const err2 = "another random fake error";
                    result.addWarning(err1);
                    result.addWarning(err2);
                    let check1, check2;

                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };


                    postData.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        check1 = result.addWarning(err1);
                        def.resolve(res);
                        return def.promise();
                    };


                    postDataInner.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        check2 = res.addError(err2);
                        def.resolve(res);
                        return def.promise();
                    };
                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                        previousRules: result

                    };
                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });

                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(res.checks).toContain(check1);
                            expect(res.checks).toContain(check2);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });


            it('should  call rollBack (and not commit) if physicalPostBatch is rejected',
                function (done) {

                    let errNum = 12;
                    let check = null;
                    postData.allPost[0].businessLogic = {
                        getChecks: function (res, conn, post) {
                            const def = Deferred();
                            def.resolve(res);
                            return def.promise();
                        }
                    };
                    postData.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        return Deferred().resolve(res).promise();
                    };

                    postDataInner.getChecks = function (conn, post) {
                        let res = this.createBusinessLogicResult();
                        check = res.addWarning("code" + errNum);
                        errNum += 1;
                        return Deferred().resolve(res).promise();
                    };

                    postData.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        def.resolve(res);
                        return def.promise();
                    };


                    postDataInner.doAllUpdate = function (conn, res) {
                        const def = Deferred();
                        def.resolve(res);
                        return def.promise();
                    };

                    spyOn(postData, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.resolve();
                        return def.promise();
                    });
                    spyOn(postDataInner, 'doAllPhisicalPostBatch').and.callFake(function () {
                        const def = Deferred();
                        def.reject('physicalPostBatch fake error');
                        return def.promise();
                    });

                    const opt = {
                        optimisticLocking: new OptimisticLocking(['lt', 'lu'], ['ct', 'cu', 'lt', 'lu']),
                    };


                    spyOn(postData, 'doAllUpdate').and.callThrough();
                    spyOn(postDataInner, 'doAllUpdate').and.callThrough();
                    spyOn(DAC, 'commit').and.callThrough();
                    spyOn(DAC, 'rollback').and.callThrough();

                    postData.doPost(opt)
                        .fail(function (err) {
                            expect(err).toBeUndefined();
                        })
                        .always(function (res) {
                            //console.log(res);
                            expect(postData.doAllUpdate).toHaveBeenCalled();
                            expect(postDataInner.doAllUpdate).not.toHaveBeenCalled();
                            expect(DAC.commit).not.toHaveBeenCalled();
                            expect(DAC.rollback).toHaveBeenCalled();
                            expect(res.checks).toContain(check);
                            expect(DAC.close).toHaveBeenCalled();
                            expect(DAC.isOpen).toBeFalsy();
                            done();
                        });
                });
        });
    });


    describe('destroy dataBase', function () {
        let sqlConn;
        beforeEach(function (done) {
            dbList.setDbInfo('testPostData', good);
            sqlConn = dbList.getConnection('testPostData');
            sqlConn.open().done(function () {
                done();
            });
        });

        afterEach(function (done) {
            dbList.delDbInfo('testPostData');
            if (sqlConn) {
                sqlConn.destroy().then(()=>done());
            }
            sqlConn = null;
            if (fs.existsSync('test/dbList.bin')) {
                fs.unlinkSync('test/dbList.bin');
            }
        });

        it('should run the destroy script', function (done) {
            sqlConn.run(fs.readFileSync(path.join('test', 'data', 'PostData', 'destroy.sql')).toString())
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