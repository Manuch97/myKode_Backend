console.log("running jsSpec");
// https://docs.microsoft.com/en-us/dotnet/csharp/iterators
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Iterators_and_Generators

const    _ = require('lodash');
const Deferred = require("JQDeferred");

describe('Test Corso', function () {

    beforeEach(function () {

    });

    /**
     *
     * @param {object}I0
     * @param {Date}I0.date
     * @param {Date}I0.stipendio
     * @param {int}I0.anzianità
     * @param {Date} t0
     * @return {Generator<*, {{number}importo_corrente, {Date}data_prossimo_avanzamento}, *>}
     */
    function* linea1(I0, t0){
        /** calcoli **/
        for(let i=0;i<10;i++){
            yield {importo_corrente: I0.stipendio+ 1000*i, data_prossimo_avanzamento: I0.date.addYear(i)};
        }
    }

    function indexOfSmallest(a) {
        var lowest = null;
        var lowestValue=null;
        for (var i = 1; i < a.length; i++) {
            if (lowest === null){
                if (a[i].data_prossimo_avanzamento!==null) {
                    lowestValue= a.data_prossimo_avanzamento;
                    lowest=i;
                }
                continue;
            }
            if (a[i].data_prossimo_avanzamento < lowestValue) {
                lowest = i;
                lowestValue=a[i].data_prossimo_avanzamento;
            }
        }
        return lowest;
    }

    function* linea2(I0, t0){    }
    function* linea3(I0, t0){   }
    function* linea4(I0, t0){   }

    let linee = [linea1,linea2,linea3,linea4];

    function* generaElencoCambiamenti(I0,t0){
        let generatori = linee.map(f => f(I0,t0));
        let valoreLinee = generatori.map(g => g.next()); //_.map(linee, f=>f(,,,))
        yield valoreLinee;
        let indice_prossimo_avanzamento = indexOfSmallest(valoreLinee);
        while (indice_prossimo_avanzamento!==null){
            valoreLinee[indice_prossimo_avanzamento]= generatori[indice_prossimo_avanzamento].next();
            indice_prossimo_avanzamento = indexOfSmallest(valoreLinee);
        }
    }

    function classeA(){
        console.log("constructor executed");
    }
    classeA.prototype = {
        constructor: classeA,

        dictionaries: {}, //shared between all instances of application

        localizedResources: {},

        register:function(code){
            //console.log(this);
            classeA.prototype.dictionaries[code]=1;
        },
        getDict:function (code){
            //console.log(this);
            return classeA.prototype.dictionaries[code];
        }
    };

    it('Methods on prototypes works also without instance', function () {

        classeA.prototype.register("A");
        expect(classeA.prototype.getDict("A")).toBe(1);

    });


    it('Deferred should be defined', function () {

        expect(Deferred).toBeDefined();
    });


    afterEach(function () {

    });


});