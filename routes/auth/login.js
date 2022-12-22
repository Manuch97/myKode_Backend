const express = require('express');
let router = express.Router();
const asyncHandler = require("express-async-handler");
const DBList = require("./../../src/jsDbList");
let AuthUtils = require("./_autUtils");

//let checkToken = require('../../src/jsToken').checkToken;

// JsApplication is available through req.app.locals.JsApplication, see https://expressjs.com/it/api.html

/**
 * Login: reads user and password from body, then calls the _doLogin  route
 * @param req
 * @param res
 * @param next
 * @return {Promise<void>}
 */
async function login(req,res,next){
    let ctx = req.app.locals.context;
    if (!req.body.userName){
        res.send(400,"No Credential");
        return;
    }
    if (!req.body.password){
        res.send(400,"No Credential");
        return;
    }
    if (!req.body.datacontabile){
        res.send(400,"Missing AccountDate");
        return;
    }

    let dbInfo = DBList.getDbInfo(ctx.dbCode);
    let userkind =  dbInfo.userkindUserPassw;
    await AuthUtils._doLogin(ctx, req.body.userName, req.body.password,
            req.body.datacontabile,null, userkind, req,res);
}



/* solo per test veloce su ambiente di test karma + jquery*/
router.get('/dummy', (req,res,next) => {
    console.log(req);
    return res.status(200).json({result: 'ok'});
});


router.post('/login', asyncHandler(login));

module.exports = router;
