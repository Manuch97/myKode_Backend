'use strict';
/*globals beforeEach,jsDataSet,afterEach,describe,jasmine,it,expect,inject */
const _ = require("lodash");
const $q = require("./../../client/components/metadata/jsDataQuery.js");
console.log("running jsDataQuerySpec!");

describe('DataQuery functions', function () {
    let ds;

    function fieldGet(field) {
        return function (obj) {
            return obj[field];
        };
    }


    describe('EVAL requirements', function () {

        it('eval should access local variable and return something', function () {
            const ctx = {a: 1, b: 2, c: {somedata: 3}},
                res = eval('ctx.c.somedata');
            expect(res).toBe(3);
        });

        it('eval should access local variable and return something', function () {
            const ctx = {a: 1, b: 2, c: {somedata: 3}},
                res = eval('ctx.c.somedata');
            expect(res).toBe(3);
        });

        it('eval should be able to call functions', function () {
            const ctx = {
                    a: 1, b: 2, c: {somedata: 3}, d: function (x) {
                        return x * 3;
                    }
                },
                res = eval('ctx.d(10)');
            expect(res).toBe(30);
        });

        it('functions called by eval have access to parent scope', function () {
            const scopeVar = 100,
                ctx = {
                    a: 1, b: 2, c: {somedata: 3}, d: function (x) {
                        return x * scopeVar;
                    }
                },
                res = eval('ctx.d(10)');
            expect(res).toBe(1000);
        });
    });

    describe('ctx function', function () {
        it('simple fields should be correctly evaluated', function () {
            const env = {a: 1, b: 2},
                ctxFun = $q.context('a');
            expect(ctxFun(null,env)).toBe(1);
            env.a = 10;
            expect(ctxFun(null,env)).toBe(10);
        });

        it('array elements should be correctly evaluated', function () {
            const env = {a: 1, b: 2, c: ['a', 'b', 'c']},
                ctxFun = $q.context('c');
            expect(ctxFun(null,env)[1]).toBe('b');
            env.c[1] = 'q';
            expect(ctxFun(null,env)[1]).toBe('q');
        });

        it('field objects should be correctly evaluated', function () {
            const env = {a: 1, b: 2, c: {a: 'AA', b: 'BB'}},
                js = function (env) {
                    return env.c.b;
                },
                ctxFun = $q.context('c');
            expect(ctxFun(null,env).b).toBe('BB');
            env.c.b = 'q';
            expect(ctxFun(null,env).b).toBe('q');
        });

    });

    describe('Comparison functions', function () {

        it('$q.eq should be a function', function () {
            expect($q.eq).toEqual(jasmine.any(Function));
        });

        it('$q.eq should return a function', function () {
            const x = 1,
                y = 1,
                f = $q.eq(x, y);
            expect(f).toEqual(jasmine.any(Function));
        });


        it('$q.eq between equal constants should return true', function () {
            let x = 1,
                y = 1,
                f = $q.eq(x, y);
            expect(f({})).toBeTruthy();
            x = 2;
            y = 3;
            expect(f({})).toBeTruthy();
        });

        it('$q.eq between different constants should return false', function () {
            let x = 1,
                y = 2;
            const f = $q.eq(x, y);
            expect(f({})).toBeFalsy();
            x = 2;
            expect(f({})).toBeFalsy();
            y = 1;
            expect(f({})).toBeFalsy();
            x = 1;
            expect(f({})).toBeFalsy();
        });
        it('comparing values with $q.eq between type does matter (1 <> \'1\')', function () {
            let x = 1,
                y = '1';
            const f = $q.eq(x, y);
            expect(f({})).toBeFalsy();
            y = 1;
            expect(f({})).toBeFalsy();
            x = '1';
            y = '1';
            expect(f({})).toBeFalsy();
        });

        it('comparing values with $q.eq between type does matter (1 <> true)', function () {
            const x = 1,
                y = true,
                f = $q.eq(x, y);
            expect(f({})).toBeFalsy();
        });
        it('comparing values with $q.eq between type does matter (0 <> null)', function () {
            const x = null,
                y = 0,
                f = $q.eq(x, y);
            expect(f({})).toBeFalsy();
        });

        it('comparing values with $q.eq:  null and undefined are considered equal', function () {
            const x = {a: null},
                f = $q.eq($q.constant(x.a), $q.constant(x.b));
            expect(f({})).toBeTruthy();
        });

        it('comparing values through field equal', function () {
            const x = {a: 1, b: 2, c: 3},
                f = $q.eq($q.field('a'), 1);
            expect(f(x)).toBeTruthy();
            x.a = 2;
            expect(f(x)).toBeFalsy();
        });

        it('comparing values through field not equal', function () {
            const x = {a: 1, b: 2, c: 3},
                f = $q.eq($q.field('a'), 2);
            expect(f(x)).toBeFalsy();
            x.a = 2;
            expect(f(x)).toBeTruthy();
        });

        it('comparing two equal fields', function () {
            const x = {a: 1, b: 2, c: 2},
                f = $q.eq($q.field('b'), $q.field('c'));
            expect(f(x)).toBeTruthy();
            x.b = 1;
            expect(f(x)).toBeFalsy();
        });

        it('comparing two different fields', function () {
            const x = {a: 1, b: 2, c: 3},
                f = $q.eq($q.field('b'), $q.field('c'));
            expect(f(x)).toBeFalsy();
            x.b = 3;
            expect(f(x)).toBeTruthy();
        });

        it('comparing with undefined gives false', function () {
            const x = {a: 1, b: 2, c: 3},
                f = $q.eq($q.field('b'), $q.field('f'));
            expect(f(x)).toBeFalsy();
            x.f = 2;
            expect(f(x)).toBeTruthy();
        });

        it('comparing with undefined object gives undefined', function () {
            const x = {a: 1, b: 2, c: 3},
                f = $q.eq($q.field('b'), undefined);
            expect(f(x)).toBeUndefined();
        });


        it('isNullOrEq with first param null is true', function () {
            const x = {a: 1, b: 2, c: 3};
            let y = 4;
            const f = $q.isNullOrEq($q.field('d'), y);
            expect(f(x)).toBeTruthy();
            y = 5;
            expect(f(x)).toBeTruthy();


        });

        it('isNullOrEq with first param not null is like an eq', function () {
            const x = {a: 1, b: 2, c: 3};
            let y = 2;
            const f = $q.isNullOrEq($q.field('b'), y);
            let g;
            expect(f(x)).toBeTruthy();
            g = $q.isNullOrEq($q.field('c'), y);
            expect(g(x)).toBeFalsy();
            y = 3;
            expect(f(x)).toBeTruthy();
            expect(g(x)).toBeFalsy();

        });

        it('comparing two equal fields using autofield for first param', function () {
            const x = {a: 1, b: 2, c: 2};
            let y = 2,
                field = 'b';
            const f = $q.eq(field, y);
            expect(f(x)).toBeTruthy();
            expect(f.isTrue).toBeUndefined();
            field = 'a';
            expect(f(x)).toBeTruthy();
            y = 10;
            expect(f(x)).toBeTruthy();
            expect(f.isTrue).toBeUndefined();
        });

        it('comparing two equal fields using autofield for first param (with null  as value)', function () {
            const x = {a: 1, b: null, c: 2},
                f = $q.eq('b', 2);
            expect(f(x)).toBeFalsy();
            expect(f.isFalse).toBeUndefined();
        });

        it('comparing two equal fields using autofield for first param (with undefined as value)', function () {
            const x = {a: 1, b: null, c: 2},
                f = $q.eq('f', 2);
            expect(f(x)).toBeFalsy();
            expect(f.isFalse).toBeUndefined();
        });

        it('comparing two equal fields using autofield for first param (with undefined as value) call without params', function () {
            const x = {a: 1, b: null, c: 2},
                f = $q.eq('f', 2);
            expect(f()).toBeUndefined();
        });


        it('comparing two different fields using autofield for first param', function () {
            const x = {a: 1, b: 2, c: 3};
            let c2 = $q.field('c');
            const f = $q.eq('b', c2); //f should compare field b with field c
            expect(f(x)).toBeFalsy();
            c2 = $q.field('b');
            expect(f(x)).toBeFalsy();
            x.c = 2;
            expect(f(x)).toBeTruthy();
        });


        it('isIn is a function', function () {
            expect($q.isIn).toEqual(jasmine.any(Function));
        });

        it('distinctVal is a function', function () {
            expect($q.distinctVal).toEqual(jasmine.any(Function));
        });

        it('distinctVal should give different values of an array', function () {
            expect($q.distinctVal([1, 2, 3, 4, 2, 3]).length).toBe(4);
        });

        it('distinctVal should give different values of an array including nulls', function () {
            expect($q.distinctVal(['a', 'A', ' ', null, 1]).length).toBe(5);
        });

        it('isIn returns a function', function () {
            const f = $q.isIn('q', ['a', 'A', ' ', null, 1]);
            expect(f).toEqual(jasmine.any(Function));
        });

        it('isIn returns a function with evaluated fields', function () {
            const f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
            expect(f).toEqual(jasmine.any(Function));
        });

        it('isIn(x) returns true if element in list', function () {
            const xx = {x: 1, q: 1},
                f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
            expect(f(xx)).toBeTruthy();
        });

        it('isIn(x) returns false if element not in list', function () {
            const xx = {x: 1, q: 3},
                f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
            expect(f(xx)).toBeFalsy();
        });

        it('isIn(x) returns false on empty list', function () {
            const xx = {x: 1, q: 3},
                f = $q.isIn('q', []);
            expect(f(xx)).toBeFalsy();
        });

        it('isIn(x) returns false if some element undefined', function () {
            const xx = {x: 1, q: 3},
                f = $q.isIn('q', ['a', 'b', undefined]);
            expect(f(xx)).toBeFalsy();
        });

        it('isIn(x) returns undefined  if object is undefined', function () {
            const xx = {x: 1, q: 3},
                f = $q.isIn('q', ['a', 'b', undefined]);
            expect(f()).toBeUndefined();
        });


        it('isIn(x) compares different if types are different', function () {
            const xx = {x: 1, q: '1'},
                f = $q.isIn('q', ['a', 'A', $q.field('x', 'myTable'), null, 1]);
            expect(f(xx)).toBeFalsy();
        });

        it('like with % compares well', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.like('a', 'AAB%');
            expect(f(xx)).toBeTruthy();
        });

        it('like with _ compares well', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.like('a', 'AAB_CC');
            expect(f(xx)).toBeTruthy();
        });

        it('like with a non-string return false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.like('a', 5);
            expect(f(xx)).toBeFalsy();
        });

        it('like with null return null', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.like('a', null);
            expect(f(xx)).toBe(null);
        });

    });

    describe('concatenation with AND', function () {

        it('empty AND shold give a function with isTrue field set', function () {
            const f = $q.and([]);
            expect(f.isTrue).toBe(true);
        });

        it('and of false function with other function should be the always false function', function () {
            const xx = {a: 'AABBCC', q: '1'},
                cond1 = $q.like('a', 'AAB_CC'),
                cond2 = $q.eq('q', 1);
            let cond3 = $q.constant(false);
            const f = $q.and(cond1, cond2, cond3);
            expect(f.isFalse).toBe(true);
            cond3 = $q.constant(true);
            expect(f.isFalse).toBe(true); //check stability of f
        });


        it('and of false function with other function should be the always false function (by array)', function () {
            const xx = {a: 'AABBCC', q: '1'},
                cond1 = $q.like('a', 'AAB_CC'),
                cond2 = $q.eq('q', 1);
            let cond3 = $q.constant(false);
            const f = $q.and([cond1, cond2, cond3]);
            expect(f.isFalse).toBe(true);
            cond3 = $q.constant(true);
            expect(f.isFalse).toBe(true); //check stability of f
        });


        it('and of a series of function including one undefined and one false gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq('q', 1), undefined, $q.constant(false));
            expect(f.isFalse).toBe(true);
        });

        it('and of a series of function including one undefined and one false gives false (by array)', function () {
            const xx = {a: 'AABBCC', q: '1'},
                cond1 = $q.like('a', 'AAB_CC'),
                cond2 = $q.eq('q', 1);
            let cond3 = $q.constant(false);
            const f = $q.and([cond1, cond2, undefined, cond3]);
            expect(f.isFalse).toBe(true);
            cond3 = $q.constant(true);
            expect(f.isFalse).toBe(true);

        });

        it('and of a series of function including one undefined and one dinamically-false gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq('q', 2), undefined);

            expect(f(xx)).toBe(false);
        });

        it('and of a series of function including one undefined and one dinamically-false gives false (by array)', function () {
            const xx = {a: 'AABBCC', q: '1'},
                cond1 = $q.like('a', 'AAB_CC');
            let cond2 = $q.eq('q', 2);
            const f = $q.and([cond1, cond2, undefined]);
            expect(f(xx)).toBe(false);
            cond2 = $q.eq('q', '1');
            expect(f(xx)).toBe(false);
        });


        it('and of a series of function in an undefined context with an always false function gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant('q'), 2), undefined);
            expect(f()).toBe(false);
        });

        it('AND of a series of function in an undefined context with an always false function gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(3), $q.constant(1))), undefined);
            expect(f()).toBe(false);
        });

        it('AND of a series of function in an undefined context with an always false function gives false constant fun', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(3), $q.constant(1))), undefined);
            expect(f.isFalse).toBe(true);
        });
        it('AND of a series of function in an undefined context not always gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.field('a'), $q.constant(1))), undefined);
            expect(f()).toBeFalsy();
        });

        it('and of a series of function including one null and one false gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq('q', 1), null, $q.constant(false));
            expect(f.isFalse).toBe(true);
        });

        it('and of a series of function including one null and one false gives false (by array)', function () {
            const xx = {a: 'AABBCC', q: '1'},
                cond1 = $q.like('a', 'AAB_CC'),
                cond2 = $q.eq('q', 1);
            let cond3 = $q.constant(false);
            const f = $q.and([cond1, cond2, null, cond3]);
            expect(f.isFalse).toBe(true);
            cond3 = $q.constant(true);
            expect(f.isFalse).toBe(true);

        });

        it('and of a series of function including one null and one dinamically-false gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq('q', 2), null);
            expect(f(xx)).toBe(false);
        });

        it('and of a series of function including one null and one dinamically-false gives false (by array)', function () {
            const xx = {a: 'AABBCC', q: '1'},
                cond1 = $q.like('a', 'AAB_CC');
            let cond2 = $q.eq('q', 2);
            const f = $q.and([cond1, cond2, null]);
            expect(f(xx)).toBe(false);
            cond2 = $q.eq('q', '1');
            expect(f(xx)).toBe(false);
        });

        it('and of a series of function in a null context with an always false function gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant('q'), 2), null);
            expect(f()).toBe(false);
        });

        it('AND of a series of function in a null context with an always false function gives false', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(3), $q.constant(1))), null);
            expect(f()).toBe(false);
        });

        it('AND of a series of function in a null context with an always false function gives false constant fun', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.and($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(3), $q.constant(1))), null);
            expect(f.isFalse).toBe(true);
        });

    });

    describe('concatenation with OR', function () {
        it('empty OR shold give a function with isFalse field set', function () {
            const f = $q.or([]);
            expect(f.isFalse).toBe(true);
        });

        it('OR of true function with other function should be the always true function', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq('q', 1), $q.constant(true));
            expect(f.isTrue).toBe(true);
        });


        it('OR of a series of function including one undefined and one true gives true', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq('q', 1), undefined, $q.constant(true));
            expect(f.isTrue).toBe(true);
        });

        it('OR of a series of function in an undefined context with an always true function gives true', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(1), $q.constant(1))), undefined);
            expect(f()).toBe(true);
        });

        it('OR of a series of function in an undefined context with an always true function gives the true constant function', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(1), $q.constant(1))), undefined);
            expect(f.isTrue).toBe(true);
        });

        it('OR of a series of function in an undefined context not always gives true', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.field('a'), $q.constant(1))), undefined);
            expect(f()).toBeFalsy();
        });

        it('OR of a series of function including one null and one true gives true', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq('q', 1), null, $q.constant(true));
            expect(f.isTrue).toBe(true);
        });

        it('OR of a series of function in a null context with an always true function gives true', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(1), $q.constant(1))), null);
            expect(f()).toBe(true);
        });

        it('OR of a series of function in a null context with an always true function gives the true constant function', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.constant(1), $q.constant(1))), null);
            expect(f.isTrue).toBe(true);
        });

        it('OR of a series of function in a null context not always gives true', function () {
            const xx = {a: 'AABBCC', q: '1'},
                f = $q.or($q.like('a', 'AAB_CC'), $q.eq($q.constant(2), $q.add($q.field('a'), $q.constant(1))), null);
            expect(f()).toBeFalsy();
        });

    });

    describe('min, max functions', function () {
        it('min should give the minimum expression value in an array', function () {
            const r1 = {a: 1, b: 2},
                r2 = {a: 2, b: 2},
                r3 = {a: 3, b: null},
                r4 = {a: 1, b: -1},
                r5 = {a: null, b: null},
                rows = [r1, r2, r3, r4, r5];
            expect($q.min('a')(rows)).toBe(1);
            expect($q.min($q.add($q.field('a'), $q.field('b')))(rows)).toBe(0);
            expect($q.max($q.add($q.field('a'), $q.field('b')))(rows)).toBe(4);
            expect($q.max('a')(rows)).toBe(3);
            expect($q.max('b')(rows)).toBe(2);
            expect($q.min('a')(rows)).toBe(1);
            expect($q.min('b')(rows)).toBe(-1);
            rows.push({a: 0});
            expect($q.min('b')(rows)).toBe(-1);
        });
    });

    describe('add, mul, sum functions', function () {
        it('should make the add/ mul / sum skipping nulls when required', function () {
            const r1 = {a: 1, b: 2, c: null},
                r2 = {a: 2, b: 2},
                r3 = {a: 3, b: null},
                r4 = {a: 1, b: -1},
                r5 = {a: null, b: null},
                rows = [r1, r2, r3, r4, r5];
            expect($q.sum($q.field('a'))(rows)).toBe(7);
            expect($q.mul($q.field('a'), $q.field('b'))(r2)).toBe(4);
            expect($q.sum($q.field('b'))(rows)).toBe(3);
            expect($q.mul($q.field('a'), $q.field('b'), $q.field('c'))(r1)).toBe(null);
            expect($q.add($q.field('a'), $q.field('b'), $q.field('c'))(r1)).toBe(null);
        });
    });

    describe('sub / div / modulus /minus functions', function () {
        it('sub/div/modulus should subtract / divide /mod', function () {
            const r1 = {a: 1, b: 2, c: null},
                r2 = {a: 2, b: 2},
                r3 = {a: 3, b: null},
                r4 = {a: 1, b: -1},
                r5 = {a: null, b: null};
            expect($q.sub($q.field('a'), $q.field('b'))(r1)).toBe(-1);
            expect($q.div($q.field('a'), $q.field('b'))(r1)).toBe(1 / 2);
            expect($q.sub($q.field('a'), $q.field('b'))(r2)).toBe(0);
            expect($q.div($q.field('a'), $q.field('b'))(r2)).toBe(1);
            expect($q.modulus($q.field('a'), $q.field('b'))(r1)).toBe(1);
            expect($q.modulus($q.field('a'), $q.field('b'))(r2)).toBe(0);
            expect($q.sub($q.field('a'), $q.field('b'))(r3)).toBe(null);
            expect($q.div($q.field('a'), $q.field('b'))(r3)).toBe(null);
            expect($q.modulus($q.field('a'), $q.field('b'))(r3)).toBe(null);
        });

        it('minus expr should change sign to expr', function () {
            const r1 = {a: 1, b: 2, c: null},
                r2 = {a: 2, b: 2},
                r3 = {a: 3, b: null},
                r4 = {a: 1, b: -1},
                r5 = {a: null, b: null};
            expect($q.minus($q.sub($q.field('a'), $q.field('b')))(r1)).toBe(1);
            expect($q.minus($q.div($q.field('a'), $q.field('b')))(r1)).toBe(-1 / 2);
            expect($q.minus($q.sub($q.field('a'), $q.field('b')))(r2)).toBe(0);
            expect($q.minus($q.div($q.field('a'), $q.field('b')))(r2)).toBe(-1);
            expect($q.minus($q.sub($q.field('a'), $q.field('b')))(r3)).toBe(null);
            expect($q.minus($q.div($q.field('a'), $q.field('b')))(r3)).toBe(null);
        });
    });

    describe('substring should extract a substring like sql server', function () {
        it('should extract a substring of specified size and position', function () {
            const r1 = {a: 'a1234', b: 'WXYZ', c: null},
                r2 = {a: 'a2345', b: 2},
                r3 = {a: 'b1234', b: null},
                r4 = {a: 'c2345', b: -1},
                r5 = {a: null, b: null};
            expect($q.substring('a', 1, 2)(r1)).toBe('a1');
            expect($q.substring('a', 3, 2)(r1)).toBe('23');
            expect($q.substring('a', 3, 4)(r1)).toBe('234');
            expect($q.substring('a', 2, 4)(r2)).toBe('2345');
            expect($q.substring('a', 2, 4)(r2)).toBe('2345');
            expect($q.substring($q.concat($q.field('a'), $q.field('b')), 4, 4)(r1)).toBe('34WX');
            expect($q.substring($q.concat($q.field('a'), $q.field('b'), $q.constant('qq')), 4, 8)(r1)).toBe('34WXYZqq');
            expect($q.substring($q.concat($q.field('a'), $q.field('b'), $q.constant('qq')), -2, 8)(r1)).toBe('a1234WXY');
        });
    });

    describe('convertToInt should convert strings into numbers', function () {

        it('should  convert integers', function () {
            const r1 = {a: '123', b: '012', c: '1234.56'};
            expect($q.convertToInt('a')(r1)).toBe(123);
        });
        it('should  convert 0 prefixed numbers', function () {
            const r1 = {a: '123', b: '012', c: '1234.56'};
            expect($q.convertToInt('b')(r1)).toBe(12);
        });
        it('should  convert decimal numbers', function () {
            const r1 = {a: '123', b: '012', c: '1234.56'};
            expect($q.convertToInt('c')(r1)).toBe(1234);
        });
    });

    describe('convertToString should convert object into strings ', function () {

        it('should  convert integers', function () {
            const r1 = {a: 123, b: '012', c: '1234.56'};
            expect($q.convertToString('a')(r1)).toBe('123');
        });

        it('should  convert decimal numbers', function () {
            const r1 = {a: '123', b: '012', c: 1234.56};
            expect($q.convertToString('c')(r1)).toBe('1234.56');
        });
    });

    describe('mcmp', function () {
        it('$q.mcmp should be a function', function () {
            expect($q.mcmp).toEqual(jasmine.any(Function));
        });

        it('$q.mcmp should return a function', function () {
            const x = ['a', 'b'],
                y = {a: 1, b: 2},
                f = $q.mcmp(x, y);
            expect(f).toEqual(jasmine.any(Function));
        });


        it('$q.mcmp between compatible rows should return true', function () {
            const k = ['a', 'b'],
                y = {a: 1, b: 2, c: 4},
                z = {a: 1, b: 2, c: 3},
                f = $q.mcmp(k, y);
            expect(f(z)).toBeTruthy();
            z.a = 2;
            expect(f(z)).toBeFalsy();
        });

        it('$q.mcmp with no keys should be the true constant', function () {
            const k = [],
                y = {a: 1, b: 2, c: 4},
                z = {a: 1, b: 2, c: 3},
                f = $q.mcmp(k, y);
            expect(f.isTrue).toBeTruthy();
        });

        it('$q.mcmp with some null values should be the false constant', function () {
            const k = ['a', 'b'],
                y = {a: null, b: 2, c: 4},
                z = {a: 1, b: 2, c: 3},
                f = $q.mcmp(k, y);
            expect(f.isFalse).toBeTruthy();
        });

    });

    describe('toObject should convert a DataQuery to a plain object', function () {

        it('$q.toObject should not return null', function () {
            const x = ['a', 'b'],
                obj = $q.toObject(x);
            expect(obj).not.toBe(null);
        });

        it('$q.toObject should not return null', function () {
            const x = 5,
                obj = $q.toObject(x);
            expect(obj).not.toBe(null);
        });

        it('$q.toObject should not return null', function () {
            const x = 15,
                y = [2, 5],
                f = $q.sub(x, $q.mul(y)),
                obj = $q.toObject(f);
            expect(obj).not.toBe(null);
        });

        it('$q.toObject should return a composed expression stringified', function () {
            const x = {a: 1, b: 2},
                f = $q.bitwiseAnd('a', $q.bitwiseNot('b')),
                obj = $q.toObject(f);
            expect(JSON.stringify(obj)).toBe(
                '{"name":"bitwiseAnd","args":[{"value":"a"},{"name":"bitwiseNot","args":[{"value":"b"}]}]}'
            );
        });

        it('$q.toObject should return a list of expressions stringified', function () {
            const x = {a: false, b: true, c: false},
                expr1 = $q.not('a'),
                expr2 = $q.or('a', $q.field('b')),
                f = $q.list(expr1, expr2),
                obj = $q.toObject(f);
            expect(JSON.stringify(obj)).toBe(
                '{"name":"list","args":[{"name":"not","args":[{"value":"a"}]},{"name":"or","args":[{"value":"a"},{"name":"field","args":[{"value":"b"}]}]}]}'
            )
        });

    });

    describe('fromObject should convert a plain object to a DataQuery', function () {

        it('$q.fromObject should return an integer value', function () {
            const obj = {"value": 5},
                f = $q.fromObject(obj);
            expect(f).toEqual(5);
        });

        it('$q.fromObject should return an array of integers', function () {
            const obj = {"array": [{"value": 1}, {"value": 2}, {"value": 10}]},
                f = $q.fromObject(obj);
            expect(f).toEqual(jasmine.any(Array));
            _.forEach(f, function (value) {
                expect(value).toEqual(jasmine.any(Number));
            });
        });

        it('$q.fromObject should return a function', function () {
            const obj = {"name": "sub", "args": [{"value": 15}, {"name": "constant", "args": [{"value": 10}]}]},
                f = $q.fromObject(obj);
            expect(f).toEqual(jasmine.any(Function));
        });

        it('$q.fromObject with a list object should return a function', function () {
            const obj = {
                    "name": "list",
                    "args": [{"name": "field", "args": [{"value": "a"}]}, {"name": "field", "args": [{"value": "b"}]}]
                },
                f = $q.fromObject(obj);
            expect(f).toEqual(jasmine.any(Function));
        });

    });

    describe('Deserialized DataQuery should be coherent with the serialized one', function () {

        it('Coherence check with primitive types', function () {
            const a = 10,
                obj = $q.toObject(a),
                b = $q.fromObject(obj);
            expect(b).toEqual(a);
        });

        it('Coherence check with arrays', function () {
            const arr1 = [1, 2, 3],
                obj = $q.toObject(arr1),
                arr2 = $q.fromObject(obj);
            expect(arr2).toEqual(arr1);
        });

        it('Coherence check with functions', function () {
            const f = $q.and($q.eq(1, 1), $q.gt(2, 1)), a = f(),
                obj = $q.toObject(f),
                g = $q.fromObject(obj), b = g();
            expect(a).toEqual(b);
        });

        it('Coherence check with lists', function () {
            const x = {a: false, b: true, c: false},
                expr1 = $q.not('a'),
                expr2 = $q.or($q.field('a'), $q.field('b')),
                expr3 = $q.and($q.field('b'), $q.field('c')),
                f = $q.list(expr1, expr2, expr3),
                a = f(),
                obj = $q.toObject(f),
                g = $q.fromObject(obj),
                b = g();
            expect(a).toEqual(b);
        });

    });

    describe('list', function () {
        it('$q.list should be a function', function () {
            expect($q.list).toEqual(jasmine.any(Function));
        });

        it('$q.list should return a function', function () {
            const x = 1,
                f = $q.list(x);
            expect(f).toEqual([1]);
        });

        it('list should return an array with length equal to number of operands', function () {
            const x = {a: false, b: true, c: false},
                expr1 = $q.not('a'),
                expr2 = $q.or($q.field('a'), $q.field('b')),
                expr3 = $q.and($q.field('b'), $q.field('c')),
                f = $q.list(expr1, expr2, expr3);
            expect(f(x).length).toBe(3);
        });
    });

    describe('bitwiseNot', function () {
        it('$q.bitwiseNot should be a function', function () {
            expect($q.bitwiseNot).toEqual(jasmine.any(Function));
        });

        it('$q.bitwiseNot should return a function', function () {
            const x = 1,
                f = $q.bitwiseNot(x);
            expect(f).toEqual(jasmine.any(Function));
        });

        it('$q.bitwiseNot of a constant should return ~(constant)', function () {
            let x = 1;
            const f = $q.bitwiseNot(x);
            expect(f({})).toBe(-2);
            x = 5;
            expect(f({})).toBe(-2);
        });

        it('$q.bitwiseNot of an operand should return ~(operand)', function () {
            const x = {a: 1, b: 2},
                f = $q.bitwiseNot($q.field('a'), 1);
            expect(f(x)).toBe(-2);
            x.a = 5;
            expect(f(x)).toBe(-6);
            x.a = true;
            expect(f(x)).toBeFalsy();
            x.a = false;
            expect(f(x)).toBeTruthy();
            x.a = null;
            expect(f(x)).toBeNull();
            x.a = undefined;
            expect(f(x)).toBeUndefined();
        });
    });

    describe('bitwiseAnd', function () {
        it('$q.bitwiseAnd should be a function', function () {
            expect($q.bitwiseAnd).toEqual(jasmine.any(Function));
        });

        it('$q.bitwiseAnd should return a function', function () {
            const x = 1,
                y = 2,
                f = $q.bitwiseAnd(x, y);
            expect(f).toEqual(jasmine.any(Function));
        });

        it('bitwiseAnd of same value should return same value', function () {
            const x = {a: 3, b: 3},
                y = {a: 4, b: 4},
                f = $q.bitwiseAnd($q.field('a'), $q.field('b'));
            expect(f(x)).toBe(3);
            expect(f(y)).toBe(4);
        });

        it('bitwiseAnd works for multiple values', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.field('a'),
                operand2 = $q.field('b'),
                operand3 = $q.field('c'),
                f = $q.bitwiseAnd(operand1, operand2, operand3);
            expect(f(x)).toBe(0);
        });

        it('bitwiseAnd works for multiple value (by array)', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.field('a'),
                operand2 = $q.field('b'),
                operand3 = $q.field('c'),
                f = $q.bitwiseAnd(operand1, operand2, operand3);
            expect(f(x)).toBe(0);
        });

        it('bitwiseAnd works for composite bitwise expressions', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.bitwiseNot('a'),
                operand2 = $q.bitwiseOr($q.field('a'), $q.field('b')),
                operand3 = $q.bitwiseOr($q.field('b'), $q.field('c')),
                f = $q.bitwiseOr(operand1, operand2, operand3);
            expect(f(x)).toBe(-1);
        });
    });

    describe('bitwiseOr', function () {
        it('$q.bitwiseOr should be a function', function () {
            expect($q.bitwiseOr).toEqual(jasmine.any(Function));
        });

        it('$q.bitwiseOr should return a function', function () {
            const x = 1,
                y = 2,
                f = $q.bitwiseOr(x, y);
            expect(f).toEqual(jasmine.any(Function));
        });

        it('bitwiseOr of same value should return same value', function () {
            const x = {a: 3, b: 3},
                y = {a: 4, b: 4},
                f = $q.bitwiseOr($q.field('a'), $q.field('b'));
            expect(f(x)).toBe(3);
            expect(f(y)).toBe(4);
        });

        it('bitwiseOr works for multiple values', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.field('a'),
                operand2 = $q.field('b'),
                operand3 = $q.field('c'),
                f = $q.bitwiseOr(operand1, operand2, operand3);
            expect(f(x)).toBe(3);
        });

        it('bitwiseOr works for multiple value (by array)', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.field('a'),
                operand2 = $q.field('b'),
                operand3 = $q.field('c'),
                f = $q.bitwiseOr(operand1, operand2, operand3);
            expect(f(x)).toBe(3);
        });

        it('bitwiseOr works for composite bitwise expressions', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.bitwiseNot('a'),
                operand2 = $q.bitwiseAnd($q.field('a'), $q.field('b')),
                operand3 = $q.bitwiseAnd($q.field('b'), $q.field('c')),
                f = $q.bitwiseOr(operand1, operand2, operand3);
            expect(f(x)).toBe(-2);
        });
    });

    describe('bitwiseXor', function () {
        it('$q.bitwiseXor should be a function', function () {
            expect($q.bitwiseXor).toEqual(jasmine.any(Function));
        });

        it('$q.bitwiseXor should return a function', function () {
            const x = 1,
                y = 2,
                f = $q.bitwiseXor(x, y);
            expect(f).toEqual(jasmine.any(Function));
        });

        it('bitwiseXor of same value should return zero', function () {
            const x = {a: 3, b: 3},
                y = {a: 4, b: 4},
                f = $q.bitwiseXor($q.field('a'), $q.field('b'));
            expect(f(x)).toBe(0);
            expect(f(y)).toBe(0);
        });

        it('bitwiseXor works for multiple values', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.field('a'),
                operand2 = $q.field('b'),
                operand3 = $q.field('c'),
                f = $q.bitwiseXor(operand1, operand2, operand3);
            expect(f(x)).toBe(0);
        });

        it('bitwiseXor works for multiple value (by array)', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.field('a'),
                operand2 = $q.field('b'),
                operand3 = $q.field('c'),
                f = $q.bitwiseXor(operand1, operand2, operand3);
            expect(f(x)).toBe(0);
        });

        it('bitwiseXor works for composite bitwise expressions', function () {
            const x = {a: 1, b: 2, c: 3},
                operand1 = $q.bitwiseNot('a'),
                operand2 = $q.bitwiseAnd($q.field('b'), $q.field('c')),
                operand3 = $q.bitwiseOr($q.field('b'), $q.field('c')),
                f = $q.bitwiseXor(operand1, operand2, operand3);
            expect(f(x)).toBe(-1);
        });
    });

    it('A DataQuery should be usable with find', function () {
        const p=[{a: 1, b: 2, c: 4},{a: 2, b: 3, c: 5},{a: 3, b: 4, c: 6},{a: 3, b: 5, c: 6}],
        cmp_a_3 = $q.eq("a",3),
        cmp_a_1 = $q.eq("a",1);
        let res_1 = p.find(cmp_a_1);
        let res_3 = p.find(cmp_a_3);
        expect(res_1).toBe(p[0]);
        expect(res_3).toBe(p[2]);
    });

    it('A DataQuery should be usable with filter', function () {
        const p=[{a: 1, b: 2, c: 4},{a: 2, b: 3, c: 5},{a: 3, b: 4, c: 6},{a: 3, b: 5, c: 6}],
            cmp_a_3 = $q.eq("a",3),
            cmp_a_1 = $q.eq("a",1);
        let res_1 = p.filter(cmp_a_1);
        let res_3 = p.filter(cmp_a_3);
        expect(res_1).toEqual([p[0]]);
        expect(res_3).toEqual([p[2],p[3]]);
    });
});
