/*globals beforeEach,afterEach,describe,jasmine,it,expect,inject,spyOn,Environment */
/*jslint nomen: true */
/*jslint bitwise: true */

console.log("running jsOracleFormatterSpec");

const $q= require('../../client/components/metadata/jsDataQuery').jsDataQuery,
    $qf = require('../../src/jsOracleFormatter').jsOracleFormatter;

function fieldGet(field){return function(r){return r[field];};}

xdescribe('oracle DataQuery functions', function () {

  var ds,
      /**
       * @private
       * @property textCtx
       * @type Environment
       */
    testCtx = {
      myNull:null,
      a:1,
      b:2,
      c:3,
      d:'four',
      e:'five',
      f:['a','b','c'],
      g:{a:11, b:12, c:13}
    };


  describe('quoting constants', function () {
    it('quote number should use . for separating decimals ', function () {
      expect($qf.quote(12.345)).toBe('12.345');
    });
    it('quote number should not use use , for separating thousands ', function () {
      expect($qf.quote(123456789.123)).toBe('123456789.123');
    });
    it('nosurround quotes has no effect on numbers', function () {
      expect($qf.quote(123456789.123, true)).toBe('123456789.123');
    });
    it('strings without quotes are returned quoted', function () {
      var a = '8y7q7c3y07psway7rq<>*§@a^?""""""#a23\\!';
      expect($qf.quote(a)).toBe('\'' + a + '\'');
    });

    it('strings quotes in strings are doubled', function () {
      var a = '8y7q7c3y07\'\'\'psway\'7rq<>*§@a^?""""""#a23\\!',
        expected = '\'8y7q7c3y07\'\'\'\'\'\'psway\'\'7rq<>*§@a^?""""""#a23\\!\'';
      expect($qf.quote(a)).toBe(expected);
    });
    it('external quotes in strings quotes are not returned if nosurround is specified', function () {
      var a = '8y7q7c3y07\'\'\'psway\'7rq<>*§@a^?""""""#a23\\!',
        expected = '8y7q7c3y07\'\'\'\'\'\'psway\'\'7rq<>*§@a^?""""""#a23\\!';
      expect($qf.quote(a, true)).toBe(expected);
    });

    it('dates with times are written with the ts notation', function () {
      //stupid js counts month starting by 0
      var d = new Date(2014, 11, 31, 3, 13, 42, 123);
      expect($qf.quote(d)).toBe('{ts \'2014-12-31 03:13:42.123\'}');
    });

    it('dates have no problem with limit values (min)', function () {
      //stupid js counts month starting by 0
      var d = new Date(1, 0, 1, 0, 0, 0, 1);
      d.setFullYear(1,0,1);
      expect($qf.quote(d)).toBe('{ts \'0001-01-01 00:00:00.001\'}');
    });

    it('dates have no problem with limit values (min)', function () {
      //stupid js counts month starting by 0
      var d = new Date(2499, 0, 1, 0, 0, 0, 1);
      d.setFullYear(2499, 0, 1);
      expect($qf.quote(d)).toBe('{ts \'2499-01-01 00:00:00.001\'}');
    });


    it('dates without times are written with the d notation', function () {
      //stupid js counts month starting by 0
      var d = new Date(2014, 11, 31);
      expect($qf.quote(d)).toBe('{d \'2014-12-31\'}');
    });

    it('dates without times are written with the d notation', function () {
      //stupid js counts month starting by 0
      var d = new Date(2014, 11, 31);
      expect($qf.quote(d,true)).toBe('{d \'2014-12-31\'}');
    });

    it('integer are rendered without dot', function () {
      //stupid js counts month starting by 0
      var d = 121217;
      expect($qf.quote(d)).toBe('121217');
    });

    it('negative numbers are rendered', function () {
      //stupid js counts month starting by 0
      var d = -121217;
      expect($qf.quote(d)).toBe('-121217');
    });


    it('boolean are rendered', function () {
      //stupid js counts month starting by 0
      var d = true;
      expect($qf.quote(d)).toBe('true');
    });

    it('0 is rendered', function () {
      //stupid js counts month starting by 0
      var d = 0;
      expect($qf.quote(d)).toBe('0');
    });

    it('empty string is rendered', function () {
      //stupid js counts month starting by 0
      var d = '';
      expect($qf.quote(d)).toBe('\'\'');
    });

    it('null are rendered', function () {
      //stupid js counts month starting by 0
      var d = null;
      expect($qf.quote(d)).toBe('null');
    });

    it('undefined are rendered as null', function () {
      //stupid js counts month starting by 0
      var d = undefined;
      expect($qf.quote(d)).toBe('null');
    });

  });

  describe('comparing functions', function (){
    let testCtx = {
      myNull:null,
      a:1,
      b:2,
      c:3,
      d:'four',
      e:'five',
      f:['a','b','c'],
      g:{a:11, b:12, c:13}
    };

    it ('eq should return a comparison', function(){
      var f = $q.eq('a',2);
      expect(f.toSql($qf)).toBe('(a=2)');
    });

    it('eq should return an always true function if between equal constant', function () {
      var f = $q.eq(2, $q.add($q.constant(1),$q.constant(1)));
      expect(f.toSql($qf)).toBe('(1=1)');
    });

    it('eq should return an always false function if between different constant', function () {
      var f = $q.eq(2, $q.add($q.constant(1), $q.constant(2)));
      expect(f.toSql($qf)).toBe('(1=0)');
    });


    it('eq should return a comparison (using context)', function () {
      var f = $q.eq('a', $q.context(fieldGet('b')));
      expect(f.toSql($qf,testCtx)).toBe('(a=2)');
    });


    it('isIn(\'el\',[1,2,3]) should work', function(){
      expect($qf.isIn('el',[1,2,3])).toBe('(\'el\' in (1,2,3))');
    });

    it('isIn(\'el\',[1,2,3]) should work (using context)', function () {
      expect($qf.isIn('el', [$q.context(fieldGet('a')),
        $q.context(fieldGet('b')),
        $q.context(fieldGet('c'))], testCtx)).toBe('(\'el\' in (1,2,3))');
    });


    it('testMask(\'a\', 12, 25) should work', function () {
      expect($qf.testMask('a', 12, 25)).toBe('((\'a\' & 12)=25)');
    });

    it('between(\'a\', 12, 25) should work', function () {
      expect($qf.between('a', 12, 25)).toBe('(\'a\' between 12 and 25)');
    });

    it('between(\'a\', 12, 25) should work (using context)', function () {

      expect($qf.between('a',
        $q.context(function(env){return env.g.b;}),
        25,
        testCtx)).toBe('(\'a\' between 12 and 25)');
    });


    it('isIn(field(\'el\'),[1,2,3]) should work', function () {
      expect($qf.isIn($q.field('el'), [1, 2, 3], testCtx)).toBe('(el in (1,2,3))');
    });


    it('testMask(\'a\', 12, 25) should work', function () {
      expect($qf.testMask('a', 12, 25)).toBe('((\'a\' & 12)=25)');
    });

    it('testMask(\'a\', 12, 25) should work (using context)', function () {
      expect($qf.testMask($q.context(function (env) {return env.f[0];}), 12, 25, testCtx)).toBe('((\'a\' & 12)=25)');
    });

    it('between(\'a\', 12, 25) should work', function () {
      expect($qf.between($q.field('a'), 12, 25)).toBe('(a between 12 and 25)');
    });
    it('between(\'a\', 12, 25) should work (using context)', function () {
      expect($qf.between($q.field('a'), $q.context(function (env) {
        return env.g.b;
      }), 25, testCtx)).toBe('(a between 12 and 25)');
    });

    it('q.between automatically apply fields on first parameter', function () {
      var f= $q.between('a',12,25);
      expect(f.toSql($qf)).toBe('(a between 12 and 25)');
    });

    it('q.like(a,\'q%\') works ', function () {
      var f = $q.like('a','q%');
      expect(f.toSql($qf)).toBe('(a like \'q%\')');
    });


  });

  describe('logical operators', function () {
    let testCtx = {
      myNull:null,
      a:1,
      b:2,
      c:3,
      d:'four',
      e:'five',
      f:['a','b','c'],
      g:{a:11, b:12, c:13}
    };

    it('and should join given function with AND', function () {
      var f = $q.and($q.eq('a', 2), $q.eq('b',3), $q.eq('c',4));
      expect(f.toSql($qf)).toBe('((a=2) and (b=3) and (c=4))');
    });

    it('and should join given function with AND (using context)', function () {
      var f = $q.and($q.eq('a', $q.context(fieldGet('b'))), $q.eq('b', 3),
            $q.eq('c', $q.add($q.context(fieldGet('a')), $q.context(fieldGet('c')),
              $q.context(function (env) {return env.g.c;}))));
      expect(f.toSql($qf, testCtx)).toBe('((a=2) and (b=3) and (c=(1+3+13)))');
    });


    it('or should join given function with OR', function () {
      var f = $q.or($q.eq('a', 2), $q.eq('b', 3), $q.eq('c', 4));
      expect(f.toSql($qf)).toBe('((a=2) or (b=3) or (c=4))');
    });

  });
  describe('evaluating functions', function (){

    let testCtx = {
      myNull:null,
      a:1,
      b:2,
      c:3,
      d:'four',
      e:'five',
      f:['a','b','c'],
      g:{a:11, b:12, c:13}
    };

    it('toSql of a string should give the quoted string', function (){
      expect($qf.toSql('a')).toBe('\'a\'');
    });

    it('toSql of a numer should give the number as string', function () {
      expect($qf.toSql(123)).toBe('123');
    });

    it('toSql of an array should give the sql set of values', function () {
      expect($qf.toSql([1,2,null,4,5,6,'A'])).toBe('(1,2,null,4,5,6,\'A\')');
    });
    it('toSql of an array should give the sql set of values (with context)', function () {
      expect($qf.toSql([1, 2, null, 4, 5, 6,
        $q.context(function (env) {return env.f[0];})],
        testCtx)).toBe('(1,2,null,4,5,6,\'a\')');
    });


    it('toSql of a query function should call the toSql method of the function', function () {
      var q1 = $q.eq('a',2);
      var q2 = $q.eq('a',3);
      var q3 = $q.and(q1,q2);
      spyOn(q1,'toSql').and.callThrough();
      expect(q3.toSql($qf)).toBe('((a=2) and (a=3))');
      expect(q1.toSql).toHaveBeenCalled();
    });


    it('toSql of a composed query works', function () {
      var q = $q.or($q.and($q.eq('a', 2),$q.eq('b',3)), $q.and($q.eq('d','a'),$q.lt('c',1)));
      expect($qf.toSql(q)).toBe('(((a=2) and (b=3)) or ((d=\'a\') and (c<1)))');
    });


    it('toSql of a composed query works (using context)', function () {
      var q = $q.or($q.and($q.eq('a', 2), $q.eq('b', $q.context(fieldGet('c')))),
              $q.and($q.eq('d', 'a'), $q.lt('c', $q.context(fieldGet('a')))));
      expect($qf.toSql(q,testCtx)).toBe('(((a=2) and (b=3)) or ((d=\'a\') and (c<1)))');
    });

  });
});
