/* globals describe, beforeEach,it,expect,jasmine,spyOn */
'use strict';

console.log("running ApplicationSpec");


/*jshint -W069*/
/*jshint -W083*/

const fetch = require( 'node-fetch');

const path = require("path");
const FormData = require('form-data');
const fs = require("fs");
const q = require('../../client/components/metadata/jsDataQuery');
const jsDataSet = require("../../client/components/metadata/jsDataSet");
const configName = path.join('config', 'dbList.json');
const GetMeta = require("./../../client/components/metadata/GetMeta");

const http = require("http");
let request = require('request');
const _ = require("lodash");
const {unlink, readdir} = require("fs/promises");

let dbConfig;
if (process.env.TRAVIS) {
    dbConfig = {
        "server": "127.0.0.1",
        "database": "test",
        "user": "sa",
        "pwd": "YourStrong!Passw0rd"
    };
} else {
    dbConfig = JSON.parse(fs.readFileSync(configName).toString())['test_sqlServer'];
}

const uploadPath = 'Uploads/';

const sqlServerDriver = require('../../src/jsSqlServerDriver'),
    IsolationLevel = {
        readUncommitted: 'READ_UNCOMMITTED',
        readCommitted: 'READ_COMMITTED',
        repeatableRead: 'REPEATABLE_READ',
        snapshot: 'SNAPSHOT',
        serializable: 'SERIALIZABLE'
    };

describe('js prerequisites', function () {
    it("checking method call", function (done) {
        let fn = function (N) {
            this.N = N;
        };
        fn.prototype = {
            constructor: fn,
            fun: function () {
                if (this === undefined) {
                    return undefined;
                }
                return this.N;
            }
        };

        let o = new fn(3);
        expect(o.fun()).toBe(3);
        let g = o.fun;
        expect(g()).toBe(undefined);
        let h = o.fun.bind(o);
        expect(h()).toBe(3);

        done();
    });
});

describe('rest api',
    function (){

        const timeout = 60000;

        jasmine.DEFAULT_TIMEOUT_INTERVAL = timeout;

        let sqlConn;

        function getConnection(){
            let options = dbConfig;
            if (options){
                options.dbCode = "test_sqlServer";
                return new sqlServerDriver.Connection(options);
            }
            return undefined;
        }


        beforeEach(function (done){
            sqlConn = getConnection();
            sqlConn.open().done(function (){
                done();
            }).fail(function (err){
                console.log('Error during opening: ' + err);
                throw err;
            });
        });

        afterEach(function (done){
            if (sqlConn){
                sqlConn.destroy()
                .then(
                    () => done());
                sqlConn = null;
                return;
            }
            console.log("Connection was ALREADY closed");
            sqlConn = null;
            done();
        }, timeout);

        //describe('setup dataBase', function () {
        it('should run the setup script', function (done){
            //console.log("Running script");
            sqlConn.run(fs.readFileSync('test/data/jsApplication/setup.sql').toString())
            .done(function (){
                //console.log("db created");
                expect(true).toBeTruthy();
                done();
            })
            .fail(function (res){
                console.log(res);
                expect(res).toBeUndefined();
                done();
            });
        });

        //});

        it("select ws: query on customusergroup returns DataTable",
            async function (){
                let filter = q.or(q.eq('idcustomuser', 'AZZURRO'),
                    q.eq('idcustomuser', 'BIANCO'),
                    q.eq('idcustomuser', 'NERO'));
                let objser = q.toObject(filter);
                let filterSerialized = JSON.stringify(objser);

                try{
                    const params = new URLSearchParams();
                    params.append('tableName', 'customusergroup');
                    params.append('columnList',  "idcustomgroup,idcustomuser");
                    params.append('top', '10');
                    params.append('filter', filterSerialized);

                    let response = await fetch(
                        'http://localhost:54471/test/data/select',
                        {
                            method: 'POST',
                            body: params
                        });
                    expect(response).toBeDefined();
                    let dtObj = await response.json();
                    //const dtObj = JSON.parse(body);
                    const dt = new jsDataSet.DataTable(dtObj.name);
                    dt.deSerialize(dtObj, true);
                    expect(dt.name).toBe('customusergroup');
                    expect(dt.rows.length).toBe(3);
                }
                catch (error){
                    expect(error).toBeUndefined();
                }

            });


        it("selectCount ws: returns the number of record of table",
            function (done){
                let filter = q.or(q.eq('idcustomuser', 'AZZURRO'), q.eq('idcustomuser', 'BIANCO'), q.eq('idcustomuser', 'NERO'));
                let objser = q.toObject(filter);
                let filterSerialized = JSON.stringify(objser);

                request({
                    url: 'http://localhost:54471/test/data/selectCount',
                    method: 'POST',
                    form: {
                        tableName: 'customusergroup',
                        filter: filterSerialized
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(error).toBe(undefined);
                        done();
                        return;
                    }
                    // N.B respect to .net be, express send() funct not send numbers. So we have to manage the response in the client.
                    // --> client must expect string type not number type!
                    expect(response).toBeDefined();
                    expect(typeof body).toBe("string");
                    expect(body).toBe("3");
                    done();
                });
            }, timeout);

        it("multirunselect ws: multi queries on customusergroup + customuser returns DataTable",
            function (done){
                const ds = new jsDataSet.DataSet("temp");
                const t1name = 'customuser';
                const t2name = 'customusergroup';
                const filter1 = q.or(q.eq('idcustomuser', 'AZZURRO'), q.eq('idcustomuser', 'BIANCO'));
                const filter2 = q.or(q.eq('idcustomuser', 'AZZURRO'), q.eq('idcustomuser', 'BIANCO'), q.eq('idcustomuser', 'NERO'));
                ds.newTable(t1name);
                ds.newTable(t2name);
                const selBuilderArray = [];
                selBuilderArray.push({filter: filter1, top: null, tableName: t1name, table: ds.tables[t1name]});
                selBuilderArray.push({filter: filter2, top: null, tableName: t2name, table: ds.tables[t2name]});

                const ar = selBuilderArray.map((sel) => {
                    let objser = q.toObject(sel.filter);
                    let filterSerialized = JSON.stringify(objser);
                    return {
                        table: sel.table.serialize(true),
                        top: sel.top,
                        tableName: sel.tableName,
                        filter: filterSerialized
                    };
                });
                const selBuilderArrPrm = JSON.stringify({arr: ar});

                request({
                    url: 'http://localhost:54471/test/data/multiRunSelect',
                    method: 'POST',
                    form: {
                        selBuilderArr: selBuilderArrPrm
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(response).toBeDefined();
                    const objParsed = JSON.parse(body);
                    const ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);
                    expect(ds.name).toBe('temp');
                    expect(ds.tables.customuser.rows.length).toBe(2);
                    expect(ds.tables.customusergroup.rows.length).toBe(3);
                    done();
                });
            }, timeout);

        it("getDataSet ws: dataset customuser_test returned",
            function (done){
                request({
                    url: 'http://localhost:54471/test/data/getDataSet',
                    method: 'POST',
                    form: {
                        tableName: 'customuser',
                        editType: 'test'
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(response).toBeDefined();
                    const objParsed = JSON.parse(body);
                    const ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);
                    expect(ds.name).toBe('customuser_test');
                    expect(ds.tables.customuser).toBeDefined();
                    expect(ds.tables.customgroup).toBeDefined();
                    expect(ds.tables.customusergroup).toBeDefined();
                    expect(Object.keys(ds.tables).length).toBe(3);
                    expect(Object.keys(ds.tables.customuser.columns).length).toBeGreaterThan(1);
                    expect(Object.keys(ds.relations).length).toBe(1);
                    done();
                });
            }, timeout);

        it("getPagedTable ws: returns customusergroup paged datatable",
            function (done){
                let filter = q.or(q.eq('idcustomuser', 'AZZURRO'),
                    q.eq('idcustomuser', 'BIANCO'),
                    q.eq('idcustomuser', 'NERO'));
                let objser = q.toObject(filter);
                let filterSerialized = JSON.stringify(objser);
                const tableName = 'customusergroup';
                const listType = 'default';
                request({
                    url: 'http://localhost:54471/test/data/getPagedTable',
                    method: 'POST',
                    form: {
                        tableName: tableName,
                        nPage: 1,
                        nRowPerPage: 5,
                        filter: filterSerialized,
                        listType: listType,
                        sortby: null
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    const objParsed = JSON.parse(body);
                    const totpage = objParsed.totpage;
                    const totrows = objParsed.totrows;
                    expect(totpage).toBe(1);
                    expect(totrows).toBe(3);
                    const dtObj = JSON.parse(objParsed.dt);
                    const dt = new jsDataSet.DataTable(dtObj.name);
                    dt.deSerialize(dtObj, true);
                    expect(dt.name).toBe('customusergroup');
                    expect(dt.rows.length).toBe(3);
                    done();
                });
            }, timeout);

        it("getDsByRowKey: return dataset populated based on row",
            function (done){
                // 1. recupero dataset vuoto
                request({
                    url: 'http://localhost:54471/test/data/getDataSet',
                    method: 'POST',
                    form: {
                        tableName: 'customuser',
                        editType: 'test'
                    }
                }, function (error, response, body){

                    expect(response).toBeDefined();
                    const objParsed = JSON.parse(body);
                    const ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);

                    //
                    const idcustomuser = 'AZZURRO';
                    const objrow = {idcustomuser: idcustomuser};
                    ds.tables.customuser.add(objrow);
                    ds.tables.customuser.acceptChanges();

                    const filter = q.eq('idcustomuser', idcustomuser);
                    let objser = q.toObject(filter);
                    let filterSerialized = JSON.stringify(objser);
                    request({
                        url: 'http://localhost:54471/test/data/getDsByRowKey',
                        method: 'POST',
                        form: {
                            tableName: 'customuser',
                            editType: 'test',
                            filter: filterSerialized
                        }
                    }, function (error, response, body){

                        if (error){
                            console.log(error);
                            expect(true).toBe(false);
                            done();
                            return;
                        }
                        expect(response).toBeDefined();
                        const objParsed = JSON.parse(body);
                        const ds = new jsDataSet.DataSet(objParsed.name);
                        ds.deSerialize(objParsed, true);
                        expect(ds.name).toBe('customuser_test');
                        expect(ds.tables.customuser.rows.length).toBe(1);
                        expect(ds.tables.customusergroup.rows.length).toBe(1);
                        expect(ds.tables.customuser.rows[0].idcustomuser).toBe(idcustomuser);
                        expect(ds.tables.customusergroup.rows[0].idcustomuser).toBe(idcustomuser);

                        done();
                    });
                });

            }, timeout);

        it("doGet empty ds AND onlyPeripherals: false",
            function (done){

                const idcustomuser = 'AZZURRO';

                // recupera un dataset e poi lo popola a aprtire dalla riga principale
                request({
                    url: 'http://localhost:54471/test/data/getDataSet',
                    method: 'POST',
                    form: {
                        tableName: 'customuser',
                        editType: 'test'
                    }
                }, function (error, response, body){

                    const objParsed = JSON.parse(body);
                    const ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);

                    const objrow = {idcustomuser: idcustomuser};
                    ds.tables.customuser.add(objrow);
                    ds.tables.customuser.acceptChanges();
                    const objser = ds.serialize(true);
                    const dsSerialized = JSON.stringify(objser);

                    const filter = ds.tables.customuser.keyFilter(objrow);
                    let objserFilter = q.toObject(filter);
                    let filterSerialized = JSON.stringify(objserFilter);
                    request({
                        url: 'http://localhost:54471/test/data/doGet',
                        method: 'POST',
                        form: {
                            ds: dsSerialized,
                            primaryTableName: 'customuser',
                            filter: filterSerialized,
                            onlyPeripherals: false
                        }
                    }, function (error, response, body){

                        if (error){
                            console.log(error);
                            expect(true).toBe(false);
                            done();
                            return;
                        }
                        const objParsed = JSON.parse(body);
                        const ds = new jsDataSet.DataSet(objParsed.name);
                        ds.deSerialize(objParsed, true);
                        expect(ds.name).toBe('customuser_test');
                        expect(ds.tables.customuser.rows.length).toBe(1);
                        expect(ds.tables.customusergroup.rows.length).toBe(1);
                        expect(ds.tables.customuser.rows[0].idcustomuser).toBe(idcustomuser);
                        expect(ds.tables.customusergroup.rows[0].idcustomuser).toBe(idcustomuser);
                        done();
                    });
                });

            }, timeout);

        it("doGet empty ds AND onlyPeripherals: true",
            function (done){

                const idcustomuser = 'AZZURRO';

                // recupera un dataset e poi lo popola a aprtire dalla riga principale
                request({
                    url: 'http://localhost:54471/test/data/getDataSet',
                    method: 'POST',
                    form: {
                        tableName: 'customuser',
                        editType: 'test'
                    }
                }, function (error, response, body){

                    const objParsed = JSON.parse(body);
                    const ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);

                    const objrow = {idcustomuser: idcustomuser};
                    ds.tables.customuser.add(objrow);
                    ds.tables.customuser.acceptChanges();
                    const objser = ds.serialize(true);
                    const dsSerialized = JSON.stringify(objser);

                    const filter = ds.tables.customuser.keyFilter(objrow);
                    let objserFilter = q.toObject(filter);
                    let filterSerialized = JSON.stringify(objserFilter);
                    request({
                        url: 'http://localhost:54471/test/data/doGet',
                        method: 'POST',
                        form: {
                            ds: dsSerialized,
                            primaryTableName: 'customuser',
                            filter: filterSerialized,
                            onlyPeripherals: true
                        }
                    }, function (error, response, body){

                        if (error){
                            console.log(error);
                            expect(true).toBe(false);
                            done();
                        }
                        const objParsed = JSON.parse(body);
                        const ds = new jsDataSet.DataSet(objParsed.name);
                        ds.deSerialize(objParsed, true);
                        expect(ds.name).toBe('customuser_test');
                        // soloe le periferiche poichè  onlyPeripherals: true
                        expect(ds.tables.customuser.rows.length).toBe(1);
                        expect(ds.tables.customusergroup.rows.length).toBe(0);
                        done();
                    });
                });

            }, timeout);

        it("setUsrEnv ws: set usr-env test variable",
            function (done){
                request({
                    url: 'http://localhost:54471/test/data/setUsrEnv',
                    method: 'POST',
                    form: {
                        key: 'test_key',
                        value: 'test_value'
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        console.log(body.parsed.error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(response).toBeDefined();
                    expect(typeof body).toBe("string");
                    expect(body).toBe("test_value");
                    done();
                });
            }, timeout);

        it("doReadValue ws: read and get a value in a table",
            function (done){
                let filter = q.eq('idcustomuser', 'AZZURRO');
                let objser = q.toObject(filter);
                let filterSerialized = JSON.stringify(objser);

                request({
                    url: 'http://localhost:54471/test/data/doReadValue',
                    method: 'POST',
                    form: {
                        table: 'customusergroup',
                        expr: 'idcustomgroup',
                        filter: filterSerialized,
                        orderby: null
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(response).toBeDefined();
                    expect(typeof body).toBe("string");
                    expect(body).toBe("ORGANIGRAMMA");
                    done();
                });
            }, timeout);

        it("changeRole ws: re-calculates environment",
            function (done){
                const idflowchart = '230001';
                const ndetail = '1';
                request({
                    url: 'http://localhost:54471/test/data/changeRole',
                    method: 'POST',
                    form: {
                        idflowchart: idflowchart,
                        ndetail: ndetail,
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    const objParsed = JSON.parse(body);
                    expect(Object.keys(objParsed.sys).length).toBeGreaterThan(0);
                    expect(Object.keys(objParsed.usr).length).toBeGreaterThan(0);
                    expect(objParsed.sys.usergrouplist).toBe('ORGANIGRAMMA');
                    done();
                });
            }, timeout);

        it("createTableByName ws: create table, with * options, all columns",
            function (done){
                const tableName = 'customuser';
                const columnList = '*';
                request({
                    url: `http://localhost:54471/test/data/createTableByName?tableName=${tableName}&columnList=${columnList}`,
                    method: 'GET'
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(response).toBeDefined();
                    const dtObj = JSON.parse(body);
                    const dt = new jsDataSet.DataTable(dtObj.name);
                    dt.deSerialize(dtObj, true);
                    expect(dt.name).toBe(tableName);
                    expect(Object.keys(dt.columns).length).toBe(8);
                    done();
                });
            }, timeout);

        it("createTableByName ws: create table with 2 column",
            function (done){
                const tableName = 'customuser';
                const columnList = 'idcustomuser,username';
                request({
                    url: `http://localhost:54471/test/data/createTableByName?tableName=${tableName}&columnList=${columnList}`,
                    method: 'GET'
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(response).toBeDefined();
                    const dtObj = JSON.parse(body);
                    const dt = new jsDataSet.DataTable(dtObj.name);
                    dt.deSerialize(dtObj, true);
                    expect(dt.name).toBe(tableName);
                    expect(Object.keys(dt.columns).length).toBe(2);
                    done();
                });
            }, timeout);

        it("saveDataSet ws: save dataset table customusergroup without rules ok",
            function (done){
                const tableName = 'customuser';
                const editType = 'test';
                const idcustomgroup = 'ORGANIGRAMMA';
                const idcustomuser = 'AZZURRO';

                // recupera un dataset e poi lo popola a aprtire dalla riga principale
                request({
                    url: 'http://localhost:54471/test/data/getDataSet',
                    method: 'POST',
                    headers: {
                        "language": "it"
                    },
                    form: {
                        tableName: tableName,
                        editType: editType
                    }
                }, function (error, response, body){
                    const objParsed = JSON.parse(body);
                    const ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);

                    const objrow = {idcustomgroup: idcustomgroup};
                    ds.tables.customusergroup.add(objrow);
                    ds.tables.customusergroup.acceptChanges();

                    const filter = q.eq('idcustomuser', idcustomuser);
                    let objser = q.toObject(filter);
                    let filterSerialized = JSON.stringify(objser);
                    request({
                        url: 'http://localhost:54471/test/data/getDsByRowKey',
                        method: 'POST',
                        headers: {
                            "language": "it"
                        },
                        form: {
                            tableName: tableName,
                            editType: editType,
                            filter: filterSerialized
                        }
                    }, function (error, response, body){

                        const objParsed = JSON.parse(body);
                        const ds = new jsDataSet.DataSet(objParsed.name);
                        ds.deSerialize(objParsed, true);
                        // 3. modifico il dataset
                        const field = "lu";
                        const tcustomusergroup = ds.tables.customusergroup;
                        const rowTested = tcustomusergroup.rows[0];
                        const characterToAdd = "%";
                        // evito di aggiugneread ogni lancio dit est il "newValue", quindi se la stringa contiene come ultimo carattere "newValue"
                        // lo rimuovo, altrimenti lo concateno (la volta successiva così lo rimuovo)
                        const originalValue = rowTested[field];
                        const newValue = originalValue + characterToAdd;
                        tcustomusergroup.assignField(rowTested, field, newValue);
                        tcustomusergroup.rows[0].getRow().state = jsDataSet.dataRowState.modified;

                        const objser = ds.serialize(true);
                        const dsSerialized = JSON.stringify(objser);
                        request({
                            url: 'http://localhost:54471/test/data/saveDataSet',
                            headers: {
                                "language": "it"
                            },
                            method: 'POST',
                            form: {
                                tableName: tableName,
                                editType: editType,
                                filter: filterSerialized,
                                ds: dsSerialized
                            }
                        }, function (error, response, body){

                            if (error){
                                console.log(error);
                                expect(true).toBe(false);
                                done();
                                return;
                            }
                            expect(response).toBeDefined();
                            const objParsed = JSON.parse(body);

                            //const dsObj = JSON.parse(objParsed.dataset);
                            const success = objParsed.success;
                            const canIgnore = objParsed.canIgnore;
                            const messages = objParsed.messages;
                            //console.log(messages);

                            const ds = new jsDataSet.DataSet(objParsed.dataset.name);
                            ds.deSerialize(objParsed.dataset, true);
                            expect(ds.name).toBe('customuser_test');

                            expect(messages.length).toBe(0); //non ci sono messaggi
                            expect(success).toBe(true); // metodo esegue correttamente
                            expect(canIgnore).toBe(true); //

                            // verifico almeno 1 riga, altrimenti test non è attendibile
                            expect(tcustomusergroup.rows.length).toBeGreaterThan(0);

                            _.forEach(tcustomusergroup.rows, function (r){
                                expect(r.idcustomgroup).toBe(idcustomgroup);
                            });
                            // mi aspetto che il valore sia cambiato
                            expect(tcustomusergroup.rows[0][field]).toBe(newValue);
                            done();
                        });
                    });
                });
            });

        it("saveDataSet ws: save dataset table customuser unsucess. get 1 message POST rule",
            function (done){
                const tableName = 'customuser';
                const editType = 'test';
                const idcustomuser = 'AZZURRO';

                // recupera un dataset e poi lo popola a aprtire dalla riga principale
                request({
                    url: 'http://localhost:54471/test/data/getDataSet',
                    method: 'POST',
                    form: {
                        tableName: tableName,
                        editType: editType
                    }
                }, function (error, response, body){

                    const objParsed = JSON.parse(body);
                    const ds = new jsDataSet.DataSet(objParsed.name);
                    ds.deSerialize(objParsed, true);

                    const objrow = {idcustomuser: idcustomuser};
                    ds.tables.customuser.add(objrow);
                    ds.tables.customuser.acceptChanges();

                    const filter = q.eq('idcustomuser', idcustomuser);
                    let objser = q.toObject(filter);
                    let filterSerialized = JSON.stringify(objser);
                    request({
                        url: 'http://localhost:54471/test/data/getDsByRowKey',
                        method: 'POST',
                        form: {
                            tableName: tableName,
                            editType: editType,
                            filter: filterSerialized
                        }
                    }, function (error, response, body){

                        let objParsed = JSON.parse(body);
                        let ds = new jsDataSet.DataSet(objParsed.name);
                        ds.deSerialize(objParsed, true);
                        // 3. modifico il dataset
                        const field = "username";
                        const tcustomuser = ds.tables.customuser;
                        const rowTested = tcustomuser.rows[0];
                        const characterToAdd = "%";
                        // evito di aggiugneread ogni lancio dit est il "newValue", quindi se la stringa contiene come ultimo carattere "newValue"
                        // lo rimuovo, altrimenti lo concateno (la volta successiva così lo rimuovo)
                        const originalValue = rowTested[field];
                        const newValue = originalValue + characterToAdd;
                        tcustomuser.assignField(rowTested, field, newValue);
                        tcustomuser.rows[0].getRow().state = jsDataSet.dataRowState.modified;

                        const objser = ds.serialize(true);
                        const dsSerialized = JSON.stringify(objser);
                        request({
                            url: 'http://localhost:54471/test/data/saveDataSet',
                            method: 'POST',
                            form: {
                                tableName: tableName,
                                editType: editType,
                                filter: filterSerialized,
                                ds: dsSerialized
                            }
                        }, function (error, response, body){
                            //console.log(response);

                            if (error){
                                console.log(error);
                                expect(true).toBe(false);
                                done();
                                return;
                            }
                            expect(response).toBeDefined();
                            const objParsed = JSON.parse(body);

                            const dsObj = objParsed.dataset;
                            const success = objParsed.success;
                            const canIgnore = objParsed.canIgnore;
                            const messages = objParsed.messages;

                            const ds = new jsDataSet.DataSet(dsObj.name);
                            ds.deSerialize(dsObj, true);
                            expect(ds.name).toBe('customuser_test');
                            //console.log(messages);
                            expect(messages.length).toBe(1); //non ci sono messaggi
                            expect(messages[0].description).toBe('operation not permitted msg');
                            expect(messages[0].id).toBe('post/undefined/U/1');
                            expect(messages[0].audit).toBe('TEST001');
                            expect(messages[0].severity).toBe('E');
                            expect(success).toBe(false);
                            expect(canIgnore).toBe(false); //

                            // verifico almeno 1 riga, altrimenti test non è attendibile
                            expect(tcustomuser.rows.length).toBeGreaterThan(0);

                            _.forEach(tcustomuser.rows, function (r){
                                expect(r.idcustomuser).toBe(idcustomuser);
                            });
                            // mi aspetto che il valore sia cambiato
                            expect(tcustomuser.rows[0][field]).toBe(newValue);
                            done();
                        });
                    });
                });
            }, timeout);
        // ----> AUTH CONTROLLER

        it('login username and password not exists get Bad Credential',
            function (done){
                const userName = 'AZZURRO';
                const password = '-------';
                request({
                    url: `http://localhost:54471/test/auth/login`,
                    method: 'POST',
                    form: {
                        userName: userName,
                        password: password,
                        datacontabile: (new Date(2023,12,31)).toJSON(),
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(body).toBeDefined('Bad credentials');
                    expect(response.statusCode).toBeDefined(401);
                    done();
                });
            }, timeout);

        it('login username and wrong password get Bad Credential',
            function (done){
                const userName = 'AZZURRO';
                const password = 'SEG_PSUMA';
                request({
                    url: `http://localhost:54471/test/auth/login`,
                    method: 'POST',
                    form: {
                        userName: userName,
                        password: password,
                        datacontabile: (new Date(2023,12,31)).toJSON(),
                    }
                }, function (error, response, body){
                    if (error){
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(body).toBeDefined('Bad credentials');
                    expect(response.statusCode).toBeDefined(401);
                    done();
                });
            }, timeout);

        it('getMeta should get Metadata', () => {
            GetMeta.setPath('./../../meta/');
            let m = GetMeta.getMeta("attach");
            expect(m.name).toBe("meta_attach");
        });

        // ----> FILE CONTROLLER
        it('upload file chunk less 1MB.',
            function (done){

                // simulo nome file come atteso dal backend (CONVENZIONE!)
                const partCount = 1;
                const totalParts = 1;
                const fileName = 'fakeUploadTestUnder1MB.txt';
                const separatorFileName = '$__$';
                const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c){
                    let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
                const fname = guid + separatorFileName + fileName;
                const filePartName = fname + ".part_" + partCount + "." + totalParts;
                const path = 'test/data/jsApplication/' + fileName;

                let formData = new FormData();
                formData.append("file", fs.createReadStream(path), filePartName);

                fetch('http://localhost:54471/test/file/uploadchunk',
                        {method: 'POST', body: formData})
                .then((response)=> {
                    //console.log(response);
                    expect(response).toBeDefined();
                    return response.json();
                })
                .then((objParsed)=>{
                        const ds = new jsDataSet.DataSet(objParsed.name);
                        ds.deSerialize(objParsed, true);
                        //console.log(ds.tables.attach);
                        //console.log(ds.tables.attach.rows);
                        expect(ds.name).toBe('attach_default');
                        expect(ds.tables.attach.rows.length).toBe(1);
                        expect(ds.tables.attach.rows[0].idattach).toBe(1);
                        expect(ds.tables.attach.rows[0].filename.indexOf(fileName)).toBeGreaterThan(0);
                        expect(ds.tables.attach.rows[0].size).toBe(56);

                        // verifico ci sia il file
                        let allFiles = fs.readdirSync(uploadPath);
                        let files = _.filter(allFiles, fname => fname.indexOf(fileName) > 0);
                        expect(files.length).toBe(1);
                        done();
                },
                (error)=>{
                    expect(true).toBe(false);
                    done.fail(error);
                    return;
                });


            });


        it('upload file with 2 chunk. Chunk are merged in single file on backend',
           async function (){

               // simulo nome file come atteso dal backend (CONVENZIONE!)
               let partCount = 1;
               const totalParts = 2;
               const chunkName = 'fakeUploadTestChunk.txt';
               const chunk1 = 'fakeUploadTestChunk1.txt';
               const chunk2 = 'fakeUploadTestChunk2.txt';
               const separatorFileName = '$__$';
               const guid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c){
                   let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                   return v.toString(16);
               });
               const fname = guid + separatorFileName + chunkName;
               let filePartName = fname + ".part_" + partCount + "." + totalParts;
               let path = 'test/data/jsApplication/' + chunk1;

               let formData = new FormData();
               formData.append("file", fs.createReadStream(path), filePartName);

               //formData.file.value.path = path.replace(chunk1, filePartName);

               let response = await fetch('http://localhost:54471/test/file/uploadchunk',
                   {method: 'POST', body: formData});

               expect(response).toBeDefined();
               //
               expect(response.ok).toBe(true);
               // let txt = await response.text();
               // expect(txt).toBe("");

               // INVIO 2o chunk
               partCount++;
               filePartName = fname + ".part_" + partCount + "." + totalParts;
               path = 'test/data/jsApplication/' + chunk2;

               formData = new FormData();
               formData.append("file", fs.createReadStream(path), filePartName);

               response = await fetch('http://localhost:54471/test/file/uploadchunk',
                   {method: 'POST', body: formData});

               let objParsed = await response.json();


               // lato server il fileName è "skyppato". utilizza il fileName orginale e quindi forzo il nome con la convenzione.
               //formData.file.value.path = path.replace(chunk2, filePartName);
               const ds = new jsDataSet.DataSet(objParsed.name);
               ds.deSerialize(objParsed, true);
               expect(ds.name).toBe('attach_default');
               expect(ds.tables.attach.rows.length).toBe(1);
               expect(ds.tables.attach.rows[0].idattach).toBe(2);
               expect(ds.tables.attach.rows[0].filename.indexOf(chunkName)).toBeGreaterThan(0);
               expect(ds.tables.attach.rows[0].size).toBe(111);

               // verifico ci sia il file
               let allFiles = fs.readdirSync(uploadPath);
               let files = _.filter(allFiles, fname => {
                   return fname.indexOf(chunkName) > 0;
               });
               // verifico ce ne sia solo uno e le _part_x_y siano state quindi eliminate
               // dal be durante il merge
               expect(files.length).toBe(1);

               // verifico il contenuto sia il merge dei 2 file.
               const content = fs.readFileSync(uploadPath + files[0]);
               const contentMerged =
                   '1 test file used to test upload api rest for node js.\r\n' +
                   '2. test file used to test upload api rest for node js.\r\n';
               expect(content.toString()).toBe(contentMerged);

           });


        it('download file (after test upload file chunk less 1MB. ok)',
            function (done) {
                request({
                    url: `http://localhost:54471/test/file/download?idattach=1`,
                    method: 'GET'
                }, async function (error, response, body) {
                    if (error) {
                        console.log(error);
                        expect(true).toBe(false);
                        done();
                        return;
                    }
                    expect(body.indexOf('1. test file used to test upload api rest for node js.')).not.toBe(-1);
                    done();
                });
            });


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
        });



        it('should delete uploaded files',  function (done) {
            let allFiles = fs.readdirSync(uploadPath);
            const totFileToClear = 2;
            // mi aspetto totFileToClear file caricati durante test. Uno per singolo chunk, il secondo con multipli chunk
            expect(allFiles.length).toBe(totFileToClear);
            // li elimino tutti
            for (let fname of allFiles) {
                fs.unlinkSync(uploadPath + fname);
            }
            allFiles = fs.readdirSync(uploadPath);
            expect(allFiles.length).toBe(0);
            done();
        });
    });
