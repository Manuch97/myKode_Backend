'use strict';

//const tokenConfig = require("../../config/tokenConfig");
describe('jsbackend core',
    function() {

    beforeEach(function() {
    });

    it("dummy is ok",
        function () {
            const a = 5;
            expect(a).toBe(5);
        });

    //This dummy service is defined in login.js
    it("dummy rest",
        function (done) {
            var options   = {
                // headers: {
                //     'authorization': "Bearer AnonymousToken123456789" ,
                // },
                url: 'http://localhost:54471/test/auth/dummy',
                contentType: 'application/json; charset=utf-8',
                type: 'GET',
                timeout : 10000,
                success: (res) => {
                    expect(res).toBeDefined();
                    expect(res.result).toBe('ok');
                    done();
                },
                error: (xhr, ajaxOptions, thrownError) => {
                    console.log(thrownError);
                    expect(true).toBe(false);
                    done();
                }
            };
            jQuery.ajax(options);

        }, 100000);
});
