/*
 * == BSD2 LICENSE ==
 * Copyright (c) 2014, Tidepool Project
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the associated License, which is identical to the BSD 2-Clause
 * License as published by the Open Source Initiative at opensource.org.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the License for more details.
 *
 * You should have received a copy of the License along with this program; if
 * not, you can obtain one from Tidepool Project at tidepool.org.
 * == BSD2 LICENSE ==
 */

var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;

var fmt = require('../js/data/util/format');

describe('format utility', function() {
  describe('tooltipBG', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.tooltipBG);
    });

    it('should always return a string', function() {
      assert.isString(fmt.tooltipBG({value: 0.9999999999999999999999999}, 'mg/dL'));
      assert.isString(fmt.tooltipBG({value: 0.9999999999999999999999999}, 'mmol/L'));
    });

    it('should return an integer string when units are mg/dL', function() {
      expect(fmt.tooltipBG({value: 0.9999999999999999999999999}, 'mg/dL')).to.equal('1');
    });

    it('should return a float string with one decimal place when units are mmol/L', function() {
      expect(fmt.tooltipBG({value: 0.9999999999999999999999999}, 'mmol/L')).to.equal('1.0');
      expect(fmt.tooltipBG({value: 4.2222222222222222222222222}, 'mmol/L')).to.equal('4.2');
    });

    it('should return a float string with one decimal place when no units', function() {
      expect(fmt.tooltipBG({value: 4.2222222222222222222222222})).to.equal('4.2');
    });
  });

  describe('tooltipValue', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.tooltipValue);
    });

    it('should always return a string', function() {
      assert.isString(fmt.tooltipValue(0));
      assert.isString(fmt.tooltipValue(0.9999999999999999999999999));
    });

    it('should return `0.0` when passed a value of 0', function() {
      expect(fmt.tooltipValue(0)).to.equal('0.0');
    });

    it('should return `1.075` when passed a value of 1.07499999999999999999', function() {
      expect(fmt.tooltipValue(1.07499999999999999999)).to.equal('1.075');
    });

    it('should remove right-hand zero padding where applicable', function() {
      expect(fmt.tooltipValue(1.200)).to.equal('1.2');
    });
  });

  describe('capitalize', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.capitalize);
    });

    it('should capitalize a string', function() {
      expect(fmt.capitalize('foo')).to.equal('Foo');
    });
  });

  describe('dayAndDate', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.dayAndDate);
    });

    it('should return `Mon, Nov 17` on a UTC timestamp of midnight 11/17/2014', function() {
      var tstr = '2014-11-17T00:00:00.000Z';
      expect(fmt.dayAndDate(tstr)).to.equal('Mon, Nov 17');
    });

    it('should return `Mon, Nov 17` on a UTC timestamp of 8 a.m. 11/17/2014 when passed a Pacific DST offset', function() {
      var tstr = '2014-11-17T08:00:00.000Z';
      expect(fmt.dayAndDate(new Date(Date.parse(tstr) - 1).toISOString(), -480)).to.equal('Sun, Nov 16');
      expect(fmt.dayAndDate(tstr, -480)).to.equal('Mon, Nov 17');
    });
  });

  describe('fixFloatingPoint', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.fixFloatingPoint);
    });

    it('should return 1.075 when passed a value of 1.07499999999999999999', function() {
      expect(fmt.fixFloatingPoint(1.07499999999999999999)).to.equal(1.075);
    });
  });

  describe('percentage', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.percentage);
    });

    it('should return `-- %` when passed NaN', function() {
      expect(fmt.percentage(NaN)).to.equal('-- %');
    });

    it('should return an integer percentage when passed a value between 0.0 and 1.0', function() {
      expect(fmt.percentage(0.6666666666666666666666667)).to.equal('67%');
    });
  });

  describe('millisecondsAsTimeOfDay', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.millisecondsAsTimeOfDay);
    });

    it('should translate a value of milliseconds per 24 hours into a timestamp', function() {
      expect(fmt.millisecondsAsTimeOfDay(3900000)).to.equal('1:05 AM');
    });
  });

  describe('timespan', function() {
    var MS_IN_HR = 3600000;
    it('should be a function', function() {
      assert.isFunction(fmt.timespan);
    });

    it('should return `over 21 min` on a datum with duration of 21 minutes', function() {
      expect(fmt.timespan({duration: 1260000})).to.equal('over 21 min');
    });

    it('should return `over 1 ¾ hr` on a datum wit a duration of 1.75 hours', function() {
      expect(fmt.timespan({duration: 1.75*MS_IN_HR})).to.equal('over 1 ¾ hr');
    });

    it('should return `over 6 ⅔ hrs` on a datum with a duration of 6.67 hours', function() {
      expect(fmt.timespan({duration: (20/3)*MS_IN_HR})).to.equal('over 6 ⅔ hrs');
    });
  });

  describe('timestamp', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.timestamp);
    });

    it('should return `1:00 am` on a UTC timestamp at 1 am', function() {
      expect(fmt.timestamp('2014-01-01T01:00:00.000Z')).to.equal('1:00 am');
    });

    it('should return `5:00 pm` on a UTC timestamp at 1 am with a Pacific non-DST offset', function() {
      expect(fmt.timestamp('2014-01-01T01:00:00.000Z', -480)).to.equal('5:00 pm');
    });
  });

  describe('timeChangeInfo', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.timeChangeInfo);
    });

    it('should error if 2 arguments are not passed', function() {
      var err = 'You have not provided two datetime strings';
      var x = '2014-01-01T01:00:00.000Z';
      expect(fmt.timeChangeInfo.bind(fmt)).to.throw(err);
      expect(fmt.timeChangeInfo.bind(fmt, x)).to.throw(err);
    });

    it('should return an object containing strings of times when both are on same day', function() {
      var x = '2014-01-01T01:00:00.000Z';
      var y = '2014-01-01T04:00:00.000Z';
      var y2 = '2014-01-01T23:00:00.000Z';
      expect(fmt.timeChangeInfo(x,y)).to.eql({type: 'Time Change', from: '1:00 AM', to: '4:00 AM'});
      expect(fmt.timeChangeInfo(x,y2)).to.eql({type: 'Time Change', from: '1:00 AM', to: '11:00 PM'});
      expect(fmt.timeChangeInfo(y,y2)).to.eql({type: 'Time Change', from: '4:00 AM', to: '11:00 PM'});
    });

    it('should label object as type Clock Drift Adjustment if difference is less than 8 minutes', function() {
      var x = '2014-01-01T01:00:00.000Z';
      var y = '2014-01-01T01:06:00.000Z';
      expect(fmt.timeChangeInfo(x,y)).to.eql({type: 'Clock Drift Adjustment', from: '1:00 AM', to: '1:06 AM'});
    });

    it('should return an object containing strings of times and date when values are on different days', function() {
      var x = '2014-01-01T01:00:00.000Z';
      var y = '2014-01-02T04:00:00.000Z';
      var y2 = '2014-01-30T04:00:00.000Z';
      expect(fmt.timeChangeInfo(x,y)).to.eql({type: 'Time Change', from: '1 Jan 1:00 AM', to: '2 Jan 4:00 AM'});
      expect(fmt.timeChangeInfo(x,y2)).to.eql({type: 'Time Change', from: '1 Jan 1:00 AM', to: '30 Jan 4:00 AM'});
    });

    it('should return an object containing strings of times and date when values are in different years', function() {
      var x = '2014-12-31T04:00:00.000Z';
      var y = '2015-01-01T01:00:00.000Z';
      var y2 = '2015-04-15T04:25:00.000Z';
      expect(fmt.timeChangeInfo(x,y)).to.eql({type: 'Time Change', from: '31 Dec 2014 4:00 AM', to: '1 Jan 2015 1:00 AM'});
      expect(fmt.timeChangeInfo(x,y2)).to.eql({type: 'Time Change', from: '31 Dec 2014 4:00 AM', to: '15 Apr 2015 4:25 AM'});
    });
  });

  describe('xAxisDayText', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.xAxisDayText);
    });

    it('should return `Wednesday, January 1` on a UTC timestamp at 1 am on first day of 2014', function() {
      expect(fmt.xAxisDayText('2014-01-01T01:00:00.000Z')).to.equal('Wednesday, January 1');
    });

    it('should return `Tuesday, December 31` on same UTC timestamp when passed a Pacific non-DST offset', function() {
      expect(fmt.xAxisDayText('2014-01-01T01:00:00.000Z', -480)).to.equal('Tuesday, December 31');
    });
  });

  describe('xAxisTickText', function() {
    it('should be a function', function() {
      assert.isFunction(fmt.xAxisTickText);
    });

    it('should return return `1 am` on a UTC timestamp at 1 am', function() {
      expect(fmt.xAxisTickText('2014-01-01T01:00:00.000Z')).to.equal('1 am');
    });

    it('should return `5 pm` on same UTC timestamp when passed a Pacific non-DST offset', function() {
      expect(fmt.xAxisTickText('2014-01-01T01:00:00.000Z', -480)).to.equal('5 pm');
    });

    it('should return `6 pm` on same UTC timestamp when passed a Pacific DST offset', function() {
      expect(fmt.xAxisTickText('2014-04-01T01:00:00.000Z', -420)).to.equal('6 pm');
    });
  });
});
