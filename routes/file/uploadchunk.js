const express = require('express');
let uploadPath = "Uploads/";
const path = require("path");
const _ = require('lodash');

const multer  = require('multer');
const asyncHandler = require('express-async-handler'); //https://zellwk.com/blog/async-await-express/
const {unlink,readdir,readFile,stat,appendFile} = require("fs/promises");

var storage = multer.diskStorage({
    filename: function (req, file, callback) {
        callback(null, file.originalname);
    },
    destination: function (req, file, cb) {
        cb(null, uploadPath);
    },
});

//https://github.com/expressjs/multer#usage
const uploadMiddleware = multer({
        limits:{
            fileSize:1024*1024*16 // limits to 16Mbytes uploads
        },
        storage: storage
}).any();

function SortedFile(fileOrder,fileName,content){
    this.fileOrder=fileOrder;
    this.fileName = fileName;
    this.content= content;
}

SortedFile.prototype = {
    constructor: SortedFile
};

function MergeFileManager(){
    this.mergeFileList= {};
}

MergeFileManager.prototype = {
    constructor: MergeFileManager,
    addFile: function(filename){
        this.mergeFileList[filename]=true;
    },
    inUse: function(filename){
        return this.mergeFileList.hasOwnProperty(filename);
    },
    removeFile(filename){
        if(this.inUse(filename)) {
            delete this.mergeFileList[filename];
        }
    }
};

let mergeFileManager = new MergeFileManager();

async function mergeFile(fileName){
    let rslt='';
    let partToken= '.part_';
    let baseFileName = fileName.substring(0, fileName.indexOf(partToken));
    let trailingTokens = fileName.substring(fileName.indexOf(partToken) + partToken.length);
    let fileIndex = parseInt(trailingTokens.substring(0, trailingTokens.indexOf(".")));
    let fileCount = parseInt(trailingTokens.substring(trailingTokens.lastIndexOf(".") + 1));


    // get a list of all file parts in the temp folder
    let searchPattern = path.basename(baseFileName) + partToken;
    let allFiles = await readdir(uploadPath);
    let files = _.filter(allFiles, fname => fname.startsWith(searchPattern));

    if (files.length < fileCount){
        return null;
    }
    if (mergeFileManager.inUse(baseFileName)){
        return  null;
    }
    mergeFileManager.addFile(uploadPath + baseFileName);
    try {
        await unlink(baseFileName);
    }
    catch (err){
        //did not exist
        console.log(err);
    }
    /* SortedFile[] */
    let mergeList = [];
    for(let i=0;i<files.length;i++){
        let fName= files[i];
        let currTrailing = fName.substring(fName.indexOf(partToken) + partToken.length);
        let currIndex =  parseInt(currTrailing.substring(0, currTrailing.indexOf(".")));
        let buff = await readFile(uploadPath + fName);
        mergeList.push(new SortedFile(currIndex, fName, buff));
    }

    let sortedList = _.orderBy(mergeList,["fileOrder"],["asc"]);
    let attachFileName= path.basename(baseFileName);
    let attachPathFileName = path.join(uploadPath , attachFileName);
    for (let i=0;i<mergeList.length;i++) {
        await appendFile(attachPathFileName, mergeList[i].content);
    }
    for (let i=0;i<mergeList.length;i++) {
        await unlink(uploadPath + mergeList[i].fileName);
    }
    mergeFileManager.removeFile(uploadPath + baseFileName);
    return { filePath: attachPathFileName, fileName: baseFileName};
}

async function middleware(req,res,next){
    let ctx = req.app.locals.context;

    if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).send('No files were uploaded.');
    }

    let resFile = null;
    for (let i=0; i<req.files.length; i++){
        let file = req.files[i];
        resFile = await mergeFile(file.originalname);
    }

    if (resFile === null){
        return res.send(200);
    }
    let attachTable = "attach";

    let /* DataSet */ dsAttach;
    try {
        /* DataSet */ dsAttach = ctx.getDataSet(attachTable, "default");
    }
    catch (e){
        return res.send(400,e);
    }
    let metaAttach= ctx.getMeta(attachTable);

    //return  res.status(400).send(metaAttach.name);



    let rAttach = await metaAttach.getNewRow(null, dsAttach.tables[attachTable]);
    const objRow = rAttach.current;
    objRow["filename"] = resFile.fileName;
    objRow["size"] = (await stat(resFile.filePath)).size;
    objRow["lt"] = new Date();
    objRow["ct"] = new Date();
    objRow["cu"] = ctx.environment.mySys.idcustomuser;
    objRow["lu"] = ctx.environment.mySys.idcustomuser;


    let postData = ctx.createPostData.call(ctx);


    let rr =  postData.init(dsAttach);

    await  rr;


    //returns  {canIgnore:boolean, checks:BasicMessage[], data:DataSet}
    let messages = await postData.doPost();


    if (messages.checks.length >0) {
        //Bad Request
        return res.status(400).send("Error uploading: " + messages.checks[0].getMessage());
    }
    let dsObj = dsAttach.serialize(true);
    return  res.json(dsObj);

}

let router = express.Router();
router.post('/uploadchunk', uploadMiddleware, asyncHandler(middleware));

module.exports= router;
