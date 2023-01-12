'use strict';

console.log("running ApplicationAnonymousSpec");


const path = require("path");
const FormData = require('form-data');
const fs = require("fs");
const q = require('../../client/components/metadata/jsDataQuery');
const jsDataSet = require("../../client/components/metadata/jsDataSet");
const configName = path.join('config', 'dbList.json');
const http = require("http");
let request = require('request');
const _ = require("lodash");
const tokenConfig = require("./../../config/tokenConfig");

let dbConfig;
if (process.env.TRAVIS) {
    dbConfig = {
        "server": "127.0.0.1",
        "database": "test",
        "user": "sa",
        "pwd": "YourStrong!Passw0rd",
        "test":false
    };
} else {
    dbConfig = JSON.parse(fs.readFileSync(configName).toString())['test_sqlServer_anonymous'];
}

const sqlServerDriver = require('../../src/jsSqlServerDriver'),
    IsolationLevel = {
        readUncommitted: 'READ_UNCOMMITTED',
        readCommitted: 'READ_COMMITTED',
        repeatableRead: 'REPEATABLE_READ',
        snapshot: 'SNAPSHOT',
        serializable: 'SERIALIZABLE'
    };

describe('API with anonimous connection',
    function () {
        const timeout = 500000;
        let sqlConn;
        function getConnection() {
            let options = dbConfig;
            if (options) {
                options.dbCode = "test_sqlServer_anonymous";
                return new sqlServerDriver.Connection(options);
            }
            return undefined;
        }

        beforeEach(function (done) {
            sqlConn = getConnection();
            sqlConn.open().done(function () {
                done();
            }).fail(function (err) {
                console.log('Error failing ' + err);
                done();
            });
        }, timeout);

        afterEach(function () {
            if (sqlConn) {
                sqlConn.destroy();
            }
            sqlConn = null;
        });

        describe('setup dataBase', function () {
            it('should run the setup script', function (done) {
                sqlConn.run(fs.readFileSync('test/data/jsApplication/setup.sql').toString())
                    .done(function () {
                        expect(true).toBeTruthy();
                        done();
                    })
                    .fail(function (res) {
                        expect(res).toBeUndefined();
                        done();
                    });
            }, timeout);

        });

        // ANONYMOUS token

        it("getDataSet attach-counter not allowed",
            function (done) {
            const tableName = "attach";
            const editType = "counter";
                request({
                    url: 'http://localhost:54471/testanonymous/data/getDataSet',
                    method: 'POST',
                    headers: {
                        'authorization': "Bearer " + tokenConfig.AnonymousToken,
                    },
                    form: {
                        tableName: tableName,
                        editType: editType
                    }
                }, function (error, response, body) {
                    if (error) {
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                    }
                    expect(response).toBeDefined();
                    expect(response.statusCode).toBe(400);
                    expect(body).toBe("Anonymous not permitted, dataset " + tableName + " " + editType);
                    done();
                });
            }, timeout);

        it("getDataSet attach-anonymous allowed",
            function (done) {
                const tableName = "attach";
                const editType = "anonymous";
                request({
                    url: 'http://localhost:54471/testanonymous/data/getDataSet',
                    method: 'POST',
                    headers: {
                        'authorization': "Bearer " + tokenConfig.AnonymousToken,
                    },
                    form: {
                        tableName: tableName,
                        editType: editType
                    }
                }, function (error, response, body) {
                    if (error) {
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                    }
                    expect(response).toBeDefined();
                    var objParsed = JSON.parse(body);
                    var ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);
                    expect(ds.name).toBe('attach_anonymous');
                    expect(ds.tables.attach).toBeDefined();
                    expect(Object.keys(ds.tables.attach.columns).length).toBeGreaterThan(1);
                    done();
                });
            }, timeout);

        describe('clear dataBase', function () {
            it('should run the destroy script', function (done) {
                sqlConn.run(fs.readFileSync('test/data/jsApplication/Destroy.sql').toString())
                    .done(function () {
                        expect(true).toBeTruthy();
                        done();
                    })
                    .fail(function (res) {
                        expect(res).toBeUndefined();
                        done();
                    });
            }, timeout);
        });

    });
