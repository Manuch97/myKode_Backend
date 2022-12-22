/*globals define,self */

console.log("running MetaDataSpec");
let LocalResource = require("./../../client/components/metadata/LocalResource");
let LocalResourceIT = require("./../../client/components/i18n/LocalResourceIt");

let localResource = new LocalResource();
localResource.setLanguage("it");

let MetaData = require("./../../client/components/metadata/MetaData");

let jsDataSet = require("./../../client/components/metadata/jsDataSet");
const CType = jsDataSet.CType;

let jsDataQuery = require("./../../client/components/metadata/jsDataQuery");

describe('MetaData', function () {
    beforeEach(function() {
        //MetaData = appMeta.MetaData;
        //loadFixtures('HtmlPageTest.html');

    });

    describe("MetaData class",
        function () {


            it('exists',
                function () {
                    expect(MetaData).toBeDefined();
                });

            it('appMeta.MetaData is an object MetaData',
                function () {
                    expect(MetaData.name).toBe("MetaData");
                });

            it('MetaData constructor is MetaData ',
                function () {
                    expect(MetaData.prototype.constructor.name).toBe("MetaData");
                });

            it('MetaData instance  has isValid ',
                function () {
                    var meta = new MetaData();
                    expect(meta.isValid).toBeDefined();
                });

            it('isValid() works ',
                function (done) {
                    let emptyKeyMsg = localResource.dictionary.emptyKeyMsg;
                    let emptyFieldMsg = localResource.dictionary.emptyFieldMsg;
                    let stringTooLong =  localResource.dictionary.stringTooLong;
                    let noDataSelected =  localResource.dictionary.noDataSelected;

                    const ds = new jsDataSet.DataSet("temp");
                    const t = ds.newTable("t");
                    let objrow1, objrow2, objrow3, objrow4 ;

                    t.setDataColumn("Code", CType.number);
                    t.setDataColumn("Name", CType.string);
                    t.setDataColumn("City", CType.string);
                    t.setDataColumn("Born", CType.date);
                    t.setDataColumn("Age", CType.int);

                    t.columns["Code"].allowDbNull = false;
                    t.columns["Name"].allowDbNull = false;
                    t.columns["City"].allowDbNull = false;
                    t.columns["Born"].allowDbNull = false;
                    t.columns["Age"].allowDbNull = false;

                    t.columns["Code"].allowZero = false;

                    t.columns["City"].maxstringlen = 10;


                    t.key(["Code", "Name"]);


                    objrow1 = { "Code": 1, "Name": "uno", "City":"Roma", "Born":new Date("1980-10-02"), "Age": 30};
                    objrow2 = { "Code": 0, "Name": "due", "City":"Napoli", "Born":new Date("1981-10-02"), "Age": 40};
                    objrow3 = { "Code": 3, "Name": "tre", "City":"Bari", "Born":new Date("1000-01-01"), "Age": 50};
                    objrow4 = { "Code": 4, "Name": "quattro", "City":"Caltanissetta", "Born":new Date("1983-10-02"), "Age": 60}; // nome città lungo
                    t.add(objrow1);
                    t.add(objrow2);
                    t.add(objrow3);
                    t.add(objrow4);

                    var meta = new MetaData();
                    meta.setLanguage("it");

                    meta.isValid(objrow1.getRow()).then(function (result) {
                        expect(result).toBeNull();
                    });

                    meta.isValid().then(function (result) {
                        expect(result).not.toBeNull("isValid without data gives error");
                        expect(result.errMsg).toContain(noDataSelected);
                    });

                    meta.isValid(objrow2.getRow()).then(function (result) {
                        expect(result).not.toBeNull("Zero column with allowZero false errors");
                        expect(result.errField).toBe("Code");
                        expect(result.errMsg).toContain(emptyKeyMsg); // colonna zero e non permette zero
                    });

                    meta.isValid(objrow3.getRow()).then(function (result) {
                        expect(result).not.toBeNull("empty Date with not allowNull errors");
                        expect(result.errField).toBe("Born");
                        expect(result.errMsg).toContain(emptyFieldMsg); // data default vuota
                    });

                    meta.isValid(objrow4.getRow()).then(function (result) {
                        expect(result).not.toBeNull("string too long errors");
                        expect(result.errField).toBe("City");
                        expect(result.errMsg).toContain(stringTooLong);
                    });

                    done();

                });

            it('sortedColumnNameList works', function () {
                var ds = new jsDataSet.DataSet("temp");
                var t1 = ds.newTable("table1");
                t1.setDataColumn("1", "String");
                t1.setDataColumn("!2", "String");
                t1.setDataColumn("3", "String");
                t1.setDataColumn("4", "String");
                t1.setDataColumn("!5", "String");
                t1.setDataColumn("6", "String");

                t1.columns["1"].listColPos = 2;
                t1.columns["4"].listColPos = -1;
                t1.columns["6"].listColPos = 1;

                t1.columns["3"].expression = "table1.2";
                t1.columns["3"].listColPos = 3;

                var meta = new MetaData();

                var fields = meta.sortedColumnNameList(t1);

                expect(fields).toBe("6,1");

            });



        });

});