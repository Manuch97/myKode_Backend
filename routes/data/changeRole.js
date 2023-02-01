const express = require("express");
const asyncHandler = require("express-async-handler");
const q = require("./../../client/components/metadata/jsDataQuery");
const parser = require("../../src/jsDataQueryParser").JsDataQueryParser;
const AuthUtils = require("./../auth/_autUtils");


async function middleware(req,res,next){
    let ctx = req.app.locals.context;

    let /*Identity*/ identity = ctx.identity;
    let /*Security*/ sec = ctx.security;
    let /*Environment*/ env = ctx.environment;

    env.sys("idflowchart", req.body.idflowchart);
    env.sys("ndetail", req.body.ndetail);
    //calcUserEnvironment needs idflowchart and ndetail set in env.sys    
    await env.calcUserEnvironment(ctx.dataAccess);    
    res.json({
        usr:AuthUtils.serializeUsr(env),
        sys:AuthUtils.serializeSys(env)
    });

}


let router = express.Router();
router.post('/changeRole', asyncHandler(middleware));


module.exports= router;
