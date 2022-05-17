const express = require('express');
const q = require("jsDataQuery");


function middleware(req,res,next){
    let ctx = req.app.locals.context;
    let tableName= req.query.tableName;
    let /* DataQuery */ filter = q.fromObject(JSON.parse(req.query.filter));
    let columnAttach = req.query.columnAttach;
    ctx.conn.select({
        tableName:tableName,
        filter:filter
    })
        .done(resArr=>{
            if (resArr.length===0){
                res.status(410).send("Error reading attachment from table " + tableName);
                return;
            }
            let buffer = new Buffer(res,"base64");
            let numlen= buffer.indexOf(0);
            let fNameBuff = buffer.slice(0,numlen);
            let fileName= fNameBuff.toString('utf-8');
            let dataBuff = buffer.slice(numlen+1);

            res.set('Content-disposition', 'attachment; filename=' + fileName);
            res.write(dataBuff,'binary');
            res.end(null, 'binary');
        })
        .fail(err=>{
            res.status(410).send("Error reading attachment from table " + tableName);
            return;
        });
}

let router = express.Router();
router.get('/downloadDbField', middleware);


module.exports= router;