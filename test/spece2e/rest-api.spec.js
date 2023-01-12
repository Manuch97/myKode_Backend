
// const q = require('../../client/components/metadata/jsDataQuery');
// const jsDataSet = require("../../client/components/metadata/jsDataSet");
//
const q = window.jsDataQuery;
const jsDataSet=window.jsDataSet;

//const configName = path.join('config',  'dbList.json');


describe('rest api',
    function() {

        const timeout = 100000;

        it("select ws: query on customer returns DataTable",
            function (done) {
                //var q = jsDataQuery;
                let filter = q.or(q.eq('idcustomer',1) ,q.eq('idcustomer',2),
                        q.eq('idcustomer',3));
                let objser = q.toObject(filter);
                let filterSerialized =  JSON.stringify(objser);
                let options   = {
                    url: 'http://localhost:54471/test/data/select',
                    type: 'POST',
                    data: {
                        tableName: 'customer',
                        columnList: "idcustomer,name",
                        top: 10,
                        filter: filterSerialized
                    },
                    timeout : 20000,
                    success: (res) => {
                        expect(res).toBeDefined();
                        const dtObj = JSON.parse(res);
                        const dt = new jsDataSet.DataTable(dtObj.name);
                        dt.deSerialize(dtObj, true);
                        expect(dt.name).toBe('customer');
                        expect(dt.rows.length).toBe(3);
                        done();
                    },
                    error: (xhr, ajaxOptions, thrownError) => {
                        console.log(thrownError);
                        expect(true).toBe(false);
                        done();
                    }
                };
                jQuery.ajax(options);

            }, timeout);

        it("getDataSet ws: dataset returned",
            function (done) {
                var options   = {

                    url: 'http://localhost:54471/test/data/getDataSet',
                    type: 'POST',
                    data: {
                        tableName: 'customuser',
                        editType: 'test'
                    },
                    timeout : 20000,
                    success: (res) => {
                        expect(res).toBeDefined();
                        var objParsed = JSON.parse(res);
                        var ds = new jsDataSet.DataSet(objParsed.name);
                        ds.deSerialize(objParsed, true);
                        expect(ds.name).toBe('customuser_test');
                        expect(ds.tables.customuser).toBeDefined();
                        expect(Object.keys(ds.relations).length).toBeGreaterThan(0);
                        done();
                    },
                    error: (xhr, ajaxOptions, thrownError) => {
                        console.log(xhr);
                        expect(true).toBe(false);
                        done();
                    }
                };
                jQuery.ajax(options);

            }, timeout);


});
