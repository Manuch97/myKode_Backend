const dsSpace = require("./jsDataSet");
const DataSet = dsSpace.DataSet;
const DataRowState = dsSpace.dataRowState;
const _ = require('lodash');
const q = require("./jsDataQuery");
const path = require("path");
let uploadPath = "Uploads";
const {readFile,stat,unlink} = require("fs/promises");

const  idattachColumnName = "idattach";
const  counterColumnName = "counter";

async function forEachAsync(arr, fn) {
    for (let t of arr) { await fn(t); }
}

/**
 *
 * @param {string} colName
 * @return {string}
 */
function getAttachColumn(colName){
 return "!"+ colName;
}

const attachReplaced = -1;


/**
 *
 * @param {Context} ctx
 * @param {DataSet} ds
 * @returns Promise({<int, {columnName: string, dataRow: objectRow}>})
 */
async function manageAttachWindowsCompliant(ctx,ds){
    let dbs = ctx.dbDescriptor;
    let dataRowsModified = {};
    _.forEach( ds.tables, async function(t) {
        let /*TableDescriptor*/ tableDescr = await dbs.table(t.name);
        forEachAsync(t.rows, async (/*ObjectRow*/ r) => {
            for (const cName in tableDescr.columns) {
                let col = tableDescr.column(cName)
                if (!col) continue;
                if (col.cType !== DataSet.cType.byteArray) continue;

                if (!t.columns.hasOwnProperty(cName)) continue;
                let attachColName = getAttachColumn(cName);
                if (t.columns[attachColName]===undefined) continue;

                let idAttach = r[attachColName];

                // recupero l'id formattato nel formato che indica allegato aggiunto o modificato
                // se diverso da "attachReplaced". se andrà tutto ok, eseguirò la sanatizeDsForAttach()
                if (idAttach===null || idAttach===undefined){
                    // caso il client abbia premuto rimuovi allegato. mette null, e quindi qui devo ripulire il bytearray
                    r[cName]=null;
                    continue;
                }
                if (idAttach === attachReplaced) continue;

                //siamo nel caso in cui ho un idattach reale, e devo quindi recuperare e salvare il file
                let fName = await ctx.getDataInvoke.doReadValue(t.name,
                                q.eq("idattach",idAttach),
                                "filename",
                                null
                    );
                if (!fName) continue;

                let fNameArr = fName.split("$__$");
                let realFileName = fNameArr[1];

                let nameLen = path.basename(realFileName)+1;

                // aggiungo alla lista delle righe il cui campo image è stato modificato
                dataRowsModified[idAttach] = {columnName: cName, dataRow:r};

                // recupero file e salvo sul campo il byteArray
                let pathFile  = path.join(uploadPath, fName);
                let data = await stat(pathFile);
                let n = data.size;
                if (n===0){
                    r[cName]=null;
                    continue;
                }

                let byteArr = new Buffer.alloc(nameLen+n);
                let bufData = await readFile(pathFile);
                bufData.copy(byteArr, nameLen,0);
                let bufFileName = Buffer.from(fName);
                //copy nameLen-1 bytes, last at position nameLen-2
                bufFileName.copy(byteArr, 0,0);
                byteArr[nameLen-1]=0;

                //da provare anche 'hex' se non dovesse andare
                // https://masteringjs.io/tutorials/node/buffer-to-string
                r[cName] = byteArr; //byteArr.toString('base64'); lo metto come un Buffer, se non dovesse andare
                                        // proviamo col toString(base64)
            }
    });
    });
    return dataRowsModified;
}

/**
 *
 * @param {Context} ctx
 * @param {DataTable} attachmentTable
 * @param {object|null} idattach
 * @param {int} delta
 * @return {Promise<boolean>}
 */
async function addDeltaToAttachment( attachmentTable,  idattach,delta, ctx) {
    if (idattach === null) return false;
    if (idattach === 0) return false;
    let filter =q.eq(idattachColumnName, idattach);

    let existing =attachmentTable.select(filter);
    if (existing.length ===0){
        await ctx.getDataInvoke.runSelectIntoTable(attachmentTable,filter)
        existing =attachmentTable.select(filter);
    }
    if (existing.length===0) return false;
    let rAttach = existing[0];
    if (rAttach[counterColumnName]===null){
        rAttach[counterColumnName] = delta;
    }
    else {
        rAttach[counterColumnName] += delta;
    }
    return true;
}

/**
 * Creates a DataSet with the updates to attachTableName to do in order to update attachment reference counters
 * @param {DataSet} outDS
 * @param {Context} ctx
 * @returns {DataSet|null}
 */
async function getDsAttachWithCounterUpdated( ctx, outDS){
    let attachTableName = "attach";
    let /*DataSet*/ dsAttach = await ctx.getDataInvoke.createEmptyDataSet( attachTableName, "counter");
    let dtAttach = dsAttach.tables[attachTableName];
    let attachModified = false;

    for (const /*DataTable*/ tableName in outDS.tables){
        if (!outDS.tables.hasOwnProperty(tableName)) continue;
        let /*DataTable*/ table = outDS.tables[tableName];
        if (table.tableForReading()=== attachTableName) continue;

        let /*DataColumn[]*/colForAttach = _.filter(table.columns, c=> c.name.startsWith("idattach"));
        if (colForAttach.length ===0) continue;
        for (const /*ObjectRow*/ r of table.rows ){
            for (const /*DataColumn*/ col of colForAttach){
                let /*DataRow*/ dr = r.getRow();
                if (dr.state === DataRowState.added){
                    attachModified |= await addDeltaToAttachment(dtAttach, r[col.name],1, ctx)
                }
                if (dr.state === DataRowState.deleted){
                    attachModified |= await addDeltaToAttachment(dtAttach, dr.originalRow()[col.name],-1, ctx)
                }

                // sullo stato modified devo decrementare il counter del vecchio record, mentre devo aumentare quello attuale
                if (dr.state === DataRowState.modified){
                    let originalIdAttach = dr.originalRow()[col.name];
                    let currentIdAttach = r[col.name];
                    attachModified |= await addDeltaToAttachment(dtAttach, currentIdAttach,1, ctx);
                    attachModified |= await addDeltaToAttachment(dtAttach, originalIdAttach,-1, ctx);
                }
            }
        }
    }
    if (attachModified) return dsAttach;
    return null;
}


/**
 *  I campi che hanno allegati vengono bonfificati, inserendo un id notevole "-1" al posto del contenuto binario
 *      nella rispettiva colonna calcolata, che quindi sarà !nomecolonna
 * @param {DataSet} ds
 * @param {Context} ctx
 * @return {Promise<void>}
 */
async function sanitizeDsForAttach(ds,ctx) {
    // VISUALIZZAZIONE
    // 1) in lettura sostituisco il contenuto del campo attachment con un "farlocco zero" se è "0x"(c'è l'attachment) altrimenti rimane il null la cui semantica è che non c'è un attachment per quella riga.
    // 2) è necessario fare l'acceptChange perchè lo stato deve rimanere unchanged (e svuota la collection della riga modificata)

    let dbs = ctx.dbDescriptor;

    for (const /*DataTable*/ tableName in ds.tables) {
        if (!ds.tables.hasOwnProperty(tableName)) continue;
        let /*DataTable*/ table = ds.tables[tableName];
        let tableDescr = await dbs.table(tableName);

        for (const /*ObjectRow*/ r of table.rows ){
            for (const cname of Object.keys(table.columns)){
                let colDescr = tableDescr.column(cname);
                if (!colDescr) continue;
                if (colDescr.ctype !== dsSpace.CType.byteArray) continue;
                let attach = r[cname];
                // bonifico i byte[]. non li invio al client. ma informo al client tramite -1 che c'� un attach
                if (attach !== null){
                    var buf = Buffer.alloc(4);
                    buf.writeInt32LE(-1, 0); /// or BE??
                    r[cname]= buf;
                    if (table.columns[getAttachColumn(cname)]){
                        r[getAttachColumn(cname)] = buf;
                    }
                    r.getRow().acceptChanges();
                }
            }
        }
    }

}

/**
 *
 * @param {int} n
 */
function intToByte(n){
    var buf = Buffer.alloc(4);
    buf.writeInt32LE(n, 0);
    return buf;
}

/**
 * @param {<int,{columnName:string, dataRow:DataRow}>} dataRowAttachModified
 */
function sanitizeDsForAttachUnsuccess(dataRowAttachModified){
    for (let entryKey in dataRowAttachModified ){
        if (dataRowAttachModified.hasOwnProperty(entryKey)) {
            let entryVal = dataRowAttachModified[entryKey];
            let row = entryVal.dataRow;
            let cName = entryVal.columnName;
            row[cName]= intToByte(attachReplaced);
        }
    }
}



/// <summary>
/// Per ogni riga che era stata modificata con il contenuto in byte array del file salvato, elimino
/// il corrispondente file sul file system, poichè ora è reso persitente sul db
/// </summary>
/// <param name="dataRowAttachModified"></param>


/**
 *
 * @param {<int,{columnName:string, dataRow:DataRow}>}  dataRowAttachModified
 * @param {Context} ctx
 * @return {Promise<void>}
 */
async function removeAttachmentAfterSuccess(dataRowAttachModified,ctx) {
    for (let entryKey in dataRowAttachModified ){
        if (dataRowAttachModified.hasOwnProperty(entryKey)) {
            let entryVal = dataRowAttachModified[entryKey];
            let row = entryVal.dataRow;
            let cName = entryVal.columnName;

            // recupero l'id che era stato memorizzato sulla colonna temporanea
            let calculateAttachColumnName = getAttachColumn(cName);
            if (row.table.columns[calculateAttachColumnName] == null) continue;
            var idattach = row[calculateAttachColumnName];

            let fName = await ctx.getDataInvoke.doReadValue(t.name,
                q.eq("idattach",idAttach),
                "filename",
                null
            );
            if (!fName) continue;
            let pathFile = path.join(uploadPath,fName);
            await unlink(pathFile);
        }
    }
}


module.exports= {
    sanitizeDsForAttach:sanitizeDsForAttach,
    getDsAttachWithCounterUpdated:getDsAttachWithCounterUpdated,
    manageAttachWindowsCompliant:manageAttachWindowsCompliant,
    sanitizeDsForAttachUnsuccess:sanitizeDsForAttachUnsuccess,
    removeAttachmentAfterSuccess:removeAttachmentAfterSuccess
};
