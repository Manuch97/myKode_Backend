const  parser = require("../../src/jsDataQueryParser").JsDataQueryParser;
const q = require("./../../client/components/metadata/jsDataQuery");
const DBList = require("./../../src/jsDbList");
const jsPassword = require("./../../src/jsPassword");
const dblogger = require("./_dbLogger");
const jsToken = require("./../../src/jsToken");
const jsDataSet = require("./../../client/components/metadata/jsDataSet");
const {CType} = require("./../../client/components/metadata/jsDataSet");

/**
 *
 * @param {Environment} env
 */
function serializeUsr(env){
    return env.enumUsr().reduce((res, k) => {
        let val = env.usr(k);
        if (k.startsWith("cond_sor")){
            const sqlFun = new parser().from(val);
            if (sqlFun === null){
                res[k] = sqlFun;
            } else {
                res[k] = JSON.stringify(q.toObject(sqlFun));
            }
        } else {
            res[k] = Array.isArray(val) ? val.join(',') : val;
        }
        return res;
    }, {});
}

/**
 *
 * @param {Environment} env
 */
function serializeSys(env){
    return ["idflowchart","user","idcustomuser","ndetail","usergrouplist","ayear","esercizio"]
        .reduce((res, k) => {
        let val = env.sys(k);
        res[k] = Array.isArray(val) ? val.join(',') : val;
        return res;
    }, {});

}


/**
 *
 * @param {Context} ctx
 * @param {string} userName
 * @param {string} password
 * @param {Date} accountDate
 * @param {userName:string, name:string,surname:string,email:string,cf:string, createdAt:date} sessionInfoSSO
 * @param {int} userkind
 * @param {Request} req
 * @param {Response} res
 * @return {Promise<void>}
 * @private
 */
async function _doLogin(ctx, userName, password,
                        accountDate,sessionInfoSSO,
                        userkind, req, res){
    let dbInfo = DBList.getDbInfo(ctx.dbCode);
    let codeDip= dbInfo.defaultSchema; //DBDipartimento;
    let env = ctx.environment;
    env.sys("idcustomuser",null);
    let filter = q.and(q.eq("username",userName),
        q.eq("codicedipartimento",codeDip),
        q.eq("userkind",userkind));

    let sys_user;
    try {
        //Searches login in virtualuser table filtering userkind and codicedipartimento
        //dt is an array of rows with a name
        let data =  await ctx.dataAccess.select({tableName:"virtualuser",filter: filter});

        if (data.length!==0 ){
            let vUser = data[0];
            sys_user = vUser["sys_user"];
            ctx.dataAccess.externalUser = userName;
            env.usr("externalUser",userName);
            env.usr("HasVirtualUser","S");
            env.sys("user",vUser["sys_user"]);
            env.sys("usergrouplist",null);
            env.usr("forename",vUser["forename"]);
            env.usr("surname",vUser["surname"]);
            env.usr("email",vUser["email"]);
            env.usr("cf",vUser["cf"]);
        }
        else {
            // it was not linked to a virtual user
            env.sys("user",userName);
            env.sys("usergrouplist",null);
        }
    }
    catch (err){
        res.send(401,"Error processing:"+err);
        return ;
    }

    //evaluates idcustomuser
    await env.getCustomUser(ctx.dataAccess);
    if (!await dataAllowed(ctx, accountDate)){
        res.send(401,"Date Not Allowed");
        return ;
    }

    //registryreference is a table containing usernames and hashed passwords
    let registryreference =   await ctx.dataAccess.select(
        {tableName:"registryreference",
         filter: q.eq("userweb",userName)}
    );

    if (registryreference.length===0){
        if (dbInfo.EnableSSORegistration && sessionInfoSSO){
            // registration is requested
            res.status(301).json({
                login:sessionInfoSSO.userName,
                forename:sessionInfoSSO.name,
                surname:sessionInfoSSO.surname,
                email:sessionInfoSSO.email,
                cf:sessionInfoSSO.cf
            });
            return;
        }
        res.send(401,"Bad credentials");
        return ;
    }

    let referenceRow = registryreference[0];
    let email = referenceRow["email"];

    // se non si tratta di SSO verifico la password
    if (!sessionInfoSSO){
        let iterations = referenceRow["iterweb"];
        if (!iterations){
            res.send(401,"Bad Credential");
            return ;
        }
        //i bytearray sono convertiti in string da EdgeCompiler.cs tramite Convert.ToBase64String ((byte[])value)
        // quindi è necessario riconvertirli in buffer come segue
        let salt= new Buffer(referenceRow["saltweb"],"hex");
        let hash = new Buffer(referenceRow["passwordweb"],"hex");

        if (! await  jsPassword.verify(password, salt, hash, iterations)){
            return res.send(401,"Bad credentials");
        }
    }


    let idreg = referenceRow["idreg"];
    let title = await ctx.dataAccess.readSingleValue({
        tableName:"registry",
        filter: q.eq("idreg",idreg),
        expr:"title"
    });

    await env.load(ctx.dataAccess);
    let idflowchart = env.sys("idflowchart");
    let ndetail = env.sys("ndetail");

    // assure user is under security rules
    if (!env.sys("idflowchart")  || ! env.sys("ndetail")){
        await dblogger({error:"user not in security",
            methodInfo:"login",
            metadata:"esercizio:"+env.sys("esercizio")+", sys_user = "+sys_user+
                ", idcustomuser:"+env.sys("idcustomuser")+
                ", userName: "+userName
             },ctx);
        res.send(401,"User not in security");
        return;
    }

    env.usr("userweb", userName);
    env.usr("idreg",idreg);

    let roles = await getRoles(accountDate,env.sys("idcustomuser"));

    //modify temporary identity
    let identity = ctx.identity;
    identity.title = title;
    identity.name = userName;
    identity.email = email;
    identity.idflowchart = idflowchart;
    identity.ndetail = ndetail;
    identity.isAnonymous = false;
    //identity.sessionguid = ctx.identity.sessionID() already set

    let token = new jsToken.Token(req,identity);

    ctx.environmentSet(env);

    //Sends token to the client
    let result = {
        usr: serializeUsr(env),
        sys: serializeSys(env),
        token: token.getToken(),
        dtRoles:roles.serialize(),
        expiresOn:identity.expiresOn
    };
    res.json(result);


}



/**
 * Computes a  list of roles, invoking stored procedure compute_roles(aDate,idCustomUser)
 * @param {Date}aDate
 * @param {string}idCustomUser
 * @param {Context}ctx
 * @return {Promise<DataTable>}
 */
async function getRoles(aDate,idCustomUser, ctx){
    let roles = await ctx.dataAccess.callSP("compute_roles",[aDate,idCustomUser]);
    let t = new jsDataSet.DataTable("roles");
    t.setDataColumn("idflowchart",CType.string);
    t.setDataColumn("title",CType.string);
    t.setDataColumn("ndetail",CType.int);
    t.setDataColumn("k",CType.string);
    t.key("k");
    _.forEach(roles[0],r=>{
        t.load(r, false);
    });
    return  t;
}

/**
 *
 * @param ctx
 * @param {Date} newDate
 * @return {boolean}
 * @constructor
 */
async function dataAllowed(ctx, newDate) {
    let idcustomuser = ctx.environment.sys("idcustomuser");
    if (!idcustomuser) return true;
    // if(await  ctx.dataAccess.selectCount({tableName:"flowchartuser",
    //                                             filter: q.eq("idcustomuser",idcustomuser)})===0){
    //     return  true; //fuori dall'organigramma
    // }
    let ayearStr = newDate.getFullYear().toString();


    let filterDateYear = q.and(q.eq("idcustomuser",idcustomuser),
        q.like(ayearStr.substr(2)+"%"),
        q.isNullOrLe("start",newDate),
        q.isNullOrGe("stop",newDate)
    );
    if (await  ctx.dataAccess.selectCount({tableName:"flowchartuser",
        filter: filterDateYear
    })===0){
        return  false;
    }


    let filterDateToday = q.and(q.eq("idcustomuser",idcustomuser),
        q.like(ayearStr.substr(2)+"%"),
        q.isNullOrLe("start",today()),
        q.isNullOrGe("stop",today())
    );
    return await ctx.dataAccess.selectCount({
        tableName: "flowchartuser",
        filter: filterDateToday
    }) !== 0;

}

/**
 * Evaluates date part of current date
 * @return {Date}
 */
function today(){
    let d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

module.exports = {
    serializeUsr:serializeUsr,
    serializeSys:serializeSys,
    _doLogin:_doLogin,
    today:today
};
