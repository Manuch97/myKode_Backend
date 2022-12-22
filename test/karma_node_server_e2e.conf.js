// Karma configuration
// http://karma-runner.github.io/0.12/config/configuration-file.html
// Generated on 2015-02-06 using
// generator-karma 0.9.0

module.exports = function(config) {
    'use strict';

    config.set({
        // enable / disable watching file and executing tests whenever any file changes
        //autoWatch: true,
        usePolling: true,

        //dots  progress  junit  growl  coverage kjhtml spec
        reporters: ['dots'],


        // base path, that will be used to resolve files and exclude
        basePath: '../',

        // testing framework to use (jasmine/mocha/qunit/...)
        frameworks: ['jasmine','browserify'],
        preprocessors: {
            // 'node_modules/jsDataSet/src/jsDataSet.js': [ 'browserify' ],
            // 'node_modules/jsDataQuery/src/jsDataQuery.js': [ 'browserify' ],
            //'test/spece2e/*.js': [ 'browserify' ]
        },
        // list of files / patterns to load in the browser
        files: [
            'node_modules/lodash/lodash.js',
            'client/components/metadata/jsDataQuery.js',
            'client/components/metadata/jsDataSet.js',
            'node_modules/jquery/dist/jquery.js',
            'test/spece2e/dummy.spec.js',
            'test/spece2e/rest-api.spec.js',
        ],

        browserify: {
            debug: true,
            transform: [ 'brfs' ]
        },

        // list of files / patterns to exclude
        exclude: [
        ],
        proxies: {
        },

        // web server port
        port: 9876,
        browserNoActivityTimeout: 300000, // timeout se Karma non riceve messaggi dal browser entro un certo tempo. aumentato in test ceh richeidono query pesanti
        browserDisconnectTimeout: 300000,
        captureTimeout: 300000,

        // Start these browsers, currently available:
        // - Chrome
        // - ChromeCanary
        // - Firefox
        // - Opera
        // - Safari (only Mac)
        // - PhantomJS
        // - IE (only Windows)
        browsers: [
            'ChromeHeadless'
        ],

        // Which plugins to enable
        plugins: [
            'karma-browserify',
            'karma-phantomjs-launcher',
            'karma-jasmine',
            'karma-jasmine-html-reporter',
            'karma-chrome-launcher',
            'karma-junit-reporter',
            'karma-spec-reporter'
        ],

        // Continuous Integration mode
        // if true, it capture browsers, run tests and exit
        //singleRun: false,

        colors: true,

        // level of logging
        // possible values: LOG_DISABLE || LOG_ERROR || LOG_WARN || LOG_INFO || LOG_DEBUG
        logLevel: config.LOG_INFO

    });
};
