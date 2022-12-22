const express = require('express');
const  isAnonymousAllowed = require("../data/_AnonymousAllowed");
const jsDataSet = require("./../../client/components/metadata/jsDataSet");
const _ = require("lodash");
const asyncHandler = require('express-async-handler'); //https://zellwk.com/blog/async-await-express/
const metaModel = require("./../../client/components/metadata/MetaModel");
const attachUtils = require("./../../client/components/metadata/_attachmentutils");
const {DataSet} = require("./../../client/components/metadata/jsDataSet");
const jsBusinessLogic =require("../../src/jsBusinessLogic");
const {BusinessMessage} = require("../../src/jsBusinessLogic");


async function saveDataSet(req,res,next) {
    let ctx = req.app.locals.context;
    let ds = new DataSet();
    ds.deSerialize(JSON.parse(req.body.ds), true);

    let tableName = req.body.tableName;
    let editType = req.body.editType;

    try {
        let messagesJson = req.body.messages; //id, description, audit, severity, table, bool canIgnore
        let messages = null;
        if (messagesJson) {
            messages = JSON.parse(messagesJson);
        }
        let meta = ctx.getMeta(tableName);
        if (!meta) {
            res.status(500).json({error: "Not valid entity:" + tableName});
            return;
        }

        meta.editType = editType;

        if (!isAnonymousAllowed(req, tableName, editType, ds)) {
            res.status(400).send("Anonymous access not allowed");
        }

        let postData = ctx.createPostData.call(ctx);
        let prevResult = postData.createBusinessLogicResult();

        if (messages) { //messages is an array of id, description, audit, severity, table, bool canIgnore
            for (const m of messages) {
                prevResult.addMessage(deserializeMessage(m));
            }
        }
        let isValid = true;
         await forEachAsync(Object.keys(ds.tables), async (t) => {
            const table = ds.tables[t];
            if (t !== tableName && !metaModel.isSubEntity(table, ds.tables[tableName])) return true;
            let tName = table.tableForReading();
            let currMeta = ctx.getMeta(tName);
            if (!currMeta) {
                res.status(500).json({error: "Not valid entity:" + tName});
                return;
            }
            currMeta.setRequest(req);
            currMeta.editType = editType;
            currMeta.ds = ds;

           await forEachAsync(table.rows, async (row) => {
               let DR = row.getRow();
               if (DR.state === jsDataSet.dataRowState.unchanged) return true;
               let resValid;
               try {
                   resValid = await currMeta.isValid(DR);
                   if (resValid === null || resValid===undefined) return true;
                   isValid = false;

                   // at run time for serialization id property is evalued as
                   // this.description = description;
                   // this.audit = audit;
                   // this.severity = severity; // "Errore" || "Avvertimento" || "Disabilitata"
                   // this.table = table;
                   // this.canIgnore = canIgnore; // true/false
                   //
                   prevResult.addMessage(new jsBusinessLogic.BusinessMessage({
                       r: DR,
                       post: false,  // considero come pre
                       shortMsg: resValid.errMsg,    //errore breve, per le business rule

                       //Serialized as description
                       longMsg: `Tabella: ${tName} campo: ${resValid.errField}  err: ${resValid.errMsg}`,
                       canIgnore: false,
                       idDetail: "validazione",

                       //serialized as audit
                       idRule: "validazione",
                       environment: this.environment
                   }));
               } catch (e) {
                   isValid = false;
                   prevResult.addMessage(new jsBusinessLogic.BusinessMessage({
                       r: DR,
                       post: false,  // considero come pre
                       shortMsg: "Exception",    //errore breve, per le business rule

                       //Serialized as description
                       longMsg: `Bisogna rivedere il metodo isValid della tabella: ${tName}  err: ${e} ctx: ${JSON.stringify(ctx.localResource.dictionary)}`,
                       canIgnore: false,
                       idDetail: "validazione",

                       //serialized as audit
                       idRule: "Errore Metadato",
                       environment: this.environment
                   }));
               }
               return true;
           });
            return true;
        });

        if (!isValid) {
            let dsJson = JSON.stringify(ds.serialize(true));
            res.json({
                dataset: dsJson,
                messages: prevResult.checks.map(m => serializeMessage(m)),
                success: false,
                canIgnore: false
            });
            return;
        }

        let outDs = await ctx.getDataInvoke.createEmptyDataSet(tableName, editType);
        if (!outDs) {
            res.send(400, "DataSet non esistente");
            return;
        }

        _.forEach(outDs.tables, (table) => {
            let dtInput = ds.tables[table.name];
            if (dtInput) {
                table.merge(dtInput);
                // copio le prop di autoincremento
                table.autoIncrementColumns = _.cloneDeep(dtInput.autoIncrementColumns);
            }
        });



        await postData.init(outDs, ctx);

        // 7. valuto se ci sono tabelle con allegati, cioè colonna idattach per convenzione
        // se ci sono costruisco un dsattach nuovo dove inserisco la logica dei contatori
        // che serve per gestire l'algoritmo di persistenza degli allegati, in base all'operazione
        // creo ds attach in cui inserirò la nuova riga sulla tabella attach. Questa operazione
        // va fatta in questo punto perchè il save del dell'allegato è fatto in un altra chiamata, e devo tenere
        //  persistenti e sincronizzate le 2 sorgenti, filesystem e db. quindi gestisco con i contatori
        //  su una tabella del db

		let dsattach = await attachUtils.getDsAttachWithCounterUpdated(ctx, outDs);
        if (dsattach) {
            await postData.init(dsattach, ctx);
        }
        let dataRowAttachModified = await attachUtils.manageAttachWindowsCompliant(ctx, outDs);
        manageRegistration(outDs);
        let postResult = await postData.doPost({previousRules: prevResult});

        let success = true;

        // sarà true se tutti i messaggi sono ignorabili, false se almeno 1 messaggio  non è ignorabile
        // se ci sono messaggi , significa che la transazione non è stata eseguita, e devo amndare messaggi opportuni al client.
        let canIgnore = true;

        if (postResult.checks.length > 0) {
            success = false;
            canIgnore = postResult.canIgnore;
            attachUtils.sanitizeDsForAttachUnsuccess(dataRowAttachModified);
        }
        else {
            await attachUtils.removeAttachmentAfterSuccess(dataRowAttachModified, ctx);
            await attachUtils.sanitizeDsForAttach(outDs, ctx);
        }

        let dsSerialized = outDs.serialize(true);

        res.json({
            dataset: dsSerialized,
            messages: postResult.checks.map(m => serializeMessage(m)),
            success: success,
            canIgnore: postResult.canIgnore
        });

    }
    catch(ex){
        res.status(500).send("saveDatSet(tableName="+tableName+",editType="+editType + ' ' + ex.stack );
    }
}

function manageRegistration(ds) {
    // prevista ma non fa nulla per ora
}

async function forEachAsync(arr, fn) {
    for (let t of arr) { await fn(t); }
}

/**
 * @typedef BusinessMessageData
 * @property id:string
 * @property description:string
 * @property audit:string
 * @property severity:string
 * @property table:string
 * @property canIgnore:bool
 */
/**
 *
 * @param {BusinessMessage} msg
 * @return  {BusinessMessageData}
 */
function serializeMessage(msg){
    let table= msg.__table;
    if (!table) {

    }
    let pre_post = msg.post?"post":"pre";
    let id="dberror";

    //new messages
    if (msg.idDetail && msg.rowChange){
        let operation = "D";
        let /*RowChange*/ DR = msg.rowChange.r;
        table= DR.tableName;
        if (DR.state ===jsDataSet.dataRowState.added) operation="I";
        if (DR.state ===jsDataSet.dataRowState.modified) operation="U";
        return {
            id:pre_post+"/"+table+"/"+operation+"/"+msg.idDetail,
            description: msg.getMessage(),
            audit:msg.idRule,
            severity: msg.canIgnore? "W":"E",
            table: table,
            canIgnore: msg.canIgnore
        };
    }

    //old messages

    return {
        id:msg.__id, //
        description: msg.getMessage(),
        audit:msg.idRule,
        severity: msg.canIgnore? "W":"E",
        table: msg.__table,
        canIgnore: msg.canIgnore
    };

}

/**
 * Deserialize a message
 * @param {BusinessMessageData} msg
 * @return {BusinessMessage}
 */
function deserializeMessage(msg){
    // id =  pre_post + "/" + pm.TableName + "/" + pm.Operation.Substring(0, 1) + "/" + pm.EnforcementNumber
    let operation="X";
    let post = false;
    let bm;
    if (msg.id !== "dberror") {
        let id_parts = msg.id.split("/");
        if (id_parts[0] === "post") {
            post = true;
        }
        operation = msg[1];

        bm = new BusinessMessage({
            post: post,
            shortMsg: msg.audit,
            canIgnore: msg.canIgnore,
            idDetail: id_parts[3],
            idRule: msg.audit,
            longMsg: msg.description
        });
    }
    else {
         bm = new BusinessMessage({
            post: false,
            shortMsg: msg.audit,
            canIgnore: msg.canIgnore,
            idDetail: null,
            idRule: msg.audit
        });
    }
    bm.__table = msg.table;
    bm.__id = msg.id;
    return bm;
}

let router = express.Router();
router.post('/saveDataSet', asyncHandler(saveDataSet));

module.exports= router;
