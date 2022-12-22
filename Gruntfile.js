// Generated on 2014-03-27 using generator-angular-fullstack 1.2.7
'use strict';

// # Globbing
// for performance reasons we're only matching one level down:
// 'test/spec/{,*/}*.js'
// use this if you want to recursively match all subfolders:
// 'test/spec/**/*.js'
/*globals initConfig, appPath */
/*jshint camelcase: false */

const jasmineEnv=  {
    // Whether to fail a spec that ran no expectations
    failSpecWithNoExpectations: true,

    // Stop execution of a spec after the first expectation failure in it
    stopSpecOnExpectationFailure: false,

    // Stop execution of the suite after the first spec failure
    stopOnSpecFailure: false,

    // Run specs in semi-random order
    random: false
};

let allJasmineConfig= {

}
const glob = require('glob');

const jsdoc2md = require('jsdoc-to-markdown');

const fs = require("fs");
const path = require("path");
const asyncCmd = require("async-exec-cmd");

const JasmineClass = require('jasmine');
const jasmineObj = new JasmineClass();
jasmineObj.exitOnCompletion = false;

jasmineObj.jasmine.getEnv().clearReporters(); // remove default reporter logs

const JasmineConsoleReporter = require('jasmine-console-reporter');


const rep = JasmineClass.ConsoleReporter;  //require("jasmine.console_reporter.js");
//console.log(JasmineClass);

const reporter = new JasmineConsoleReporter({
    colors: 2,           // (0|false)|(1|true)|2
    cleanStack: 1,       // (0|false)|(1|true)|2|3
    verbosity: 1,        // (0|false)|1|2|(3|true)|4|Object
    listStyle: 'indent', // "flat"|"indent"
    timeUnit: 'ms',      // "ms"|"ns"|"s"
    timeThreshold: { ok: 500, warn: 1000, ouch: 3000 }, // Object|Number
    activity: "star",     // boolean or string ("dots"|"star"|"flip"|"bouncingBar"|...)
    emoji: true,
    beep: true
});

jasmineObj.jasmine.getEnv().addReporter(reporter);



const exec  = require("child_process").execFileSync;


const {type} = require("JQDeferred/lib/jquery");

//https://www.npmjs.com/package/grunt-contrib-jasmine
//grunt.loadNpmTasks('grunt-contrib-jasmine');

module.exports = function (grunt) {

    // Load grunt tasks automatically (including grunt.loadNpmTasks('grunt-contrib-jasmine');
    require('load-grunt-tasks')(grunt);
    const fs = require('fs');

    const path = require("path");


    var asyncCmd = require("async-exec-cmd");

    // Time how long tasks take. Can help when optimizing build times
    require('time-grunt')(grunt);


    //this is used with grunt.initConfig(gruntConfig), that is equivalen to grunt.config.init
    let gruntConfig = {
        connect: {
            server: { // <-- This is a Target named 'server'.
                options: {
                    // <-- Your connect options go here.
                    //     https://github.com/gruntjs/grunt-contrib-connect#options
                }
            }
        },

        open : {
            doc : {
                path: 'D:/progetti/jsMetaBackend/docs/index.md',
                app: 'Google Chrome'  //also FireFox
            },
        },

        shell: {
            startNode: {
                command: 'node server.js'
            },
            stopNode: {
                command: 'taskkill /F /IM node.exe'
            },
            clientTest: {
                command: 'npx jasmine test/client/*Spec.js'
            },
            jsdoc:{
                command: 'jsdoc src'
            },
            jsdocToMD:{
                command: 'jsdoc2md src/*.js'
            }
        },

        pkg: grunt.file.readJSON('package.json'),

        jsdoc : {
            dist : {
                plugins: ["markdown","jsdoc-summarize2"],
                src: ['src/*.js',
                        'client/components/*/*.js',
                        //'client/components/i18n/*.js',
                        'routes/*/*.js'
                ],
                options: {
                    destination: 'docs'
                }
            }
        },

        yuidoc: {
          compile: {
            name: '<%= pkg.name %>',
            description: '<%= pkg.description %>',
            version: '<%= pkg.version %>',
            url: '<%= pkg.homepage %>',
            options: {
              paths: ['./src'],
              outdir: 'docs'
            }
          }
        },

        watch: {
            files: ['src/*.js','client/components/metadata/*.js',
                'client/components/i18n/*.js'],
            tasks: ['test'],
            options: {
                livereload: true
            }
        },

        karma: {
            spece2e: {
                configFile: "test/karma_node_server_e2e.conf.js",
                autoWatch: true,
                singleRun: true,
                reporters: ["spec"],
                specReporter: {
                    maxLogLines: 5, // limit number of lines logged per test
                    suppressErrorSummary: false, // do not print error summary
                    suppressFailed: false, // do not print information about failed tests
                    suppressPassed: true, // do not print information about passed tests
                    suppressSkipped: true, // do not print information about skipped tests
                    showSpecTiming: true, // print the time elapsed for each spec
                    failFast: false // test would finish with error when a first fail occurs.
                }
            }
        },

        jasmine: {
            common: {
                spec_dir: "./test/client",
                spec_files: ["*Spec.js"],
                env: jasmineEnv
            },

            server: {
                spec_dir: "./test/spec",
                spec_files: ["*Spec.js"],
                env: jasmineEnv
            },
            midway: {
                spec_dir: './test/midway/',
                spec_files: ["*Spec.js"],
                env: jasmineEnv
            },
            auto: {
                options: {
                    autotest: true,
                    forceExit: false
                }
            }

        }
    };
    let classes = [];
    let classesClient = [];
    let classesMidway = [];


    gruntConfig.jasmine["all_e2e"] = {
        spec_dir: './test/spece2e/',
        spec_files: ["*Spec.js"],
        autotest: false
    };

    //Cerca i test sui moduli in  src
    fs.readdirSync(path.join(__dirname, 'src')).forEach(file => {
        let className = file.replace(".js", "");
        if (fs.existsSync(path.join(__dirname, 'test', 'spec', className + 'Spec.js'))) {
            classes.push(className);
        }
        if (fs.existsSync(path.join(__dirname, 'test', 'midway', className + 'Spec.js'))) {
            classesMidway.push(className);
        }
    });

    //Cerca i test sulle classi  client/components/metadata
    fs.readdirSync(path.join(__dirname, 'client', 'components', 'metadata')).forEach(file => {
        let className = file.replace(".js", "");
        if (fs.existsSync(path.join(__dirname, 'test', 'spec', className + 'Spec.js'))) {
            classes.push(className);
        }
        if (fs.existsSync(path.join(__dirname, 'test', 'midway', className + 'Spec.js'))) {
            classesMidway.push(className);
        }
        if (fs.existsSync(path.join(__dirname, 'test', 'client', className + 'Spec.js'))) {
            classesClient.push(className);
        }
    });

    //crea gli unit test con jasmine (sia quelli sotto src che quelli sotto client/components/metadata
    // questi saranno visibili sotto il task "jasmine"
    classes.forEach(function (className) {
        //console.log("registering "+className+"Spec");
        //Aggiunge la configurazione sotto "jasmine"
        allJasmineConfig[className + "Spec"] = {
            spec_dir: './test/spec/',
            spec_files: [className + "Spec.js"],
            env: jasmineEnv
        };
    });

    classesMidway.push('jsApplicationAnonymous');

    //Crea la configurazione per tutti i test Midway
    classesMidway.forEach(function (className) {
        allJasmineConfig[className + "Midway"] = {
            spec_dir: './test/midway/',
            spec_files: [className + "Spec.js"],
            env: jasmineEnv
        };
    });

    //Configura i test client
    classesClient.forEach(function (className) {
        allJasmineConfig[className + "Client"] = {
            spec_dir: 'test/client',
            spec_files: [className + "Spec.js"],
            env: jasmineEnv
        };
    });

    // Set the configuration for all the tasks
    grunt.initConfig(gruntConfig);

    // Convert to MD every file under the
    grunt.registerTask("jsDocMD","jsdoc to MD",async function(cfgName){
        let folders = gruntConfig.jsdoc[cfgName].src;
        let done = this.async();
        let processed=0;
        folders.forEach(folder=>{
            let folderComplete = path.join(__dirname,folder);
            console.log(folder);

            glob(folder, {}, (err, files)=>{
                if (err){
                    console.log(err);
                    return;
                }
                //console.log(files);
                files.forEach(file => {
                    if (path.basename(file)[0]==='_') return;
                    console.log(file);
                    try {
                        let md = jsdoc2md.renderSync({files: file});
                        const basename = path.basename(file, path.extname(file));
                        const newName = path.join(path.dirname(file), basename + ".md");
                        fs.writeFileSync(newName, md);
                    }
                    catch (e){
                        console.log(e);
                    }
            });
                processed+=1;
                if (processed===folders.length) done();
            });


        });
    });

    grunt.registerTask("jasmine", "jasmine runner", async function (configName) {
        let done = this.async();
        jasmineObj.loadConfig(gruntConfig.jasmine[configName]);

        let result = await jasmineObj.execute();

        if (result.overallStatus === 'passed') {
            grunt.log.writeln('All specs have passed');
        } else {
            grunt.log.writeln('At least one spec has failed');
        }
        done();
    });


    grunt.registerTask('docMD', ['jsDocMD:dist']);

    grunt.registerTask('doc', ['jsdoc','shell:jsdoc', 'open:doc']);

    grunt.registerTask('common unit', ['jasmine:common']);
    grunt.registerTask("server midway",["NodeStart","jasmine:midway"]); // , "NodeStop"
    grunt.registerTask('server unit', ['jasmine:server']);

    grunt.registerTask("createSqlDB","Create Sql DB",function(){
        var done = this.async();
        asyncCmd(
            "node",
            ["test/runSql",
                "config\\dbList.json",
                "test\\data\\jsApplication\\setup.sql",
                "test_sqlServer"
            ],
            function (err, res, code, buffer) {
                if (err) {
                    grunt.log.writeln("createSqlDB error");
                    grunt.log.writeln(err, code);
                    done();
                    return;
                }
                grunt.log.writeln("createSqlDB ok");
                done();
            }
        );
        setTimeout(function () {
            grunt.log.writeln("createSqlDB timeout");
            done();
        }, 60000);
    });

    grunt.registerTask("destroySqlDB","Destroy Sql DB",function(){
        var done = this.async();
        asyncCmd(
            "node",
            ["test/runSql",
                "config\\dbList.json",
                "test\\data\\jsApplication\\Destroy.sql",
                "test_sqlServer"
            ],
            function (err, res, code, buffer) {
                if (err) {
                    grunt.log.writeln("destroySqlDB error");
                    grunt.log.writeln(err, code);
                    done();
                    return;
                }
                grunt.log.writeln("destroySqlDB ok");
                done();
            }
        );
        setTimeout(function () {
            grunt.log.writeln("destroySqlDB timeout");
            done();
        }, 5000);
    });

    grunt.registerTask("NodeStart", "start Node server.js", function () {
        var done = this.async();
        asyncCmd(
            "node",
            ["--inspect", "server.js"],
            function (err, res, code, buffer) {
                if (err) {
                    grunt.log.writeln("NodeStart error");
                    grunt.log.writeln(err, code);
                    done();
                    return;
                }
                grunt.log.writeln("Node server running (not err)");
                console.log(res, code, buffer);
                done();
            }
        );
        setTimeout(function () {
            grunt.log.writeln("Node server running (timeout)");
            done();
        }, 5000);
    });

    grunt.registerTask("e2e", ["createSqlDB", "NodeStart", "karma:spece2e","destroySqlDB"]);

    grunt.registerTask("test Client", "test client", async function () {
        let done = this.async();
        asyncCmd(
            "npx",
            ["jasmine", "test/client/jsDataSetSpec.js"],
            function (err, res, code, buffer) {
                if (err) {
                    grunt.log.writeln("Node Version error");
                    grunt.log.writeln(err, code);
                    done();
                    return;
                }
                grunt.log.writeln("Node Version stopped");
                grunt.log.writeln(res, code, buffer);
                //done();
            }
        );
        setTimeout(function () {
            grunt.log.writeln("Node Version stopped (timeout)");
            done();
        }, 10000);

    });


    grunt.registerTask("NodeStop", "stop Node", function () {
        var done = this.async();
        asyncCmd(
            "taskkill",
            ["/F", "/IM", "node.exe"],
            function (err, res, code, buffer) {
                if (err) {
                    grunt.log.writeln("NodeStop error");
                    grunt.log.writeln(err, code);
                    done();
                    return;
                }
                grunt.log.writeln("Node server stopped");
                grunt.log.writeln(res, code, buffer);
            }
        );
        setTimeout(function () {
            grunt.log.writeln("Node server stopped (timeout)");
            done();
        }, 5000);
    });

    grunt.registerTask('serverStart', ['shell:startNode']);
    grunt.registerTask('serverStop', ['shell:stopNode']);

    // classes.forEach(function (className) {
    //     grunt.registerTask(className + " Server", ['jasmine:' + className + "Spec"]);
    // });
    //
    // classesClient.forEach(function (className) {
    //     grunt.registerTask(className + " Client", ['jasmine:' + className + "Client"]);
    // });
    //
    // classesMidway.forEach(function (className) {
    //     grunt.registerTask(className + " Midway", [ 'jasmine:' + className + "Midway"]);//, 'keepalive'
    // });

    //grunt.registerTask('default', ['test']);

    //grunt.registerTask("midway", ["NodeServer", "karma:spece2e"]);


};
