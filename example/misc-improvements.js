(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

var $ = window.$;
var d3 = window.d3;
var _ = window._;

var bows = window.bows;

var tideline = require('../js');
var watson = require('./watson');

var fill = tideline.plot.util.fill;
var scales = tideline.plot.util.scales;

// Create a 'One Day' chart object that is a wrapper around Tideline components
function chartDailyFactory(el, options, emitter) {
  var log = bows('Daily Factory');
  options = options || {};

  var chart = tideline.oneDay(emitter);
  chart.emitter = emitter;

  var poolMessages, poolBG, poolBolus, poolBasal, poolStats;

  var SMBG_SIZE = 16;

  var create = function(el, options) {
    // basic chart set up
    chart.width($(el).width()).height($(el).height());

    if (options.imagesBaseUrl) {
      chart.imagesBaseUrl(options.imagesBaseUrl);
    }

    d3.select(el).call(chart);

    return chart;
  };

  chart.setupPools = function() {
    // messages pool
    poolMessages = chart.newPool()
      .id('poolMessages', chart.poolGroup())
      .label('')
      .index(chart.pools().indexOf(poolMessages))
      .weight(0.5);

    // blood glucose data pool
    poolBG = chart.newPool()
      .id('poolBG', chart.poolGroup())
      .label('Blood Glucose')
      .index(chart.pools().indexOf(poolBG))
      .weight(1.5);

    // carbs and boluses data pool
    poolBolus = chart.newPool()
      .id('poolBolus', chart.poolGroup())
      .label('Bolus & Carbohydrates')
      .index(chart.pools().indexOf(poolBolus))
      .weight(1.5);
    
    // basal data pool
    poolBasal = chart.newPool()
      .id('poolBasal', chart.poolGroup())
      .label('Basal Rates')
      .index(chart.pools().indexOf(poolBasal))
      .weight(1.0);

    // stats data pool
    poolStats = chart.newPool()
      .id('poolStats', chart.poolGroup())
      .index(chart.pools().indexOf(poolStats))
      .weight(1.0);

    chart.arrangePools();

    chart.setTooltip();

    // add tooltips
    chart.tooltips().addGroup(d3.select('#' + poolBG.id()), 'cbg');
    chart.tooltips().addGroup(d3.select('#' + poolBG.id()), 'smbg');
    chart.tooltips().addGroup(d3.select('#' + poolBolus.id()), 'carbs');
    chart.tooltips().addGroup(d3.select('#' + poolBolus.id()), 'bolus');
    chart.tooltips().addGroup(d3.select('#' + poolBasal.id()), 'basal');

    return chart;
  };

  chart.load = function(data, datetime) {
    // data munging utilities for stats
    var deviceUtil = new tideline.data.DeviceUtil(data);
    var basalUtil = new tideline.data.BasalUtil(_.where(data, {'type': 'basal-rate-segment'}));
    var bolusUtil = new tideline.data.BolusUtil(_.where(data, {'type': 'bolus'}));
    var cbgUtil = new tideline.data.CBGUtil(_.where(data, {'type': 'cbg'}));

    chart.stopListening();
    // initialize chart with data
    chart.data(data).setAxes().setNav().setScrollNav();

    // BG pool
    var allBG = _.filter(data, function(d) {
      if ((d.type === 'cbg') || (d.type === 'smbg')) {
        return d;
      }
    });
    var scaleBG = scales.bgLog(allBG, poolBG, SMBG_SIZE/2);
    // set up y-axis
    poolBG.yAxis(d3.svg.axis()
      .scale(scaleBG)
      .orient('left')
      .outerTickSize(0)
      .tickValues(scales.bgTicks(allBG))
      .tickFormat(d3.format('g')));
    // add background fill rectangles to BG pool
    poolBG.addPlotType('fill', fill(poolBG, {endpoints: chart.endpoints}), false, true);

    // add CBG data to BG pool
    poolBG.addPlotType('cbg', tideline.plot.cbg(poolBG, {yScale: scaleBG}), true, true);

    // add SMBG data to BG pool
    poolBG.addPlotType('smbg', tideline.plot.smbg(poolBG, {yScale: scaleBG}), true, true);

    // bolus & carbs pool
    var scaleBolus = scales.bolus(_.where(data, {'type': 'bolus'}), poolBolus);
    var scaleCarbs = scales.carbs(_.where(data, {'type': 'carbs'}), poolBolus);
    // set up y-axis for bolus
    poolBolus.yAxis(d3.svg.axis()
      .scale(scaleBolus)
      .orient('left')
      .outerTickSize(0)
      .ticks(3));
    // set up y-axis for carbs
    poolBolus.yAxis(d3.svg.axis()
      .scale(scaleCarbs)
      .orient('left')
      .outerTickSize(0)
      .ticks(3));
    // add background fill rectangles to bolus pool
    poolBolus.addPlotType('fill', fill(poolBolus, {endpoints: chart.endpoints}), false, true);

    // add carbs data to bolus pool
    poolBolus.addPlotType('carbs', tideline.plot.carbs(poolBolus, {
      yScale: scaleCarbs,
      emitter: emitter,
      data: _.where(data, {'type': 'carbs'})
    }), true, true);

    // add bolus data to bolus pool
    poolBolus.addPlotType('bolus', tideline.plot.bolus(poolBolus, {
      yScale: scaleBolus,
      emitter: emitter,
      data: _.where(data, {'type': 'bolus'})
    }), true, true);

    // basal pool
    var scaleBasal = scales.basal(_.where(data, {'type': 'basal-rate-segment'}), poolBasal);
    // set up y-axis
    poolBasal.yAxis(d3.svg.axis()
      .scale(scaleBasal)
      .orient('left')
      .outerTickSize(0)
      .ticks(4));
    // add background fill rectangles to basal pool
    poolBasal.addPlotType('fill', fill(poolBasal, {endpoints: chart.endpoints}), false, true);

    // add basal data to basal pool
    poolBasal.addPlotType('basal-rate-segment', tideline.plot.basal(poolBasal, {
      yScale: scaleBasal,
      data: _.where(data, {'type': 'basal-rate-segment'}),
      lastDatum: deviceUtil.findLastDatum()
    }), true, true);

    // messages pool
    // add background fill rectangles to messages pool
    poolMessages.addPlotType('fill', fill(poolMessages, {endpoints: chart.endpoints}), false, true);

    // add message images to messages pool
    poolMessages.addPlotType('message', tideline.plot.message(poolMessages, {
      size: 30,
      emitter: emitter
    }), true, true);

    // stats pool
    poolStats.addPlotType('stats', tideline.plot.stats.widget(poolStats, {
      cbg: cbgUtil,
      bolus: bolusUtil,
      basal: basalUtil,
      xPosition: chart.axisGutter(),
      yPosition: 0,
      emitter: emitter,
      oneDay: true
    }), false, false);

    return chart;
  };

  // locate the chart around a certain datetime
  // if called without an argument, locates the chart at the most recent 24 hours of data
  chart.locate = function(datetime) {

    var start, end, localData;

    var mostRecent = function() {
      start = chart.initialEndpoints[0];
      end = chart.initialEndpoints[1];
      localData = chart.getData(chart.initialEndpoints, 'both');
    };

    if (!arguments.length) {
      mostRecent();
    }
    else {
      // translate the desired center-of-view datetime into an edgepoint for tideline
      start = new Date(datetime);
      var plusHalf = new Date(start);
      plusHalf.setUTCHours(plusHalf.getUTCHours() + 12);
      var minusHalf = new Date(start);
      minusHalf.setUTCHours(minusHalf.getUTCHours() - 12);
      if ((start.valueOf() < chart.endpoints[0]) || (start.valueOf() > chart.endpoints[1])) {
        log('Please don\'t ask tideline to locate at a date that\'s outside of your data!');
        log('Rendering most recent data instead.');
        mostRecent();
      }
      else if (plusHalf.valueOf() > chart.endpoints[1]) {
        mostRecent();
      }
      else if (minusHalf.valueOf() < chart.endpoints[0]) {
        start = chart.endpoints[0];
        var firstEnd = new Date(start);
        firstEnd.setUTCDate(firstEnd.getUTCDate() + 1);
        end = firstEnd;
        localData = chart.getData([start, firstEnd], 'both');
      }
      else {
        end = new Date(start);
        start.setUTCHours(start.getUTCHours() - 12);
        end.setUTCHours(end.getUTCHours() + 12);

        localData = chart.getData([start, end], 'both');
      }
    }

    chart.beginningOfData(start).endOfData(end);
    chart.allData(localData, [start, end]);

    chart.setAtDate(start).navString([start, end]);

    // render pools
    chart.pools().forEach(function(pool) {
      pool.render(chart.poolGroup(), localData);
    });

    return chart;
  };

  chart.getCurrentDay = function() {
    return chart.getCurrentDomain().center;
  };

  return create(el, options);
}

module.exports = chartDailyFactory;
},{"../js":13,"./watson":4}],2:[function(require,module,exports){
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

var $ = window.$;
var d3 = window.d3;
var _ = window._;

var bows = window.bows;

var tideline = require('../js');
var watson = require('./watson');

var fill = tideline.plot.util.fill;

// Create a 'Two Weeks' chart object that is a wrapper around Tideline components
function chartWeeklyFactory(el, options, emitter) {
  var log = bows('Weekly Factory');
  options = options || {};

  var chart = tideline.twoWeek(emitter);
  chart.emitter = emitter;

  var pools = [];

  var create = function(el, options) {
    // basic chart set up
    chart.width($(el).width()).height($(el).height());

    if (options.imagesBaseUrl) {
      chart.imagesBaseUrl(options.imagesBaseUrl);
      // dataGutter should be imageSize/2
      chart.dataGutter(8);
    }

    d3.select(el).call(chart);

    return chart;
  };

  chart.load = function(data, datetime) {
    // data munging utilities for stats
    var basalUtil = new tideline.data.BasalUtil(_.where(data, {'type': 'basal-rate-segment'}));
    var bolusUtil = new tideline.data.BolusUtil(_.where(data, {'type': 'bolus'}));
    var cbgUtil = new tideline.data.CBGUtil(_.where(data, {'type': 'cbg'}));

    if (!datetime) {
      chart.data(_.where(data, {'type': 'smbg'}));
    }
    else {
      var smbgData = _.where(data, {'type': 'smbg'});
      if (datetime.valueOf() > Date.parse(smbgData[smbgData.length - 1].normalTime)) {
        datetime = smbgData[smbgData.length - 1].normalTime;
      }
      chart.data(smbgData, datetime);
    }

    chart.setup();

    var days = chart.days;

    // make pools for each day
    days.forEach(function(day, i) {
      var newPool = chart.newPool()
        .id('poolBG_' + day, chart.daysGroup())
        .index(chart.pools().indexOf(newPool))
        .weight(1.0);
    });

    chart.arrangePools();

    chart.setAxes().setNav().setScrollNav();

    var fillEndpoints = [new Date('2014-01-01T00:00:00Z'), new Date('2014-01-02T00:00:00Z')];
    var fillScale = d3.time.scale.utc()
      .domain(fillEndpoints)
      .range([chart.axisGutter() + chart.dataGutter(), chart.width() - chart.navGutter() - chart.dataGutter()]);

    var smbgTime = new tideline.plot.SMBGTime({emitter: emitter});

    chart.pools().forEach(function(pool, i) {
      var gutter;
      var d = new Date(pool.id().replace('poolBG_', ''));
      var dayOfTheWeek = d.getUTCDay();
      if ((dayOfTheWeek === 0) || (dayOfTheWeek === 6)) {
        gutter = {'top': 1.5, 'bottom': 1.5};
      }
      // on Mondays the bottom gutter should be a weekend gutter
      else if (dayOfTheWeek === 1) {
        gutter = {'top': 0.5, 'bottom': 1.5};
      }
      // on Fridays the top gutter should be a weekend gutter
      else if (dayOfTheWeek === 5) {
        gutter = {'top': 1.5, 'bottom': 0.5};
      }
      else {
        gutter = {'top': 0.5, 'bottom': 0.5};
      }
      pool.addPlotType('fill', fill(pool, {
        endpoints: fillEndpoints,
        xScale: fillScale,
        gutter: gutter,
        dataGutter: chart.dataGutter()
      }), false);
      pool.addPlotType('smbg', smbgTime.draw(pool), true, true);
      pool.render(chart.daysGroup(), chart.dataPerDay[i]);
    });

    chart.poolStats.addPlotType('stats', tideline.plot.stats.widget(chart.poolStats, {
      cbg: cbgUtil,
      bolus: bolusUtil,
      basal: basalUtil,
      xPosition: 0,
      yPosition: chart.poolStats.height() / 10,
      emitter: emitter,
      oneDay: false
    }), false, false);

    chart.poolStats.render(chart.poolGroup());

    chart.navString();

    emitter.on('numbers', function(toggle) {
      if (toggle === 'show') {
        smbgTime.showValues();
      }
      else if (toggle === 'hide') {
        smbgTime.hideValues();
      }
    });

    return chart;
  };

  return create(el, options);
}

module.exports = chartWeeklyFactory;
},{"../js":13,"./watson":4}],3:[function(require,module,exports){
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

var $ = window.$;
var d3 = window.d3;
var _ = window._;

var tideline = require('../js/index');
var TidelineData = tideline.TidelineData;
var chartDailyFactory = require('./chartdailyfactory');
var chartWeeklyFactory = require('./chartweeklyfactory');
var log = window.bows('Example');

// things common to one-day and two-week views
// common event emitter
var EventEmitter = require('events').EventEmitter;
var emitter = new EventEmitter();
emitter.on('navigated', function(navString) {
  if (navString.length === 1) {
    var d = new Date(navString);
    var formatDate = d3.time.format.utc('%A, %B %-d');
    $('#tidelineNavString').html(formatDate(d));
  }
  else {
    var beg = new Date(navString[0]);
    var end = new Date(navString[1]);
    var monthDay = d3.time.format.utc('%B %-d');
    $('#tidelineNavString').html(monthDay(beg) + ' - ' + monthDay(end));
  }
});

emitter.on('mostRecent', function(mostRecent) {
  if (mostRecent) {
    $('#oneDayMostRecent').parent().addClass('active');
  }
  else {
    $('#oneDayMostRecent').parent().removeClass('active');
  }
});

var BasalUtil = tideline.data.BasalUtil;

var el = '#tidelineContainer';
var imagesBaseUrl = '../img';

// dear old Watson
var watson = require('./watson');

var oneDay = chartDailyFactory(el, {imagesBaseUrl: imagesBaseUrl}, emitter).setupPools();

var twoWeek = chartWeeklyFactory(el, {imagesBaseUrl: imagesBaseUrl}, emitter);

// load data and draw charts
d3.json('data/device-data.json', function(data) {
  log('Data loaded.');
  // munge basal segments
  var segments = new tideline.data.SegmentUtil(_.where(data, {'type': 'basal-rate-segment'}));
  data = _.reject(data, function(d) {
    return d.type === 'basal-rate-segment';
  });
  data = data.concat(segments.actual.concat(segments.undelivered));
  // Watson the data
  data = watson.normalize(data);
  // ensure the data is properly sorted
  data = _.sortBy(data, function(d) {
    return new Date(d.normalTime).valueOf();
  });
  var tidelineData = new TidelineData(data);

  data = tidelineData.data;

  log('Initial one-day view.');
  oneDay.load(data).locate('2014-03-06T09:00:00');
  // attach click handlers to set up programmatic pan
  $('#tidelineNavForward').on('click', oneDay.panForward);
  $('#tidelineNavBack').on('click', oneDay.panBack);

  $('#twoWeekView').on('click', function() {
    log('Navigated to two-week view from nav bar.');
    var date = oneDay.getCurrentDay();
    oneDay.clear().hide();
    twoWeek.clear();

    $(this).parent().addClass('active');
    $('#oneDayView').parent().removeClass('active');
    $('.one-day').css('visibility', 'hidden');
    $('.two-week').css('visibility', 'visible');

    $('.tideline-nav').off('click');
    // attach click handlers to set up programmatic pan
    $('#tidelineNavForward').on('click', twoWeek.panForward);
    $('#tidelineNavBack').on('click', twoWeek.panBack);
    
    // takes user to two-week view with day user was viewing in one-day view at the end of the two-week view window
    twoWeek.show().load(data, date);
  });

  $('#oneDayView').on('click', function() {
    log('Navigated to one-day view from nav bar.');
    twoWeek.clear().hide();
    
    $('.tideline-nav').off('click');
    // attach click handlers to set up programmatic pan
    $('#tidelineNavForward').on('click', oneDay.panForward);
    $('#tidelineNavBack').on('click', oneDay.panBack);

    $(this).parent().addClass('active');
    
    $('#twoWeekView').parent().removeClass('active');
    $('.one-day').css('visibility', 'visible');
    $('.two-week').css('visibility', 'hidden');
    
    // takes user to one-day view of most recent data
    oneDay.show().locate();
  });

  $('#oneDayMostRecent').on('click', function() {
    log('Navigated to most recent one-day view.');
    oneDay.clear().locate();

    $(this).parent().addClass('active');

    $('#twoWeekView').parent().removeClass('active');
    $('#oneDayMostRecent').parent().addClass('active');
    $('.one-day').css('visibility', 'visible');
    $('.two-week').css('visibility', 'hidden');
  });

  emitter.on('selectSMBG', function(date) {
    log('Navigated to one-day view from double clicking a two-week view SMBG.');
    twoWeek.clear().hide();
    
    $('.tideline-nav').off('click');
    // attach click handlers to set up programmatic pan
    $('#tidelineNavForward').on('click', oneDay.panForward);
    $('#tidelineNavBack').on('click', oneDay.panBack);

    $('#oneDayView').parent().addClass('active');
    $('#twoWeekView').parent().removeClass('active');
    $('#oneDayMostRecent').parent().removeClass('active');
    $('.one-day').css('visibility', 'visible');
    $('.two-week').css('visibility', 'hidden');

    // takes user to one-day view of date given by the .d3-smbg-time emitter
    oneDay.show().load(data).locate(date);
  });

  $('#showHideNumbers').on('click', function() {
    if ($(this).parent().hasClass('active')) {
      emitter.emit('numbers', 'hide');
      $(this).parent().removeClass('active');
      $(this).html('Show Values');
    }
    else {
      emitter.emit('numbers', 'show');
      $(this).parent().addClass('active');
      $(this).html('Hide Values');
    }
  });
});

},{"../js/index":13,"./chartdailyfactory":1,"./chartweeklyfactory":2,"./watson":4,"events":35}],4:[function(require,module,exports){
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

//
// 'Good old Watson! You are the one fixed point in a changing age.' - Sherlock Holmes, "His Last Bow"
//
// This mini module is for containing anything done to Tidepool data to make it possible to plot timezone-naive
// data reliably and consistently across different browsers and in different timezones. It is named after the
// quotation listed above as well as the fact that Watson is one of literature's ur-examples of the loyal
// assistant.
//
// Try as hard as you can to keep Watson out of library code - i.e., in this repository, Watson should only be a
// requirement in files in the example/ folder (as these are blip-specific), not in the main tideline files:
// one-day.js, two-week.js, and pool.js.
//

var _ = require('lodash');

try {
  var log = window.bows('Watson');
}
catch (ReferenceError) {
  var log = require('../js/lib/').bows('Watson');
}

var APPEND = '.000Z';

var watson = {
  normalize: function(a) {
    log('Watson normalized the data.');
    return _.map(a, function(i) {
      i.normalTime = i.deviceTime + APPEND;
      if (i.utcTime) {
        var d = new Date(i.utcTime);
        var offsetMinutes = d.getTimezoneOffset();
        d.setMinutes(d.getMinutes() - offsetMinutes);
        i.normalTime = d.toISOString();
      }
      else if (i.type === 'basal-rate-segment') {
        i.normalTime = i.start + APPEND;
        if (i.end) {
          i.normalEnd = i.end + APPEND;
        }
        else {
          i.normalEnd = null;
        }
        
      }
      return i;
    });
  },
  print: function(arg, d) {
    console.log(arg, d.toUTCString().replace(' GMT', ''));
    return;
  },
  strip: function(d) {
    return d.toUTCString().replace(' GMT', '');
  }
};

module.exports = watson;
},{"../js/lib/":14,"lodash":34}],5:[function(require,module,exports){
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

var _ = require('../lib/')._;

var format = require('./util/format');
var datetime = require('./util/datetime');

var log = require('../lib/').bows('BasalUtil');

var MS_IN_HOUR = 3600000.0;
var MS_IN_DAY = 86400000;

function BasalUtil(data) {

  this.segmentDose = function(duration, rate) {
    var hours = duration / MS_IN_HOUR;
    return format.fixFloatingPoint(hours * rate);
  };

  this.subtotal = function(endpoints) {
    var dose = 0.0;
    var start = new Date(endpoints.start.datetime), end = new Date(endpoints.end.datetime);
    // handle first segment, which may have started before the start endpoint
    var segment = this.actual[endpoints.start.index];
    dose += this.segmentDose((new Date(segment.normalEnd) - start), segment.value);
    var i = endpoints.start.index + 1;
    while (i < endpoints.end.index) {
      segment = this.actual[i];
      dose += this.segmentDose((new Date(segment.normalEnd) - new Date(segment.normalTime)), segment.value);
      i++;
    }
    segment = this.actual[endpoints.end.index];
    // handle last segment, which may go past the end endpoint
    dose += this.segmentDose((end - new Date(segment.normalTime)), segment.value);
    return format.fixFloatingPoint(dose);
  };

  this.isContinuous = function(s, e) {
    var start = new Date(s), end = new Date(e);
    var startIndex = _.findIndex(this.actual, function(segment) {
        return (new Date(segment.normalTime).valueOf() <= start) && (start <= new Date(segment.normalEnd).valueOf());
      });
    var endIndex = _.findIndex(this.actual, function(segment) {
        return (new Date(segment.normalTime).valueOf() <= end) && (end <= new Date(segment.normalEnd).valueOf());
      });
    if ((startIndex >= 0) && (endIndex >= 0)) {
      var i = startIndex;
      while (i < endIndex) {
        var s1 = this.actual[i], s2 = this.actual[i + 1];
        if (s1.normalEnd !== s2.normalTime) {
          return false;
        }
        i++;
      }
      return {
        'start': {
          'datetime': start.toISOString(),
          'index': startIndex
        },
        'end': {
          'datetime': end.toISOString(),
          'index': endIndex
        }
      };
    }
    else {
      return false;
    }
  };

  this.totalBasal = function(s, e, opts) {
    opts = opts || {};
    if (datetime.verifyEndpoints(s, e, this.endpoints)) {
      if (datetime.isTwentyFourHours(s, e)) {
        var endpoints = this.isContinuous(s, e);
        if (endpoints) {
          return {'total': this.subtotal(endpoints)};
        }
        else {
          log('Basal data within 24 hours starting', new Date(s).toISOString().slice(0,16), 'is not continuous; cannot calculate basal total.');
          return {'total': NaN};
        }
      }
      else if (datetime.isLessThanTwentyFourHours(s, e)) {
        log('Data domain less than twenty-four hours; cannot calculate basal total.');
        return {'total': NaN};
      }
      else {
        var dose = 0.0;
        var excluded = [];
        var start = new Date(s), end = new Date(e);
        var n = datetime.getNumDays(s, e);
        for (var j = 0; j < n; j++) {
          var dayStart = new Date(start);
          var dayEnd = new Date(dayStart);
          dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
          var endpoints = this.isContinuous(dayStart.toISOString(), dayEnd.toISOString());
          if (endpoints && datetime.isTwentyFourHours(dayStart.toISOString(), dayEnd.toISOString())) {
            if (isNaN(this.subtotal(endpoints))) {
              excluded.push(dayStart.toISOString());
            }
            else {
              dose += this.subtotal(endpoints);
            }
          }
          else {
            excluded.push(dayStart.toISOString());
          }
          start.setUTCDate(start.getUTCDate() + 1);
        }
        if (excluded.length <= opts.exclusionThreshold) {
          return {
            'total': dose,
            'excluded': excluded
          };
        }
        else {
          log(excluded.length, 'days excluded. Not enough days with basal data to calculate basal total.');
          return {
            'total': NaN,
            'excluded': excluded
          };
        }
      }
    }
    else {
      return {'total': NaN};
    }
  };

  this.actual = _.where(data, {'vizType': 'actual'});
  this.undelivered = _.where(data, {'vizType': 'undelivered'});

  this.data = data;
  if (this.data.length > 0) {
    this.endpoints = [this.data[0].normalTime, this.data[this.data.length - 1].normalEnd];
  }
}

module.exports = BasalUtil;
},{"../lib/":14,"./util/datetime":10,"./util/format":11}],6:[function(require,module,exports){
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

var _ = require('../lib/')._;

var format = require('./util/format');
var datetime = require('./util/datetime');
var TidelineCrossFilter = require('./util/tidelinecrossfilter');

var log = require('../lib/').bows('BolusUtil');

function BolusUtil(data) {

  this.subtotal = function(s, e) {
    var dose = 0.0;
    var start = new Date(s).valueOf(), end = new Date(e).valueOf();
    dataByDate.filter([start, end]);
    var currentData = filterData.getAll(dataByDate);
    var firstBolus = _.findIndex(currentData, function(bolus) {
      var d = new Date(bolus.normalTime).valueOf();
      return (d >= start) && (d <= end);
    });
    if (firstBolus !== -1) {
      _.forEach(currentData, function(d) {
        dose += d.value;
      });
    }
    return format.fixFloatingPoint(dose);
  };

  this.totalBolus = function(s, e, opts) {
    opts = opts || {};
    if (datetime.verifyEndpoints(s, e, this.endpoints)) {
      var start = new Date(s).valueOf(), end = new Date(e).valueOf();
      var total = 0.0;
      if (datetime.isTwentyFourHours(s, e)) {
        total += this.subtotal(s, e);
      }
      else if (datetime.isLessThanTwentyFourHours(s, e)) {
        log('Data domain less than twenty-four hours; cannot calculate bolus total.');
        return NaN;
      }
      else {
        if ((opts.excluded) && (opts.excluded.length > 0)) {
          var first = new Date(start).toISOString();
          var ex = opts.excluded[0];
          var bolus = this;
          opts.excluded.forEach(function(ex) {
            // exclude boluses that happen to be directly on first timestamp
            if (first !== ex) {
              total += bolus.subtotal(first, ex);
            }
            first = datetime.addDays(ex, 1);
          });
          if (first !== end) {
            total += this.subtotal(first, end);
          }
        }
        else {
          total += this.subtotal(start, end);
        }
      }
      return format.fixFloatingPoint(total);
    }
    else {
      return NaN;
    }
  };

  this.data = data;
  var filterData = new TidelineCrossFilter(data);
  var dataByDate = filterData.addDimension('date');
  if (this.data.length > 0) {
    this.endpoints = [this.data[0].normalTime, this.data[this.data.length - 1].normalTime];
  }
}

module.exports = BolusUtil;
},{"../lib/":14,"./util/datetime":10,"./util/format":11,"./util/tidelinecrossfilter":12}],7:[function(require,module,exports){
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

var _ = require('../lib/')._;

var datetime = require('./util/datetime');
var TidelineCrossFilter = require('./util/tidelinecrossfilter');

var log = require('../lib/').bows('CBGUtil');

function CBGUtil(data) {

  var PERCENT_FOR_COMPLETE = 0.75;
  var MAX_CBG_READINGS_PER_24 = 288;
  var MS_IN_24 = 86400000;
  var currentIndex = 0, currentData;

  var categories = {
    'low': 80,
    'target': 180
  };

  var defaults = {
    'low': 0,
    'target': 0,
    'high': 0,
    'total': 0
  };

  var breakdownNaN = {
    'low': NaN,
    'target': NaN,
    'high': NaN,
    'total': NaN
  };

  function getCategory (n) {
    if (n <= categories.low) {
      return 'low';
    }
    else if ((n > categories.low) && (n <= categories.target)) {
      return 'target';
    }
    else {
      return 'high';
    }
  }

  this.filtered = function(s, e) {
    if (!currentData) {
      currentData = filterData.getAll(dataByDate);
    }
    var start = new Date(s).valueOf(), end = new Date(e).valueOf();
    dataByDate.filter([start, end]);
    var filteredObj = {
      'data': dataByDate.top(Infinity).reverse(),
      'excluded': []
    };
    var filtered = filteredObj.data;
    if (filtered.length < this.threshold(s, e)) {
      filteredObj.excluded.push(new Date(s).toISOString());
      filteredObj.data = [];
      return filteredObj;
    }
    else {
      return filteredObj;
    }
  };

  this.filter = function(s, e, exclusionThreshold) {
    if (datetime.verifyEndpoints(s, e, this.endpoints)) {
      if (datetime.isTwentyFourHours(s, e)) {
        return this.filtered(s, e);
      }
      else if (datetime.isLessThanTwentyFourHours(s, e)) {
        log('Data domain less than twenty-four hours; cannot calculate bolus total.');
        return {'data': [], 'excluded': []};
      }
      else {
        var time = new Date(s).valueOf(), end = new Date(e).valueOf();
        var result = [], excluded = [], next;
        while (time < end) {
          next = new Date(datetime.addDays(time, 1)).valueOf();
          if (datetime.isTwentyFourHours(time, next)) {
            var filtered = this.filtered(time, next);
            result = result.concat(filtered.data);
            excluded = excluded.concat(filtered.excluded);
          }
          time = new Date(next).valueOf();
        }
        if (excluded.length > exclusionThreshold) {
          log(excluded.length, 'days excluded. Not enough CGM data in some days to calculate stats.');
          return {'data': [], 'excluded': excluded};
        }
        else {
          return {'data': result, 'excluded': excluded};
        }
      }
    }
    else {
      log('Endpoint verification failed!');
      return {'data': [], 'excluded': []};
    }
  };

  this.rangeBreakdown = function(filtered) {
    if (filtered.length > 0) {
      var groups = _.countBy(filtered, function(d) {
        return getCategory(d.value);
      });
      var breakdown = _.defaults(groups, defaults);
      breakdown.total = breakdown.low + breakdown.target + breakdown.high;
      return breakdown;
    }
    else {
      return breakdownNaN;
    }
  };

  this.average = function(filtered) {
    if (filtered.length > 0) {
      var sum = _.reduce(filtered, function(memo, d) {
        return memo + d.value;
      }, 0);
      var average = parseInt((sum/filtered.length).toFixed(0), 10);
      return {'value': average, 'category': getCategory(average)};
    }
    else {
      return {'value': NaN, 'category': '', 'excluded': filtered.excluded};
    }
  };

  this.threshold = function(s, e) {
    var difference = new Date(e) - new Date(s);
    return Math.floor(PERCENT_FOR_COMPLETE * (MAX_CBG_READINGS_PER_24 * (difference/MS_IN_24)));
  };

  this.getStats = function(s, e, opts) {
    opts = opts || {};
    var start = new Date(s).valueOf(), end = new Date(e).valueOf();
    dataByDate.filter([start, end]);
    currentData = filterData.getAll(dataByDate);
    var filtered = this.filter(s, e, opts.exclusionThreshold);
    var average = this.average(filtered.data);
    average.excluded = filtered.excluded;
    var breakdown = this.rangeBreakdown(filtered.data);
    breakdown.excluded = filtered.excluded;
    return {
      'average': average,
      'breakdown': breakdown
    };
  };

  this.data = data;
  var filterData = new TidelineCrossFilter(data);
  var dataByDate = filterData.addDimension('date');
  if (this.data.length > 0) {
    this.endpoints = [this.data[0].normalTime, this.data[data.length - 1].normalTime];
  }
}

module.exports = CBGUtil;
},{"../lib/":14,"./util/datetime":10,"./util/tidelinecrossfilter":12}],8:[function(require,module,exports){
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

var _ = require('../lib/')._;

function DeviceUtil(data) {
  this.findLastDatum = function() {
    var included = ['bolus', 'carbs', 'smbg'];
    for (var j = data.length - 1; j > 0; j--) {
      if (included.indexOf(data[j].type) !== -1) {
        return data[j].normalTime;
      }
    }
  };

  this.data = data;
}

module.exports = DeviceUtil;
},{"../lib/":14}],9:[function(require,module,exports){
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

var _ = require('../lib/')._;
var log = require('../lib/').bows('SegmentUtil');

var keysForEquality = ['type', 'deliveryType', 'value', 'deviceId', 'scheduleName', 'source'];

function SegmentUtil(data) {
  var actuals = [];
  var undelivereds = [];
  var overlaps = [];

  function addToActuals(e) {
    actuals.push(_.extend({}, e, {vizType: 'actual'}));
  }

  function addToUndelivered(e) {
    undelivereds.push(_.extend({}, e, {vizType: 'undelivered'}));
    }

  function processElement(e) {
    if (e.deliveryType === 'temp' || e.deliveryType === 'scheduled') {
      if (actuals.length === 0) {
        addToActuals(e);
      } else {
        var lastActual = actuals[actuals.length - 1];
        if (e.start === lastActual.end) {
          if (_.isEqual(_.pick(e, keysForEquality), _.pick(lastActual, keysForEquality))) {
            lastActual.end = e.end;
          } else {
            addToActuals(e);
          }
        } else if (e.start < lastActual.end) {
          // It is overlapping, so let's see how we should deal with it.

          if (e.start < lastActual.start) {
            // The current element is completely newer than the last actual, so we have to rewind a bit.
            var removedActual = actuals.pop();
            processElement(e);
            processElement(removedActual);
          } else if (e.deliveryType === 'temp') {
            // It's a temp, which wins no matter what it was before.
            // Start by setting up shared adjustments to the segments (clone lastActual and reshape it)
            var undeliveredClone = _.clone(lastActual);
            lastActual.end = e.start;

            if (e.end >= undeliveredClone.end) {
              // The temp segment is longer than the current, throw away the rest of the current
              undeliveredClone.start = e.start;
              addToUndelivered(undeliveredClone);
              addToActuals(e);
            } else {
              // The current exceeds the temp, so replace the current "chunk" and re-attach the schedule
              var endingSegment = _.clone(undeliveredClone);
              undeliveredClone.start = e.start;
              undeliveredClone.end = e.end;
              addToUndelivered(undeliveredClone);
              addToActuals(_.clone(e));

              // Re-attach the end of the schedule
              endingSegment.start = e.end;
              addToActuals(endingSegment);
            }
          } else {
            // e.deliveryType === 'scheduled'
            if (lastActual.deliveryType === 'scheduled') {
              // Scheduled overlapping a scheduled, this should not happen.
              overlaps.push([lastActual, e]);
              actuals.pop();
            } else {
              // Scheduled overlapping a temp, this can happen and the schedule should be skipped
              
              var undeliveredClone = _.clone(e);

              if (e.end > lastActual.end) {
                // Scheduled is longer than the temp, so preserve the tail
                var deliveredClone = _.clone(e);
                undeliveredClone.end = lastActual.end;
                deliveredClone.start = lastActual.end;
                addToUndelivered(undeliveredClone);
                addToActuals(deliveredClone);
              } else {
                // Scheduled is shorter than the temp, so completely skip it
                addToUndelivered(undeliveredClone);
              }
            }
          }
        } else {
          // e.start > lastActual.end, this means that we have a gap in the segments, act like this is
          // the first event we saw and keep going.
          addToActuals(e);
        }
      }
    }
  }

  data.forEach(processElement);

  log(overlaps.length, 'instances of scheduled overlapping a scheduled.');
  if (overlaps.length > 0) {
    log('First example', overlaps[0][0], overlaps[0][1]);
  }

  this.actual = actuals;
  this.undelivered = undelivereds;
  this.all = this.actual.concat(this.undelivered);

  return this;
}

module.exports = SegmentUtil;

},{"../lib/":14}],10:[function(require,module,exports){
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

var datetime = {

  MS_IN_24: 86400000,

  addDays: function(s, n) {
    var d = new Date(s);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString();
  },

  adjustToInnerEndpoints: function(s, e, endpoints) {
    if (!endpoints) {
      return null;
    }
    var start = new Date(s).valueOf(), end = new Date(e).valueOf();
    var thisTypeStart = new Date(endpoints[0]).valueOf(), thisTypeEnd = new Date(endpoints[1]).valueOf();
    if (start < thisTypeStart) {
      return [thisTypeStart, end];
    }
    else if (end > thisTypeEnd) {
      return [start, thisTypeEnd];
    }
    else {
      return [start, end];
    }
  },

  checkIfDateInRange: function(s, endpoints) {
    var d = new Date(s);
    var start = new Date(endpoints[0]);
    var end = new Date(endpoints[1]);
    if ((d.valueOf() >= start.valueOf()) && (d.valueOf() <= end.valueOf())) {
      return true;
    }
    else {
      return false;
    }
  },

  checkIfUTCDate: function(s) {
    var d = new Date(s);
    if (typeof s === 'number') {
      if (d.getUTCFullYear() < 2008) {
        return false;
      }
      else {
        return true;
      }
    }
    else if (s.slice(s.length - 1, s.length) !== 'Z') {
      return false;
    }
    else {
      if (s === d.toISOString()) {
        return true;
      }
      else {
        return false;
      }
    }
  },

  getNumDays: function(s, e) {
    var start = new Date(s).valueOf(), end = new Date(e).valueOf();
    return Math.ceil((end - start)/this.MS_IN_24);
  },

  isLessThanTwentyFourHours: function(s, e) {
    var start = new Date(s).valueOf(), end = new Date(e).valueOf();
    if (end - start < this.MS_IN_24) {
      return true;
    }
    else { return false; }
  },

  isTwentyFourHours: function(s, e) {
    var start = new Date(s).valueOf(), end = new Date(e).valueOf();
    if (end - start === this.MS_IN_24) {
      return true;
    }
    else { return false; }
  },

  verifyEndpoints: function(s, e, endpoints) {
    if (!endpoints) {
      return null;
    }
    if (this.checkIfUTCDate(s) && this.checkIfUTCDate(e)) {
      endpoints = this.adjustToInnerEndpoints(s, e, endpoints);
      s = endpoints[0];
      e = endpoints[1];
      if (this.checkIfDateInRange(s, endpoints) && this.checkIfDateInRange(e, endpoints)) {
        return true;
      }
      else {
        return false;
      }
    }
    else {
      return false;
    }
  }


};

module.exports = datetime;
},{}],11:[function(require,module,exports){
var format = {

  fixFloatingPoint: function(n) {
    return parseFloat(n.toFixed(3));
  },

  percentage: function(f) {
    if (isNaN(f)) {
      return '-- %';
    }
    else {
      return parseInt(f.toFixed(2) * 100, 10) + '%';
    }
  }

};

module.exports = format;
},{}],12:[function(require,module,exports){
/* 
 * == BSD2 LICENSE ==
 */

var crossfilter = require('../../lib/').crossfilter;

var log = require('../../lib/').bows('TidelineCrossFilter');

function TidelineCrossFilter(data) {

  this.addDimension = function(key) {
    // define some common dimension accessors for tideline, so we don't have to keep writing the same ones
    var accessor;
    switch(key) {
    case 'date':
      accessor = function(d) { return new Date(d.normalTime).valueOf(); };
    }

    return this.cf.dimension(accessor);
  };

  this.getAll = function(dimension, ascending) {
    // default return ascending sort array
    if (!ascending) {
      return dimension.top(Infinity);
    }
    return dimension.top(Infinity).reverse();
  };

  this.getOne = function(dimension) {
    var res = dimension.top(Infinity);

    if (res.length > 1) {
      return undefined;
    }
    else {
      return res[0];
    }
  };

  this.cf = crossfilter(data);

  return this;
}

module.exports = TidelineCrossFilter;
},{"../../lib/":14}],13:[function(require,module,exports){
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

module.exports = {
  TidelineData: require('./tidelinedata'),
  pool: require('./pool'),
  oneDay: require('./oneday'),
  twoWeek: require('./twoweek'),

  data: {
    BasalUtil: require('./data/basalutil'),
    BolusUtil: require('./data/bolusutil'),
    CBGUtil: require('./data/cbgutil'),
    DeviceUtil: require('./data/deviceutil'),
    SegmentUtil: require('./data/segmentutil'),
    util: {
      datetime: require('./data/util/datetime'),
      format: require('./data/util/format'),
      TidelineCrossFilter: ('./data/util/tidelinecrossfilter')
    }
  },

  lib: require('./lib/index'),

  plot: {
    basal: require('./plot/basal'),
    bolus: require('./plot/bolus'),
    carbs: require('./plot/carbs'),
    cbg: require('./plot/cbg'),
    message: require('./plot/message'),
    SMBGTime: require('./plot/smbgtime'),
    smbg: require('./plot/smbg'),
    stats: {
      puddle: require('./plot/stats/puddle'),
      widget: require('./plot/stats/widget')
    },
    util: {
      fill: require('./plot/util/fill'),
      scales: require('./plot/util/scales'),
      tooltip: require('./plot/util/tooltip')
    }
  }
};

},{"./data/basalutil":5,"./data/bolusutil":6,"./data/cbgutil":7,"./data/deviceutil":8,"./data/segmentutil":9,"./data/util/datetime":10,"./data/util/format":11,"./lib/index":14,"./oneday":15,"./plot/basal":16,"./plot/bolus":17,"./plot/carbs":18,"./plot/cbg":19,"./plot/message":20,"./plot/smbg":21,"./plot/smbgtime":22,"./plot/stats/puddle":23,"./plot/stats/widget":24,"./plot/util/fill":25,"./plot/util/scales":26,"./plot/util/tooltip":27,"./pool":28,"./tidelinedata":29,"./twoweek":30}],14:[function(require,module,exports){
var lib = {};

if (typeof window !== 'undefined') {
  lib._ = window._;
  lib.d3 = window.d3;
  lib.crossfilter = window.crossfilter;
  // only care about not having d3 when running in the browser
  if (!lib.d3) {
    throw new Error('d3.js is a required dependency');
  }
  lib.Duration = window.Duration;
  lib.bows = window.bows;
}
else {
  lib._ = require('lodash');
  lib.Duration = require('duration-js');
  lib.crossfilter = require('crossfilter');
}

if (!lib._) {
  throw new Error('Underscore or Lodash is a required dependency!');
}

if (!lib.bows) {
  // NB: optional dependency
  // return a factory for a log function that does nothing
  lib.bows = function() {
    return function() {};
  };
}

module.exports = lib;
},{"crossfilter":32,"duration-js":33,"lodash":34}],15:[function(require,module,exports){
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

var d3 = require('./lib/').d3;
var _ = require('./lib/')._;

var log = require('./lib/').bows('One Day');

module.exports = function(emitter) {
  // required externals
  var Pool = require('./pool');
  var tooltip = require('./plot/util/tooltip');

  // constants
  var MS_IN_24 = 86400000;

  // basic attributes
  var id = 'tidelineSVGOneDay',
    minWidth = 400, minHeight = 400,
    width = minWidth, height = minHeight,
    imagesBaseUrl = 'img',
    nav = {
      axisHeight: 30,
      scrollNav: true,
      scrollNavHeight: 40,
      scrollThumbRadius: 8,
      currentTranslation: 0
    },
    axisGutter = 40, gutter = 40,
    buffer = 5,
    pools = [], poolGroup,
    xScale = d3.time.scale.utc(), xAxis,
    beginningOfData, endOfData, tidelineData, data, allData = [], endpoints,
    mainGroup,
    scrollNav, scrollHandleTrigger = true, tooltips;

  container.dataFill = {};

  function container(selection) {
    var mainSVG = selection.append('svg');

    mainGroup = mainSVG.append('g').attr('id', 'tidelineMain');

    // update SVG dimenions and ID
    mainSVG.attr({
      'id': id,
      'width': width,
      'height': height
    });

    mainGroup.append('rect')
      .attr({
        'id': 'poolsInvisibleRect',
        'width': width,
        'height': function() {
          if (nav.scrollNav) {
            return (height - nav.scrollNavHeight);
          }
          else {
            return height;
          }
        },
        'opacity': 0.0
      });

    mainGroup.append('g')
      .attr('class', 'd3-x d3-axis')
      .attr('id', 'tidelineXAxis')
      .attr('transform', 'translate(0,' + (nav.axisHeight - 1) + ')');

    poolGroup = mainGroup.append('g').attr('id', 'tidelinePools');

    mainGroup.append('g')
      .attr('id', 'tidelineLabels');

    mainGroup.append('g')
      .attr('id', 'tidelineYAxes')
      .append('rect')
      .attr({
        'id': 'yAxesInvisibleRect',
        'height': function() {
          if (nav.scrollNav) {
            return (height - nav.scrollNavHeight);
          }
          else {
            return height;
          }
        },
        'width': axisGutter,
        'fill': 'white'
      });

    if (nav.scrollNav) {
      scrollNav = mainGroup.append('g')
        .attr('class', 'x scroll')
        .attr('id', 'tidelineScrollNav');
    }
  }

  // non-chainable methods
  container.getData = function(endpoints, direction) {
    if (!arguments.length) {
      endpoints = container.initialEndpoints;
      direction = 'both';
    }

    var start = new Date(endpoints[0]);
    var end = new Date(endpoints[1]);

    container.currentEndpoints = [start, end];

    var readings = _.filter(data, function(datapoint) {
      var t = Date.parse(datapoint.normalTime);
      if (direction === 'both') {
        if ((t >= start) && (t <= end)) {
          return datapoint;
        }
      }
      else if (direction === 'left') {
        if ((t >= start) && (t < end)) {
          return datapoint;
        }
      }
      else if (direction === 'right') {
        if ((t > start) && (t <= end)) {
          return datapoint;
        }
      }
    });

    return readings;
  };

  container.panForward = function() {
    log('Jumped forward a day.');
    nav.currentTranslation -= width - axisGutter;
    mainGroup.transition().duration(500).tween('zoom', function() {
      var ix = d3.interpolate(nav.currentTranslation + width - axisGutter, nav.currentTranslation);
      return function(t) {
        nav.pan.translate([ix(t), 0]);
        nav.pan.event(mainGroup);
      };
    });
  };

  container.panBack = function() {
    log('Jumped back a day.');
    nav.currentTranslation += width - axisGutter;
    mainGroup.transition().duration(500).tween('zoom', function() {
      var ix = d3.interpolate(nav.currentTranslation - width + axisGutter, nav.currentTranslation);
      return function(t) {
        nav.pan.translate([ix(t), 0]);
        nav.pan.event(mainGroup);
      };
    });
  };

  container.newPool = function() {
    var p = new Pool(container);
    pools.push(p);
    return p;
  };

  container.arrangePools = function() {
    var numPools = pools.length;
    var cumWeight = 0;
    pools.forEach(function(pool) {
      cumWeight += pool.weight();
    });
    gutter = 0.25 * (container.height() / cumWeight);
    var totalPoolsHeight =
      container.height() - nav.axisHeight - nav.scrollNavHeight - (numPools - 1) * gutter;
    var poolScaleHeight = totalPoolsHeight/cumWeight;
    var actualPoolsHeight = 0;
    pools.forEach(function(pool) {
      pool.height(poolScaleHeight);
      actualPoolsHeight += pool.height();
    });
    actualPoolsHeight += (numPools - 1) * gutter;
    var currentYPosition = nav.axisHeight;
    pools.forEach(function(pool) {
      pool.yPosition(currentYPosition);
      currentYPosition += pool.height() + gutter;
      pool.group().attr('transform', 'translate(0,' + pool.yPosition() + ')');
    });
  };

  container.getCurrentDomain = function() {
    var currentDomain = xScale.domain();
    var d = new Date(xScale.domain()[0]);
    return {
      'start': new Date(currentDomain[0]),
      'end': new Date(currentDomain[1]),
      'center': new Date(d.setUTCHours(d.getUTCHours() + 12))
    };
  };

  container.navString = function(a) {
    var beginning = a[0];
    var end = a[1];
    var navString;
    if (beginning.getUTCHours() <= 11) {
      navString = beginning.toISOString();
    }
    else {
      navString = end.toISOString();
    }
    if (!d3.select('#' + id).classed('hidden')) {
      emitter.emit('currentDomain', {
        'domain': a,
        'startIndex': allData[0].index
      });
      emitter.emit('navigated', [navString]);
      if (a[1].valueOf() === endpoints[1].valueOf()) {
        emitter.emit('mostRecent', true);
      }
      else {
        emitter.emit('mostRecent', false);
      }
    }
  };

  // getters only
  container.pools = function() {
    return pools;
  };

  container.poolGroup = function() {
    return poolGroup;
  };

  container.id = function() {
    return id;
  };

  container.tooltips = function() {
    return tooltips;
  };

  container.axisGutter = function() {
    return axisGutter;
  };

  // chainable methods
  container.setAxes = function() {
    // set the domain and range for the main tideline x-scale
    xScale.domain([container.initialEndpoints[0], container.initialEndpoints[1]])
      .range([axisGutter, width]);

    var tickFormat = d3.time.format.utc.multi([
      ['%b %-d', function(d) { return d.getUTCHours() === 0; }],
      ['%-I am', function(d) { return d.getUTCHours() < 11; }],
      ['%-I pm', function(d) { return true; }],
    ]);

    xAxis = d3.svg.axis()
      .scale(xScale)
      .orient('top')
      .outerTickSize(0)
      .innerTickSize(15)
      .tickFormat(tickFormat);

    mainGroup.select('#tidelineXAxis').call(xAxis);

    mainGroup.selectAll('#tidelineXAxis g.tick text').style('text-anchor', 'start').attr('transform', 'translate(5,15)');

    if (nav.scrollNav) {
      nav.scrollScale = d3.time.scale.utc()
        .domain([endpoints[0], container.currentEndpoints[0]])
        .range([axisGutter + nav.scrollThumbRadius, width - nav.scrollThumbRadius]);
    }

    pools.forEach(function(pool) {
      pool.xScale(xScale.copy());
    });

    return container;
  };

  container.setNav = function() {
    var maxTranslation = -xScale(endpoints[0]) + axisGutter;
    var minTranslation = -(xScale(endpoints[1])) + width;
    nav.pan = d3.behavior.zoom()
      .scaleExtent([1, 1])
      .x(xScale)
      .on('zoom', function() {
        if ((endOfData - xScale.domain()[1] < MS_IN_24) && !(endOfData.valueOf() === endpoints[1].valueOf())) {
          log('Rendering new data! (right)');
          var plusOne = new Date(container.endOfData());
          plusOne.setDate(plusOne.getDate() + 1);
          var newData = container.getData([endOfData, plusOne], 'right');
          // update endOfData
          if (plusOne <= endpoints[1]) {
            container.endOfData(plusOne);
          }
          else {
            container.endOfData(endpoints[1]);
          }
          container.allData(newData);
          for (var j = 0; j < pools.length; j++) {
            pools[j].render(poolGroup, container.allData());
          }
        }
        if ((xScale.domain()[0] - beginningOfData < MS_IN_24) && !(beginningOfData.valueOf() === endpoints[0].valueOf())) {
          log('Rendering new data! (left)');
          var plusOne = new Date(container.beginningOfData());
          plusOne.setDate(plusOne.getDate() - 1);
          var newData = container.getData([plusOne, beginningOfData], 'left');
          // update beginningOfData
          if (plusOne >= endpoints[0]) {
            container.beginningOfData(plusOne);
          }
          else {
            container.beginningOfData(endpoints[0]);
          }
          container.allData(newData);
          for (var j = 0; j < pools.length; j++) {
            pools[j].render(poolGroup, container.allData());
          }
        }
        var e = d3.event;
        if (e.translate[0] < minTranslation) {
          e.translate[0] = minTranslation;
        }
        else if (e.translate[0] > maxTranslation) {
          e.translate[0] = maxTranslation;
        }
        nav.pan.translate([e.translate[0], 0]);
        for (var i = 0; i < pools.length; i++) {
          pools[i].pan(e);
        }
        mainGroup.select('#tidelineTooltips').attr('transform', 'translate(' + e.translate[0] + ',0)');
        mainGroup.select('.d3-x.d3-axis').call(xAxis);
        mainGroup.selectAll('#tidelineXAxis g.tick text').style('text-anchor', 'start').attr('transform', 'translate(5,15)');
        if (scrollHandleTrigger) {
          mainGroup.select('#scrollThumb').transition().ease('linear').attr('x', function(d) {
            d.x = nav.scrollScale(xScale.domain()[0]);
            return d.x - nav.scrollThumbRadius;
          });
        }
        container.navString(xScale.domain());
      })
      .on('zoomend', function() {
        container.currentTranslation(nav.latestTranslation);
        scrollHandleTrigger = true;
      });

    mainGroup.call(nav.pan);

    return container;
  };

  container.setScrollNav = function() {
    var translationAdjustment = axisGutter;
    scrollNav.selectAll('line').remove();
    scrollNav.attr('transform', 'translate(0,'  + (height - (nav.scrollNavHeight / 2)) + ')')
      .insert('line', '#scrollThumb')
      .attr({
        'x1': nav.scrollScale(endpoints[0]) - nav.scrollThumbRadius,
        'x2': nav.scrollScale(container.initialEndpoints[0]) + nav.scrollThumbRadius,
        'y1': 0,
        'y2': 0
      });

    var dxRightest = nav.scrollScale.range()[1];
    var dxLeftest = nav.scrollScale.range()[0];

    var drag = d3.behavior.drag()
      .origin(function(d) {
        return d;
      })
      .on('dragstart', function() {
        d3.event.sourceEvent.stopPropagation(); // silence the click-and-drag listener
      })
      .on('drag', function(d) {
        d.x += d3.event.dx;
        if (d.x > dxRightest) {
          d.x = dxRightest;
        }
        else if (d.x < dxLeftest) {
          d.x = dxLeftest;
        }
        d3.select(this).attr('x', function(d) { return d.x - nav.scrollThumbRadius; });
        var date = nav.scrollScale.invert(d.x);
        nav.currentTranslation += -xScale(date) + translationAdjustment;
        scrollHandleTrigger = false;
        nav.pan.translate([nav.currentTranslation, 0]);
        nav.pan.event(mainGroup);
      });

    scrollNav.selectAll('image')
      .data([{'x': nav.scrollScale(container.currentEndpoints[0]), 'y': 0}])
      .enter()
      .append('image')
      .attr({
        'xlink:href': imagesBaseUrl + '/ux/scroll_thumb.svg',
        'x': function(d) { return d.x - nav.scrollThumbRadius; },
        'y': -nav.scrollThumbRadius,
        'width': nav.scrollThumbRadius * 2,
        'height': nav.scrollThumbRadius * 2,
        'id': 'scrollThumb'
      })
      .call(drag);

    return container;
  };

  container.setTooltip = function() {
    var tooltipGroup = mainGroup.append('g')
      .attr('id', 'tidelineTooltips');
    tooltips = tooltip(container, tooltipGroup).id(tooltipGroup.attr('id'));
    pools.forEach(function(pool) {
      pool.tooltips(tooltips);
    });
    return container;
  };

  container.setAtDate = function (date) {
    nav.currentTranslation = -xScale(date) + axisGutter;
    nav.pan.translate([nav.currentTranslation, 0]);
    nav.pan.event(mainGroup);

    return container;
  };

  container.stopListening = function() {
    emitter.removeAllListeners('carbTooltipOn')
      .removeAllListeners('carbTooltipOff')
      .removeAllListeners('bolusTooltipOn')
      .removeAllListeners('bolusTooltipOff')
      .removeAllListeners('noCarbTimestamp');

    return container;
  };

  container.clear = function() {
    pools.forEach(function(pool) {
      pool.clear();
    });
    container.currentTranslation(0).latestTranslation(0);
    allData = [];

    return container;
  };

  container.hide = function() {
    d3.select('#' + id).classed('hidden', true);

    return container;
  };

  container.show = function() {
    d3.select('#' + id).classed('hidden', false);

    return container;
  };

  // getters and setters
  container.width = function(x) {
    if (!arguments.length) return width;
    if (x >= minWidth) {
      width = x;
    }
    else {
      width = minWidth;
    }
    return container;
  };

  container.height = function(x) {
    if (!arguments.length) return height;
    var totalHeight = x + nav.axisHeight;
    if (nav.scrollNav) {
      totalHeight += nav.scrollNavHeight;
    }
    if (totalHeight >= minHeight) {
      height = x;
    }
    else {
      height = minHeight;
    }
    return container;
  };

  container.imagesBaseUrl = function(x) {
    if (!arguments.length) return imagesBaseUrl;
    imagesBaseUrl = x;
    return container;
  };

  container.latestTranslation = function(x) {
    if (!arguments.length) return nav.latestTranslation;
    nav.latestTranslation = x;
    return container;
  };

  container.currentTranslation = function(x) {
    if (!arguments.length) return nav.currentTranslation;
    nav.currentTranslation = x;
    return container;
  };

  container.beginningOfData = function(d) {
    if (!arguments.length) return beginningOfData;
    beginningOfData = new Date(d);
    return container;
  };

  container.endOfData = function(d) {
    if (!arguments.length) return endOfData;
    endOfData = new Date(d);
    return container;
  };

  container.buffer = function(x) {
    if (!arguments.length) return buffer;
    buffer = x;
    return container;
  };

  container.data = function(a) {
    if (!arguments.length) return data;

    data = a;

    var first = new Date(a[0].normalTime);
    var last = new Date(a[a.length - 1].normalTime);

    var minusOne = new Date(last);
    minusOne.setDate(minusOne.getDate() - 1);
    container.initialEndpoints = [minusOne, last];
    container.currentEndpoints = container.initialEndpoints;

    container.beginningOfData(minusOne).endOfData(last);

    endpoints = [first, last];
    container.endpoints = endpoints;

    return container;
  };

  container.allData = function(x, a) {
    if (!arguments.length) return allData;
    if (!a) {
      a = xScale.domain();
    }
    allData = allData.concat(x);
    log('Length of allData array is', allData.length);
    var plus = new Date(a[1]);
    plus.setDate(plus.getDate() + container.buffer());
    var minus = new Date(a[0]);
    minus.setDate(minus.getDate() - container.buffer());
    if (beginningOfData < minus) {
      container.beginningOfData(minus);
      allData = _.filter(allData, function(datapoint) {
        var t = Date.parse(datapoint.normalTime);
        if (t >= minus) {
          return t;
        }
      });
    }
    if (endOfData > plus) {
      container.endOfData(plus);
      allData = _.filter(allData, function(datapoint) {
        var t = Date.parse(datapoint.normalTime);
        if (t <= plus) {
          return t;
        }
      });
    }
    allData = _.sortBy(allData, function(d) {
      return new Date(d.normalTime).valueOf();
    });
    allData = _.uniq(allData, true);
    return container;
  };

  return container;
};

},{"./lib/":14,"./plot/util/tooltip":27,"./pool":28}],16:[function(require,module,exports){
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

var d3 = require('../lib/').d3;
var _ = require('../lib/')._;

var Duration = require('../lib/').Duration;
var log = require('../lib/').bows('Basal');

module.exports = function(pool, opts) {

  var QUARTER = ' ¼', HALF = ' ½', THREE_QUARTER = ' ¾', THIRD = ' ⅓', TWO_THIRDS = ' ⅔';

  opts = opts || {};

  var defaults = {
    classes: {
      'reg': {'tooltip': 'basal_tooltip_reg.svg', 'height': 20},
      'temp': {'tooltip': 'basal_tooltip_temp_large.svg', 'height': 40}
    },
    tooltipWidth: 180,
    pathStroke: 1.5,
    opacity: 0.3,
    opacityDelta: 0.1
  };

  _.defaults(opts, defaults);

  function basal(selection) {
    opts.xScale = pool.xScale().copy();
    selection.each(function(currentData) {

      // to prevent blank rectangle at beginning of domain
      var index = opts.data.indexOf(currentData[0]);
      // when near left edge currentData[0] will have index 0, so we don't want to decrement it
      if (index !== 0) {
        index--;
      }
      while ((index >= 0) && (opts.data[index].vizType !== 'actual')) {
        index--;
      }
      // when index === 0 might catch a non-basal
      if (opts.data[index].type === 'basal-rate-segment') {
        currentData.unshift(opts.data[index]);
      }

      var originalLength = currentData.length;

      // remove a basal segment if it has an invalid value attribute
      var removed = [];
      currentData = _.filter(currentData, function(d) {
        if (!(d.value >= 0)) {
          removed.push(d);
        }
        return d.value >= 0;
      });
      if (originalLength !== currentData.length) {
        log(originalLength - currentData.length, 'basal segment(s) removed because of an invalid value attribute.', removed);
        log('Basal/bolus ratio killed due to ^^^');
      }

      var line = d3.svg.line()
        .x(function(d) { return d.x; })
        .y(function(d) { return d.y; })
        .interpolate('step-after');

      var actual = _.where(currentData, {'vizType': 'actual'});
      var undelivered = _.where(opts.data, {'vizType': 'undelivered', 'deliveryType': 'scheduled'});

      // TODO: remove this when we have guaranteed unique IDs for each basal rate segment again
      currentData.forEach(function(d) {
        if ((d._id.search('_actual') === -1) && (d._id.search('_undelivered') === -1)) {
          d._id = d._id + '_' + d.start.replace(/:/g, '') + '_' + d.vizType;
        }
      });

      var rects = d3.select(this)
        .selectAll('g')
        .data(currentData, function(d) {
          return d._id;
        });
      var rectGroups = rects.enter()
        .append('g')
        .attr('class', 'd3-basal-group')
        .attr('id', function(d) {
          return 'basal_group_' + d._id;
        });
      rectGroups.filter(function(d){
        if (d.vizType === 'actual') {
          return d;
        }
      })
        .append('rect')
        .attr({
          'width': function(d) {
            return basal.width(d);
          },
          'height': function(d) {
            var height = pool.height() - opts.yScale(d.value);
            if (height < 0) {
              return 0;
            }
            else {
              return height;
            }
          },
          'x': function(d) {
            return opts.xScale(new Date(d.normalTime));
          },
          'y': function(d) {
            return opts.yScale(d.value);
          },
          'opacity': '0.3',
          'class': function(d) {
            var classes;
            if (d.deliveryType === 'temp') {
              classes = 'd3-basal d3-rect-basal d3-basal-temp';
            }
            else {
              classes = 'd3-basal d3-rect-basal';
            }
            if (d.delivered !== 0) {
              classes += ' d3-rect-basal-nonzero';
            }
            return classes;
          },
          'id': function(d) {
            return 'basal_' + d._id;
          }
        });
      rectGroups.filter(function(d) {
        if (d.deliveryType !== 'temp') {
          return d;
        }
      })
        .append('rect')
        .attr({
          'width': function(d) {
            return basal.width(d);
          },
          'height': pool.height(),
          'x': function(d) {
            return opts.xScale(new Date(d.normalTime));
          },
          'y': function(d) {
            return opts.yScale.range()[1];
          },
          'class': function(d) {
            if (d.vizType === 'undelivered') {
              return 'd3-basal d3-basal-invisible d3-basal-temp';
            }
            else {
              return 'd3-basal d3-basal-invisible';
            }
          },
          'id': function(d) {
            return 'basal_invisible_' + d._id;
          }
        });
      rectGroups.filter(function(d) {
          if (d.delivered !== 0) {
            return d;
          }
        })
        .selectAll('.d3-basal-invisible')
        .classed('d3-basal-nonzero', true);
      rects.exit().remove();

      var basalGroup = d3.select(this);

      var actualPaths = [[]], actualPathsIndex = 0;

      var pushPoints = function(d, actualPathsIndex) {
        actualPaths[actualPathsIndex].push({
          'x': opts.xScale(new Date(d.normalTime)),
          'y': opts.yScale(d.value) - opts.pathStroke / 2
        },
        {
          'x': opts.xScale(new Date(d.normalEnd)),
          'y': opts.yScale(d.value) - opts.pathStroke / 2
        });
      };

      _.map(actual, function(d, i, segments) {
        // if the segment is any one but the last
        // current segment's normalEnd should === next segment's normalTime
        if ((i < actual.length - 1) && (d.normalEnd === segments[i + 1].normalTime)) {
          pushPoints(d, actualPathsIndex);
        }
        else {
          pushPoints(d, actualPathsIndex);
          actualPaths.push([]);
          actualPathsIndex += 1;
        }
      });

      d3.selectAll('.d3-path-basal').remove();
      // don't draw an actual path if you've removed any segments for having an invalid value attribute
      if (originalLength === currentData.length) {
        actualPaths.forEach(function(path) {
          d3.select(this).append('path')
            .attr({
            'd': line(path),
            'class': 'd3-basal d3-path-basal'
          });
        }, this);
      }
      else {
        log('Not drawing actual basal path because there were one or more basal segments with an invalid value attribute.');
      }

      if (undelivered.length !== 0) {
        var undeliveredSequences = [];
        var contiguous = [];
        undelivered.forEach(function(segment, i, segments) {
          if ((i < (segments.length - 1)) && (segment.end === segments[i + 1].start)) {
            segment.contiguousWith = 'next';
          }
          else if ((i !== 0) && (segments[i - 1].end === segment.start)) {
            segment.contiguousWith = 'previous';
          }
          else {
            segment.contiguousWith = 'none';
            undeliveredSequences.push([segment]);
          }
        });
        undelivered = undelivered.reverse();

        var anchors = _.where(undelivered, {'contiguousWith': 'previous'});

        anchors.forEach(function(anchor) {
          var index = undelivered.indexOf(anchor);
          contiguous.push(undelivered[index]);
          index++;
          while (undelivered[index].contiguousWith === 'next') {
            contiguous.push(undelivered[index]);
            index++;
            if (index > (undelivered.length - 1)) {
              break;
            }
          }
          undeliveredSequences.push(contiguous);
          contiguous = [];
        });

        undeliveredSequences.forEach(function(seq) {
          seq = seq.reverse();
          var pathPoints = _.map(seq, function(segment) {
            return [{
              'x': opts.xScale(new Date(segment.normalTime)),
              'y': opts.yScale(segment.value)
            },
            {
              'x': opts.xScale(new Date(segment.normalEnd)),
              'y': opts.yScale(segment.value)
            }];
          });
          pathPoints = _.flatten(pathPoints);
          pathPoints = _.uniq(pathPoints, function(point) {
            return JSON.stringify(point);
          });

          basalGroup.append('path')
            .attr({
              'd': line(pathPoints),
              'class': 'd3-basal d3-path-basal d3-path-basal-undelivered'
            });
        });

        basal.linkTemp(_.where(actual, {'deliveryType': 'temp'}), undelivered);
      }

      // tooltips
      // only try to make tooltips if we're not excluding any segments due to invalid value attribute
      if (originalLength === currentData.length) {
        d3.selectAll('.d3-basal-invisible').on('mouseover', function() {
          var invisiRect = d3.select(this);
          var id = invisiRect.attr('id').replace('basal_invisible_', '');
          var d = d3.select('#basal_group_' + id).datum();
          if (invisiRect.classed('d3-basal-temp')) {
            var tempD = _.clone(_.findWhere(actual, {'deliveryType': 'temp', '_id': d.link.replace('link_', '')}));
            tempD._id = d._id;
            basal.addTooltip(tempD, 'temp', d);
          }
          else {
            basal.addTooltip(d, 'reg');
          }
          if (invisiRect.classed('d3-basal-nonzero')) {
            if (invisiRect.classed('d3-basal-temp')) {
              d3.select('#basal_' + d.link.replace('link_', '')).attr('opacity', opts.opacity + opts.opacityDelta);
            }
            else {
              d3.select('#basal_' + id).attr('opacity', opts.opacity + opts.opacityDelta);
            }
          }
        });
        d3.selectAll('.d3-basal-invisible').on('mouseout', function() {
          var invisiRect = d3.select(this);
          var id = invisiRect.attr('id').replace('basal_invisible_', '');
          var d = d3.select('#basal_group_' + id).datum();
          d3.select('#tooltip_' + id).remove();
          if (invisiRect.classed('d3-basal-temp')) {
            d3.select('#basal_' + d.link.replace('link_', '')).attr('opacity', opts.opacity);
          }
          else {
            d3.select('#basal_' + id).attr('opacity', opts.opacity);
          }
        });
      }
      else {
        log('Tooltips suppressed because segment(s) with invalid value attribute present.');
      }
    });
  }

  basal.linkTemp = function(toLink, referenceArray) {
    referenceArray = referenceArray.slice(0);
    referenceArray = _.sortBy(referenceArray, function(segment) {
      return Date.parse(segment.normalTime);
    });
    toLink.forEach(function(segment, i, segments) {
      var start = _.findWhere(referenceArray, {'normalTime': segment.normalTime});
      if (start === undefined) {
        log(segment, referenceArray);
      }
      var startIndex = referenceArray.indexOf(start);
      if ((startIndex < (referenceArray.length - 1)) && (start.end === referenceArray[startIndex + 1].start)) {
        var end = _.findWhere(referenceArray, {'normalEnd': segment.normalEnd});
        var endIndex = referenceArray.indexOf(end);
        var index = startIndex;
        while (index <= endIndex) {
          referenceArray[index].link = 'link_' + segment._id;
          index++;
        }
      }
      else {
        referenceArray[startIndex].link = 'link_' + segment._id;
      }
    });
  };

  basal.timespan = function(d) {
    var start = Date.parse(d.normalTime);
    var end = Date.parse(d.normalEnd);
    var diff = end - start;
    var dur = Duration.parse(diff + 'ms');
    var hours = dur.hours();
    var minutes = dur.minutes() - (hours * 60);
    if (hours !== 0) {
      if (hours === 1) {
        switch(minutes) {
        case 0:
          return 'over ' + hours + ' hr';
        case 15:
          return 'over ' + hours + QUARTER + ' hr';
        case 20:
          return 'over ' + hours + THIRD + ' hr';
        case 30:
          return 'over ' + hours + HALF + ' hr';
        case 40:
          return 'over ' + hours + TWO_THIRDS + ' hr';
        case 45:
          return 'over ' + hours + THREE_QUARTER + ' hr';
        default:
          return 'over ' + hours + ' hr ' + minutes + ' min';
        }
      }
      else {
        switch(minutes) {
        case 0:
          return 'over ' + hours + ' hrs';
        case 15:
          return 'over ' + hours + QUARTER + ' hrs';
        case 20:
          return 'over ' + hours + THIRD + ' hrs';
        case 30:
          return 'over ' + hours + HALF + ' hrs';
        case 40:
          return 'over ' + hours + TWO_THIRDS + ' hrs';
        case 45:
          return 'over ' + hours + THREE_QUARTER + ' hrs';
        default:
          return 'over ' + hours + ' hrs ' + minutes + ' min';
        }
      }
    }
    else {
      return 'over ' + minutes + ' min';
    }
  };

  basal.width = function(d) {
    return opts.xScale(new Date(d.normalEnd)) - opts.xScale(new Date(d.normalTime));
  };

  basal.addTooltip = function(d, category, unD) {
    var tooltipHeight = opts.classes[category].height;

    // TODO: if we decide to keep same formatValue for basal and bolus, factor this out into a util/ module
    var formatValue = function(x) {
      var formatted = d3.format('.3f')(x);
      // remove zero-padding on the right
      while (formatted[formatted.length - 1] === '0') {
        formatted = formatted.slice(0, formatted.length - 1);
      }
      if (formatted[formatted.length - 1] === '.') {
        formatted = formatted + '0';
      }
      return formatted;
    };

    d3.select('#' + 'tidelineTooltips_basal')
      .call(pool.tooltips(),
        d,
        // tooltipXPos
        opts.xScale(Date.parse(d.normalTime)),
        'basal',
        // timestamp
        false,
        opts.classes[category].tooltip,
        opts.tooltipWidth,
        tooltipHeight,
        // imageX
        opts.xScale(Date.parse(d.normalTime)) - opts.tooltipWidth / 2 + basal.width(d) / 2,
        // imageY
        function() {
          var y = opts.yScale(d.value) - tooltipHeight * 2;
          if (y < 0) {
            return 0;
          }
          else {
            return y;
          }
        },
        // textX
        opts.xScale(Date.parse(d.normalTime)) + basal.width(d) / 2,
        // textY
        function() {
          var y = opts.yScale(d.value) - tooltipHeight * 2;
          if (category === 'temp') {
            if (y < 0) {
              return tooltipHeight * (3 / 10);
            }
            else {
              return opts.yScale(d.value) - tooltipHeight * 1.7;
            }
          }
          else {
            if (y < 0) {
              return tooltipHeight / 2;
            }
            else {
              return opts.yScale(d.value) - tooltipHeight * 1.5;
            }
          }
        },
        // customText
        (function() {
          if (d.value === 0) {
            return '0.0U';
          }
          else {
            return formatValue(d.value) + 'U';
          }
        }()),
        // tspan
        basal.timespan(d));
    if (category === 'temp') {
      d3.select('#tooltip_' + d._id).select('.d3-tooltip-text-group').append('text')
        .attr({
          'class': 'd3-tooltip-text d3-basal',
          'x': opts.xScale(Date.parse(d.normalTime)) + basal.width(d) / 2,
          'y': function() {
            var y = opts.yScale(d.value) - tooltipHeight * 2;
            if (y < 0) {
              return tooltipHeight * (7 / 10);
            }
            else {
              return opts.yScale(d.value) - tooltipHeight * 1.3;
            }
          }
        })
        .append('tspan')
        .text('(' + formatValue(unD.value) + 'U scheduled)');
    }
  };

  return basal;
};

},{"../lib/":14}],17:[function(require,module,exports){
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

var d3 = require('../lib/').d3;
var _ = require('../lib/')._;

var Duration = require('../lib/').Duration;
var log = require('../lib/').bows('Bolus');

module.exports = function(pool, opts) {

  var QUARTER = ' ¼', HALF = ' ½', THREE_QUARTER = ' ¾', THIRD = ' ⅓', TWO_THIRDS = ' ⅔';

  var MS_IN_ONE = 60000;

  opts = opts || {};

  var defaults = {
    classes: {
      'unspecial': {'tooltip': 'tooltip_bolus_small.svg', 'width': 70, 'height': 24},
      'two-line': {'tooltip': 'tooltip_bolus_large.svg', 'width': 98, 'height': 39},
      'three-line': {'tooltip': 'tooltip_bolus_extralarge.svg', 'width': 98, 'height': 58}
    },
    width: 12,
    bolusStroke: 2,
    triangleSize: 6,
    carbTooltipCatcher: 5
  };

  _.defaults(opts, defaults);

  var carbTooltipBuffer = opts.carbTooltipCatcher * MS_IN_ONE;

  // catch bolus tooltips events
  opts.emitter.on('carbTooltipOn', function(t) {
    var b = _.find(opts.data, function(d) {
      var bolusT = Date.parse(d.normalTime);
      if (bolusT >= (t - carbTooltipBuffer) && (bolusT <= (t + carbTooltipBuffer))) {
        return d;
      }
    });
    if (b) {
      bolus.addTooltip(b, bolus.getTooltipCategory(b));
      opts.emitter.emit('noCarbTimestamp', true);
    }
  });
  opts.emitter.on('carbTooltipOff', function(t) {
    var b = _.find(opts.data, function(d) {
      var bolusT = Date.parse(d.normalTime);
      if (bolusT >= (t - carbTooltipBuffer) && (bolusT <= (t + carbTooltipBuffer))) {
        return d;
      }
    });
    if (b) {
      d3.select('#tooltip_' + b._id).remove();
      opts.emitter.emit('noCarbTimestamp', false);
    }
  });

  function bolus(selection) {
    opts.xScale = pool.xScale().copy();
    selection.each(function(currentData) {
      var boluses = d3.select(this)
        .selectAll('g')
        .data(currentData, function(d) {
          return d._id;
        });
      var bolusGroups = boluses.enter()
        .append('g')
        .attr({
          'class': 'd3-bolus-group'
        });
      var top = opts.yScale.range()[0];
      // boluses where delivered = recommended
      bolusGroups.append('rect')
        .attr({
          'x': function(d) {
            return bolus.x(d);
          },
          'y': function(d) {
            return opts.yScale(d.value);
          },
          'width': opts.width,
          'height': function(d) {
            return top - opts.yScale(d.value);
          },
          'class': 'd3-rect-bolus d3-bolus',
          'id': function(d) {
            return 'bolus_' + d._id;
          }
        });
      // boluses where recommendation and delivery differ
      var bottom = top - opts.bolusStroke / 2;
      // boluses where recommended > delivered
      var underride = bolusGroups.filter(function(d) {
        if (d.recommended > d.value) {
          return d;
        }
      });
      underride.append('rect')
        .attr({
          'x': function(d) {
            return bolus.x(d);
          },
          'y': function(d) {
            return opts.yScale(d.recommended);
          },
          'width': opts.width,
          'height': function(d) {
            return opts.yScale(d.value) - opts.yScale(d.recommended);
          },
          'class': 'd3-rect-recommended d3-bolus',
          'id': function(d) {
            return 'bolus_' + d._id;
          }
        });
      // boluses where delivered > recommended
      var override = bolusGroups.filter(function(d) {
        if (d.value > d.recommended) {
          return d;
        }
      });
      override.append('rect')
        .attr({
          'x': function(d) {
            return bolus.x(d);
          },
          'y': function(d) {
            return opts.yScale(d.recommended);
          },
          'width': opts.width,
          'height': function(d) {
            return top - opts.yScale(d.recommended);
          },
          'stroke-width': opts.bolusStroke,
          'class': 'd3-rect-recommended d3-bolus',
          'id': function(d) {
            return 'bolus_' + d._id;
          }
        });
      override.append('path')
        .attr({
          'd': function(d) {
            var leftEdge = bolus.x(d) + opts.bolusStroke / 2;
            var rightEdge = leftEdge + opts.width - opts.bolusStroke;
            var bolusHeight = opts.yScale(d.value) + opts.bolusStroke / 2;
            return 'M' + leftEdge + ' ' + bottom + 'L' + rightEdge + ' ' + bottom + 'L' + rightEdge + ' ' + bolusHeight + 'L' + leftEdge + ' ' + bolusHeight + 'Z';
          },
          'stroke-width': opts.bolusStroke,
          'class': 'd3-path-bolus d3-bolus',
          'id': function(d) {
            return 'bolus_' + d._id;
          }
        });
      // square- and dual-wave boluses
      var extendedBoluses = bolusGroups.filter(function(d) {
        if (d.extended) {
          return d;
        }
      });
      extendedBoluses.append('path')
        .attr({
          'd': function(d) {
            var rightEdge = bolus.x(d) + opts.width;
            var doseHeight = opts.yScale(d.extendedDelivery) + opts.bolusStroke / 2;
            var doseEnd = opts.xScale(Date.parse(d.normalTime) + d.duration) - opts.triangleSize / 2;
            return 'M' + rightEdge + ' ' + doseHeight + 'L' + doseEnd + ' ' + doseHeight;
          },
          'stroke-width': opts.bolusStroke,
          'class': 'd3-path-extended d3-bolus',
          'id': function(d) {
            return 'bolus_' + d._id;
          }
        });
      extendedBoluses.append('path')
        .attr({
          'd': function(d) {
            var doseHeight = opts.yScale(d.extendedDelivery) + opts.bolusStroke / 2;
            var doseEnd = opts.xScale(Date.parse(d.normalTime) + d.duration) - opts.triangleSize;
            return bolus.triangle(doseEnd, doseHeight);
          },
          'stroke-width': opts.bolusStroke,
          'class': 'd3-path-extended-triangle d3-bolus',
          'id': function(d) {
            return 'bolus_' + d._id;
          }
        });
      boluses.exit().remove();

      // tooltips
      d3.selectAll('.d3-rect-bolus, .d3-rect-recommended').on('mouseover', function() {
        var d = d3.select(this).datum();
        var t = Date.parse(d.normalTime);
        bolus.addTooltip(d, bolus.getTooltipCategory(d));
        opts.emitter.emit('bolusTooltipOn', t);
      });
      d3.selectAll('.d3-rect-bolus, .d3-rect-recommended').on('mouseout', function() {
        var d = _.clone(d3.select(this).datum());
        var t = Date.parse(d.normalTime);
        d3.select('#tooltip_' + d._id).remove();
        opts.emitter.emit('bolusTooltipOff', t);
      });
    });
  }

  bolus.getTooltipCategory = function(d) {
    var category;
    // when there's no 'recommended' field
    if (d.recommended == null) {
      if (d.extended == null) {
        category = 'unspecial';
      }
      else {
        category = 'two-line';
      }
    }
    else {
      if ((d.extended == null) && (d.recommended === d.value)) {
        category = 'unspecial';
      }
      else if ((d.extended == null) && (d.recommended !== d.value)) {
        category = 'two-line';
      }
      else if ((d.recommended === d.value) && (d.extended != null)) {
        category = 'two-line';
      }
      else if ((d.recommended !== d.value) && (d.extended != null)) {
        category = 'three-line';
      }
    }
    return category;
  };

  bolus.addTooltip = function(d, category) {
    var tooltipWidth = opts.classes[category].width;
    var tooltipHeight = opts.classes[category].height;
    
    // TODO: if we decide to keep same formatValue for basal and bolus, factor this out into a util/ module
    var formatValue = function(x) {
      var formatted = d3.format('.3f')(x);
      // remove zero-padding on the right
      while (formatted[formatted.length - 1] === '0') {
        formatted = formatted.slice(0, formatted.length - 1);
      }
      if (formatted[formatted.length - 1] === '.') {
        formatted = formatted + '0';
      }
      return formatted;
    };

    d3.select('#' + 'tidelineTooltips_bolus')
      .call(pool.tooltips(),
        d,
        // tooltipXPos
        opts.xScale(Date.parse(d.normalTime)),
        'bolus',
        // timestamp
        true,
        opts.classes[category].tooltip,
        tooltipWidth,
        tooltipHeight,
        // imageX
        opts.xScale(Date.parse(d.normalTime)),
        // imageY
        function() {
          return pool.height() - tooltipHeight;
        },
        // textX
        opts.xScale(Date.parse(d.normalTime)) + tooltipWidth / 2,
        // textY
        function() {
          if (category === 'unspecial') {
            return pool.height() - tooltipHeight * (9/16);
          }
          else if (category === 'two-line') {
            return pool.height() - tooltipHeight * (3/4);
          }
          else if (category === 'three-line') {
            return pool.height() - tooltipHeight * (13/16);
          }
          else {
            return pool.height() - tooltipHeight;
          }
          
        },
        // customText
        (function() {
          return formatValue(d.value) + 'U';
        }()),
        // tspan
        (function() {
          if (d.extended) {
            return ' total';
          }
        }())
      );

    if (category === 'two-line') {
      d3.select('#tooltip_' + d._id).select('.d3-tooltip-text-group').append('text')
        .attr({
          'class': 'd3-tooltip-text d3-bolus',
          'x': opts.xScale(Date.parse(d.normalTime)) + tooltipWidth / 2,
          'y': pool.height() - tooltipHeight / 3
        })
        .append('tspan')
        .text(function() {
          if ((d.recommended != null) && (d.recommended !== d.value)) {
            return formatValue(d.recommended) + "U recom'd";
          }
          else if (d.extended != null) {
            return formatValue(d.extendedDelivery) + 'U ' + bolus.timespan(d);
          }
        })
        .attr('class', 'd3-bolus');
    }
    else if (category === 'three-line') {
      d3.select('#tooltip_' + d._id).select('.d3-tooltip-text-group').append('text')
        .attr({
          'class': 'd3-tooltip-text d3-bolus',
          'x': opts.xScale(Date.parse(d.normalTime)) + tooltipWidth / 2,
          'y': pool.height() - tooltipHeight / 2
        })
        .append('tspan')
        .text(function() {
          return formatValue(d.recommended) + "U recom'd";
        })
        .attr('class', 'd3-bolus');

      d3.select('#tooltip_' + d._id).select('.d3-tooltip-text-group').append('text')
        .attr({
          'class': 'd3-tooltip-text d3-bolus',
          'x': opts.xScale(Date.parse(d.normalTime)) + tooltipWidth / 2,
          'y': pool.height() - tooltipHeight / 4
        })
        .append('tspan')
        .text(function() {
          return formatValue(d.extendedDelivery) + 'U ' + bolus.timespan(d);
        })
        .attr('class', 'd3-bolus');
    }
  };

  bolus.timespan = function(d) {
    var dur = Duration.parse(d.duration + 'ms');
    var hours = dur.hours();
    var minutes = dur.minutes() - (hours * 60);
    if (hours !== 0) {
      if (hours === 1) {
        switch(minutes) {
        case 0:
          return 'over ' + hours + ' hr';
        case 15:
          return 'over ' + hours + QUARTER + ' hr';
        case 20:
          return 'over ' + hours + THIRD + ' hr';
        case 30:
          return 'over ' + hours + HALF + ' hr';
        case 40:
          return 'over ' + hours + TWO_THIRDS + ' hr';
        case 45:
          return 'over ' + hours + THREE_QUARTER + ' hr';
        default:
          return 'over ' + hours + ' hr ' + minutes + ' min';
        }
      }
      else {
        switch(minutes) {
        case 0:
          return 'over ' + hours + ' hrs';
        case 15:
          return 'over ' + hours + QUARTER + ' hrs';
        case 20:
          return 'over ' + hours + THIRD + ' hrs';
        case 30:
          return 'over ' + hours + HALF + ' hrs';
        case 40:
          return 'over ' + hours + TWO_THIRDS + ' hrs';
        case 45:
          return 'over ' + hours + THREE_QUARTER + ' hrs';
        default:
          return 'over ' + hours + ' hrs ' + minutes + ' min';
        }
      }
    }
    else {
      return 'over ' + minutes + ' min';
    }
  };
  
  bolus.x = function(d) {
    return opts.xScale(Date.parse(d.normalTime)) - opts.width/2;
  };

  bolus.triangle = function(x, y) {
    var top = (x + opts.triangleSize) + ' ' + (y + opts.triangleSize/2);
    var bottom = (x + opts.triangleSize) + ' ' + (y - opts.triangleSize/2);
    var point = x + ' ' + y;
    return 'M' + top + 'L' + bottom + 'L' + point + 'Z';
  };

  return bolus;
};

},{"../lib/":14}],18:[function(require,module,exports){
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

var d3 = require('../lib/').d3;
var _ = require('../lib/')._;

var log = require('../lib/').bows('Carbs');

module.exports = function(pool, opts) {

  var MS_IN_ONE = 60000;

  opts = opts || {};

  var defaults = {
    width: 12,
    tooltipHeight: 24,
    tooltipWidth: 70,
    bolusTooltipCatcher: 5,
    tooltipTimestamp: true
  };

  _.defaults(opts, defaults);

  var bolusTooltipBuffer = opts.bolusTooltipCatcher * MS_IN_ONE;

  // catch bolus tooltips events
  opts.emitter.on('bolusTooltipOn', function(t) {
    var c = _.find(opts.data, function(d) {
      var carbT = Date.parse(d.normalTime);
      if (carbT >= (t - bolusTooltipBuffer) && (carbT <= (t + bolusTooltipBuffer))) {
        return d;
      }
    });
    if (c) {
      carbs.addTooltip(c, false);
    }
  });
  opts.emitter.on('bolusTooltipOff', function(t) {
    var c = _.find(opts.data, function(d) {
      var carbT = Date.parse(d.normalTime);
      if (carbT >= (t - bolusTooltipBuffer) && (carbT <= (t + bolusTooltipBuffer))) {
        return d;
      }
    });
    if (c) {
      d3.select('#tooltip_' + c._id).remove();
    }
  });

  opts.emitter.on('noCarbTimestamp', function(bool) {
    if (bool) {
      opts.tooltipTimestamp = false;
    }
    else {
      opts.tooltipTimestamp = true;
    }
  });

  function carbs(selection) {
    opts.xScale = pool.xScale().copy();
    selection.each(function(currentData) {
      var rects = d3.select(this)
        .selectAll('rect')
        .data(currentData, function(d) {
          return d._id;
        });
      rects.enter()
        .append('rect')
        .attr({
          'x': function(d) {
            return opts.xScale(Date.parse(d.normalTime)) - opts.width/2;
          },
          'y': 0,
          'width': opts.width,
          'height': function(d) {
            return opts.yScale(d.value);
          },
          'class': 'd3-rect-carbs d3-carbs',
          'id': function(d) {
            return 'carbs_' + d._id;
          }
        });
      rects.exit().remove();

      // tooltips
      d3.selectAll('.d3-rect-carbs').on('mouseover', function() {
        var d = d3.select(this).datum();
        var t = Date.parse(d.normalTime);
        opts.emitter.emit('carbTooltipOn', t);
        carbs.addTooltip(d, opts.tooltipTimestamp);
      });
      d3.selectAll('.d3-rect-carbs').on('mouseout', function() {
        var d = d3.select(this).datum();
        var t = Date.parse(d.normalTime);
        d3.select('#tooltip_' + d._id).remove();
        opts.emitter.emit('carbTooltipOff', t);
      });
    });
  }

  carbs.addTooltip = function(d, category) {
    d3.select('#' + 'tidelineTooltips_carbs')
      .call(pool.tooltips(),
        d,
        // tooltipXPos
        opts.xScale(Date.parse(d.normalTime)),
        'carbs',
        // timestamp
        category,
        'tooltip_carbs.svg',
        opts.tooltipWidth,
        opts.tooltipHeight,
        // imageX
        opts.xScale(Date.parse(d.normalTime)),
        // imageY
        function() {
          if (category) {
            return opts.yScale(d.value);
          }
          else {
            return opts.yScale.range()[0];
          }
        },
        // textX
        opts.xScale(Date.parse(d.normalTime)) + opts.tooltipWidth / 2,
        // textY
        function() {
          if (category) {
            return opts.yScale(d.value) + opts.tooltipHeight / 2;
          }
          else {
            return opts.tooltipHeight / 2;
          }
        },
        // customText
        d.value + 'g');
  };

  return carbs;
};
},{"../lib/":14}],19:[function(require,module,exports){
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

var d3 = require('../lib/').d3;
var _ = require('../lib/')._;

var log = require('../lib/').bows('CBG');

module.exports = function(pool, opts) {

  opts = opts || {};

  var defaults = {
    classes: {
      'low': {'boundary': 80, 'tooltip': 'cbg_tooltip_low.svg'},
      'target': {'boundary': 180, 'tooltip': 'cbg_tooltip_target.svg'},
      'high': {'boundary': 200, 'tooltip': 'cbg_tooltip_high.svg'}
    },
    tooltipSize: 24
  };

  _.defaults(opts, defaults);

  function cbg(selection) {
    opts.xScale = pool.xScale().copy();
    selection.each(function(currentData) {
      var allCBG = d3.select(this).selectAll('circle')
        .data(currentData, function(d) {
          return d._id;
        });
      var cbgGroups = allCBG.enter()
        .append('circle')
        .attr('class', 'd3-cbg');
      var cbgLow = cbgGroups.filter(function(d) {
        if (d.value <= opts.classes.low.boundary) {
          return d;
        }
      });
      var cbgTarget = cbgGroups.filter(function(d) {
        if ((d.value > opts.classes.low.boundary) && (d.value <= opts.classes.target.boundary)) {
          return d;
        }
      });
      var cbgHigh = cbgGroups.filter(function(d) {
        if (d.value > opts.classes.target.boundary) {
          return d;
        }
      });
      cbgLow.attr({
          'cx': function(d) {
            return opts.xScale(Date.parse(d.normalTime));
          },
          'cy': function(d) {
            return opts.yScale(d.value);
          },
          'r': 2.5,
          'id': function(d) {
            return 'cbg_' + d._id;
          }
        })
        .datum(function(d) {
          return d;
        })
        .classed({'d3-circle-cbg': true, 'd3-bg-low': true});
      cbgTarget.attr({
          'cx': function(d) {
            return opts.xScale(Date.parse(d.normalTime));
          },
          'cy': function(d) {
            return opts.yScale(d.value);
          },
          'r': 2.5,
          'id': function(d) {
            return 'cbg_' + d._id;
          }
        })
        .classed({'d3-circle-cbg': true, 'd3-bg-target': true});
      cbgHigh.attr({
          'cx': function(d) {
            return opts.xScale(Date.parse(d.normalTime));
          },
          'cy': function(d) {
            return opts.yScale(d.value);
          },
          'r': 2.5,
          'id': function(d) {
            return 'cbg_' + d._id;
          }
        })
        .classed({'d3-circle-cbg': true, 'd3-bg-high': true});
      allCBG.exit().remove();

      // tooltips
      d3.selectAll('.d3-circle-cbg').on('mouseover', function() {
        if (d3.select(this).classed('d3-bg-low')) {
          cbg.addTooltip(d3.select(this).datum(), 'low');
        }
        else if (d3.select(this).classed('d3-bg-target')) {
          cbg.addTooltip(d3.select(this).datum(), 'target');
        }
        else {
          cbg.addTooltip(d3.select(this).datum(), 'high');
        }
      });
      d3.selectAll('.d3-circle-cbg').on('mouseout', function() {
        var id = d3.select(this).attr('id').replace('cbg_', 'tooltip_');
        d3.select('#' + id).remove();
      });
    });
  }

  cbg.addTooltip = function(d, category) {
    d3.select('#' + 'tidelineTooltips_cbg')
      .call(pool.tooltips(),
        d,
        // tooltipXPos
        opts.xScale(Date.parse(d.normalTime)),
        'cbg',
        // timestamp
        false,
        opts.classes[category].tooltip,
        opts.tooltipSize,
        opts.tooltipSize,
        // imageX
        opts.xScale(Date.parse(d.normalTime)),
        // imageY
        function() {
          if ((category === 'low') || (category === 'target')) {
            return opts.yScale(d.value) - opts.tooltipSize;
          }
          else {
            return opts.yScale(d.value);
          }
        },
        // textX
        opts.xScale(Date.parse(d.normalTime)) + opts.tooltipSize / 2,
        // textY
        function() {
          if ((category === 'low') || (category === 'target')) {
            return opts.yScale(d.value) - opts.tooltipSize / 2;
          }
          else {
            return opts.yScale(d.value) + opts.tooltipSize / 2;
          }
        });
  };

  return cbg;
};
},{"../lib/":14}],20:[function(require,module,exports){
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

var d3 = require('../lib/').d3;
var _ = require('../lib/')._;

var log = require('../lib/').bows('Message');

module.exports = function(pool, opts) {

  opts = opts || {};

  var defaults = {
    imagesBaseUrl: pool.imagesBaseUrl()
  };

  _.defaults(opts, defaults);

  function cbg(selection) {
    opts.xScale = pool.xScale().copy();
    selection.each(function(currentData) {
      var messages = d3.select(this)
        .selectAll('image')
        .data(currentData, function(d) {
          if (d.parentMessage === '') {
            return d._id;
          }
        });
      var messageGroups = messages.enter()
        .append('g')
        .attr('class', 'd3-message-group');
      messageGroups.append('rect')
        .attr({
          'x': function(d) {
            return opts.xScale(Date.parse(d.normalTime)) - opts.size / 2 - 4;
          },
          'y': pool.height() / 2 - opts.size / 2 - 4,
          'width': opts.size + 8,
          'height': opts.size + 8,
          'class': 'd3-rect-message hidden'
        });
      messageGroups.append('image')
        .attr({
          'xlink:href': opts.imagesBaseUrl + '/message/post_it.svg',
          'x': function(d) {
            return opts.xScale(Date.parse(d.normalTime)) - opts.size / 2;
          },
          'y': pool.height() / 2 - opts.size / 2,
          'width': opts.size,
          'height': opts.size,
          'id': function(d) {
            return 'message_' + d._id;
          }
        })
        .classed({'d3-image': true, 'd3-message': true});
      messageGroups.on('click', function(d) {
        d3.event.stopPropagation(); // silence the click-and-drag listener
        opts.emitter.emit('messageThread', d._id);
        log('Message clicked!');
        d3.select(this).selectAll('.d3-rect-message').classed('hidden', false);
      });
      messages.exit().remove();
    });
  }

  return cbg;
};
},{"../lib/":14}],21:[function(require,module,exports){
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

var d3 = require('../lib/').d3;
var _ = require('../lib/')._;

var log = require('../lib/').bows('SMBG');
var scales = require('./util/scales');

module.exports = function(pool, opts) {

  opts = opts || {};

  var defaults = {
    classes: {
      'very-low': {'boundary': 60},
      'low': {'boundary': 80, 'tooltip': 'smbg_tooltip_low.svg'},
      'target': {'boundary': 180, 'tooltip': 'smbg_tooltip_target.svg'},
      'high': {'boundary': 200, 'tooltip': 'smbg_tooltip_high.svg'},
      'very-high': {'boundary': 300}
    },
    size: 16,
    imagesBaseUrl: pool.imagesBaseUrl(),
    tooltipWidth: 70,
    tooltipHeight: 24
  };

  _.defaults(opts, defaults);

  function smbg(selection) {
    opts.xScale = pool.xScale().copy();
    selection.each(function(currentData) {
      var circles = d3.select(this)
        .selectAll('image')
        .data(currentData, function(d) {
          return d._id;
        });
      circles.enter()
        .append('image')
        .attr({
          'xlink:href': function(d) {
            if (d.value <= opts.classes['very-low'].boundary) {
              return opts.imagesBaseUrl + '/smbg/very_low.svg';
            }
            else if ((d.value > opts.classes['very-low'].boundary) && (d.value <= opts.classes.low.boundary)) {
              return opts.imagesBaseUrl + '/smbg/low.svg';
            }
            else if ((d.value > opts.classes.low.boundary) && (d.value <= opts.classes.target.boundary)) {
              return opts.imagesBaseUrl + '/smbg/target.svg';
            }
            else if ((d.value > opts.classes.target.boundary) && (d.value <= opts.classes.high.boundary)) {
              return opts.imagesBaseUrl + '/smbg/high.svg';
            }
            else if (d.value > opts.classes.high.boundary) {
              return opts.imagesBaseUrl + '/smbg/very_high.svg';
            }
          },
          'x': function(d) {
            return opts.xScale(Date.parse(d.normalTime)) - opts.size / 2;
          },
          'y': function(d) {
            return opts.yScale(d.value) - opts.size / 2;
          },
          'width': opts.size,
          'height': opts.size,
          'id': function(d) {
            return 'smbg_' + d._id;
          },
          'class': function(d) {
            if (d.value <= opts.classes.low.boundary) {
              return 'd3-bg-low';
            }
            else if ((d.value > opts.classes.low.boundary) && (d.value <= opts.classes.target.boundary)) {
              return 'd3-bg-target';
            }
            else if (d.value > opts.classes.target.boundary) {
              return 'd3-bg-high';
            }
          }
        })
        .classed({'d3-image': true, 'd3-smbg': true, 'd3-image-smbg': true});
      circles.exit().remove();

      // tooltips
      d3.selectAll('.d3-image-smbg').on('mouseover', function() {
        if (d3.select(this).classed('d3-bg-low')) {
          smbg.addTooltip(d3.select(this).datum(), 'low');
        }
        else if (d3.select(this).classed('d3-bg-target')) {
          smbg.addTooltip(d3.select(this).datum(), 'target');
        }
        else {
          smbg.addTooltip(d3.select(this).datum(), 'high');
        }
      });
      d3.selectAll('.d3-image-smbg').on('mouseout', function() {
        var id = d3.select(this).attr('id').replace('smbg_', 'tooltip_');
        d3.select('#' + id).remove();
      });
    });
  }

  smbg.addTooltip = function(d, category) {
    d3.select('#' + 'tidelineTooltips_smbg')
      .call(pool.tooltips(),
        d,
        // tooltipXPos
        opts.xScale(Date.parse(d.normalTime)),
        'smbg',
        // timestamp
        true,
        opts.classes[category].tooltip,
        opts.tooltipWidth,
        opts.tooltipHeight,
        // imageX
        opts.xScale(Date.parse(d.normalTime)),
        // imageY
        function() {
          if ((category === 'low') || (category === 'target')) {
            return opts.yScale(d.value) - opts.tooltipHeight;
          }
          else {
            return opts.yScale(d.value);
          }
        },
        // textX
        opts.xScale(Date.parse(d.normalTime)) + opts.tooltipWidth / 2,
        // textY
        function() {
          if ((category === 'low') || (category === 'target')) {
            return opts.yScale(d.value) - opts.tooltipHeight / 2;
          }
          else {
            return opts.yScale(d.value) + opts.tooltipHeight / 2;
          }
        });
  };

  return smbg;
};
},{"../lib/":14,"./util/scales":26}],22:[function(require,module,exports){
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

var d3 = require('../lib/').d3;
var _ = require('../lib/')._;

var log = require('../lib/').bows('Two-Week SMBG');
 
function SMBGTime (opts) {
  var MS_IN_HOUR = 3600000;

  var MS_IN_MIN = 60 * 1000;

  opts = opts || {};

  var defaults = {
    classes: {
      'very-low': {'boundary': 60},
      'low': {'boundary': 80, 'tooltip': 'smbg_tooltip_low.svg'},
      'target': {'boundary': 180, 'tooltip': 'smbg_tooltip_target.svg'},
      'high': {'boundary': 200, 'tooltip': 'smbg_tooltip_high.svg'},
      'very-high': {'boundary': 300}
    },
    size: 16,
    rectWidth: 32
  };

  opts = _.defaults(opts, defaults);

  this.draw = function(pool) {
    opts.pool = pool;
    return function(selection) {
      selection.each(function(currentData) {
        // pool-dependent variables
        var xScale = opts.pool.xScale().copy();

        var circles = d3.select(this)
          .selectAll('g')
          .data(currentData, function(d) {
            return d._id;
          });

        var circleGroups = circles.enter()
          .append('g')
          .attr('class', 'd3-smbg-time-group');

        circleGroups.append('image')
          .attr({
            'xlink:href': function(d) {
              if (d.value <= opts.classes['very-low'].boundary) {
                return opts.pool.imagesBaseUrl() + '/smbg/very_low.svg';
              }
              else if ((d.value > opts.classes['very-low'].boundary) && (d.value <= opts.classes.low.boundary)) {
                return opts.pool.imagesBaseUrl() + '/smbg/low.svg';
              }
              else if ((d.value > opts.classes.low.boundary) && (d.value <= opts.classes.target.boundary)) {
                return opts.pool.imagesBaseUrl() + '/smbg/target.svg';
              }
              else if ((d.value > opts.classes.target.boundary) && (d.value <= opts.classes.high.boundary)) {
                return opts.pool.imagesBaseUrl() + '/smbg/high.svg';
              }
              else if (d.value > opts.classes.high.boundary) {
                return opts.pool.imagesBaseUrl() + '/smbg/very_high.svg';
              }
            },
            'x': function(d) {
              var localTime = new Date(d.normalTime);
              var hour = localTime.getUTCHours();
              var min = localTime.getUTCMinutes();
              var sec = localTime.getUTCSeconds();
              var msec = localTime.getUTCMilliseconds();
              var t = hour * MS_IN_HOUR + min * MS_IN_MIN + sec * 1000 + msec;
              return xScale(t) - opts.size / 2;
            },
            'y': function(d) {
              return pool.height() / 2 - opts.size / 2;
            },
            'width': opts.size,
            'height': opts.size,
            'id': function(d) {
              return 'smbg_time_' + d._id;
            },
            'class': function(d) {
              if (d.value <= opts.classes.low.boundary) {
                return 'd3-bg-low';
              }
              else if ((d.value > opts.classes.low.boundary) && (d.value <= opts.classes.target.boundary)) {
                return 'd3-bg-target';
              }
              else if (d.value > opts.classes.target.boundary) {
                return 'd3-bg-high';
              }
            }
          })
          .classed({'d3-image': true, 'd3-smbg-time': true, 'd3-image-smbg': true})
          .on('dblclick', function(d) {
            d3.event.stopPropagation(); // silence the click-and-drag listener
            opts.emitter.emit('selectSMBG', d.normalTime);
          });

        circleGroups.append('rect')
          .style('display', 'none')
          .attr({
            'x': function(d) {
              var localTime = new Date(d.normalTime);
              var hour = localTime.getUTCHours();
              var min = localTime.getUTCMinutes();
              var sec = localTime.getUTCSeconds();
              var msec = localTime.getUTCMilliseconds();
              var t = hour * MS_IN_HOUR + min * MS_IN_MIN + sec * 1000 + msec;
              return xScale(t) - opts.rectWidth / 2;
            },
            'y': 0,
            'width': opts.size * 2,
            'height': pool.height() / 2,
            'class': 'd3-smbg-numbers d3-rect-smbg d3-smbg-time'
          });

        // NB: cannot do same display: none strategy because dominant-baseline attribute cannot be applied
        circleGroups.append('text')
          .attr({
            'x': function(d) {
              var localTime = new Date(d.normalTime);
              var hour = localTime.getUTCHours();
              var min = localTime.getUTCMinutes();
              var sec = localTime.getUTCSeconds();
              var msec = localTime.getUTCMilliseconds();
              var t = hour * MS_IN_HOUR + min * MS_IN_MIN + sec * 1000 + msec;
              return xScale(t);
            },
            'y': pool.height() / 4,
            'opacity': '0',
            'class': 'd3-smbg-numbers d3-text-smbg d3-smbg-time'
          })
          .text(function(d) {
            return d.value;
          });

        circles.exit().remove();
      });
    };
  };

  this.showValues = function() {
    d3.selectAll('.d3-rect-smbg')
      .style('display', 'inline');
    d3.selectAll('.d3-text-smbg')
      .transition()
      .duration(500)
      .attr('opacity', 1);
    d3.selectAll('.d3-image-smbg')
      .transition()
      .duration(500)
      .attr({
        'height': opts.size * 0.75,
        'y': opts.pool.height() / 2
      });
  };

  this.hideValues = function() {
    d3.selectAll('.d3-rect-smbg')
      .style('display', 'none');
    d3.selectAll('.d3-text-smbg')
      .transition()
      .duration(500)
      .attr('opacity', 0);
    d3.selectAll('.d3-image-smbg')
      .transition()
      .duration(500)
      .attr({
        'height': opts.size,
        'y': opts.pool.height() / 2 - opts.size / 2
      });
  };
}

module.exports = SMBGTime;
},{"../lib/":14}],23:[function(require,module,exports){
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

var _ = require('../../lib/')._;

var log = require('../../lib/').bows('Puddle');

module.exports = function(opts) {

  opts = opts || {};

  var defaults = {
    headSize: 16,
    leadSize: 14,
    displaySize: 24
  };

  _.defaults(opts, defaults);

  var height;

  function puddle(selection, txt) {
    selection.call(puddle.addHead);
    selection.call(puddle.addLead);
  }

  puddle.dataDisplay = function(selection, display) {
    selection.selectAll('text.d3-stats-display').remove();
    var displayGroup = selection.append('text')
      .attr({
        'x': opts.xOffset,
        'y': opts.height / 2 + opts.leadSize,
        'class': 'd3-stats-display'
      });

    display.forEach(function(txt) {
      displayGroup.append('tspan')
        .attr('class', txt['class'])
        .text(txt.text);
    });
  };

  puddle.addHead = _.once(function(selection) {
    selection.append('text')
      .attr({
        'x': opts.xOffset,
        'y': 0,
        'class': 'd3-stats-head'
      })
      .text(opts.head);
  });

  puddle.addLead = _.once(function(selection) {
    selection.append('text')
      .attr({
        'x': opts.xOffset,
        'y': opts.height / 2,
        'class': 'd3-stats-lead'
      })
      .text(opts.lead);
  });

  puddle.width = function(x) {
    if (!arguments.length) return opts.width;
    opts.width = x;
    return puddle;
  };

  puddle.height = function(x) {
    if (!arguments.length) return height;
    height = x;
    return puddle;
  };

  puddle.id = opts.id;

  puddle.weight = opts.weight;

  puddle.pie = opts.pie;

  return puddle;
};
},{"../../lib/":14}],24:[function(require,module,exports){
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

var d3 = require('../../lib/').d3;
var _ = require('../../lib/')._;

var log = require('../../lib/').bows('Stats');
var scales = require('../util/scales');
var dt = require('../../data/util/datetime');
var format = require('../../data/util/format');

module.exports = function(pool, opts) {

  var Puddle = require('./puddle');

  opts = opts || {};

  var defaults = {
    classes: {
      'very-low': {'boundary': 60},
      'low': {'boundary': 80},
      'target': {'boundary': 180},
      'high': {'boundary': 200},
      'very-high': {'boundary': 300}
    },
    twoWeekOptions: {
      'exclusionThreshold': 7
    },
    imagesBaseUrl: pool.imagesBaseUrl(),
    size: 16,
    'pieRadius': pool.height() * 0.45
  };

  var data = {
    'ratio': [],
    'range': [],
    'average': [],
    'cbgReadings': 0
  };

  var pies = [], pie, arc;

  var currentIndices = {};

  opts.emitter.on('currentDomain', function(domain) {
    stats.getStats(domain);
    stats.draw();
  });

  _.defaults(opts, defaults);

  var widgetGroup, rectScale;

  var puddles = [];

  function stats(selection) {
    widgetGroup = selection;
    stats.initialize();
  }

  stats.initialize = _.once(function() {
    // move this group inside the container's axisGutter
    widgetGroup.attr({
      'transform': 'translate(' + opts.xPosition + ',' + opts.yPosition + ')'
    });
    if (opts.oneDay) {
      // create basal-to-bolus ratio puddle
      stats.newPuddle('Ratio', 'Basal : Bolus', 'Basal to bolus insulin ratio', 1.0, true);
      // create time-in-range puddle
      stats.newPuddle('Range', 'Time in Target Range', 'Target range: 80 - 180 mg/dL', 1.2, true);
      // create average BG puddle
      stats.newPuddle('Average', 'Average BG', 'This day', 0.9, false);
    }
    else {
      // create basal-to-bolus ratio puddle
      stats.newPuddle('Ratio', 'Basal : Bolus', 'Basal to bolus insulin ratio', 1.1, true);
      // create time-in-range puddle
      stats.newPuddle('Range', 'Time in Target Range', 'Target range: 80 - 180 mg/dL', 1.2, true);
      // create average BG puddle
      stats.newPuddle('Average', 'Average BG', 'These two weeks', 1.0, false);
    }
    stats.arrangePuddles();
  });

  stats.arrangePuddles = function() {
    var cumWeight = _.reduce(puddles, function(memo, puddle) { return memo + puddle.weight; }, 0);
    var currentWeight = 0;
    var currX = 0;
    puddles.forEach(function(puddle, i) {
      currentWeight += puddle.weight;
      puddle.width((puddle.weight/cumWeight) * pool.width());
      var puddleGroup = widgetGroup.append('g')
        .attr({
          'transform': 'translate(' + currX + ',0)',
          'class': 'd3-stats',
          'id': 'puddle_' + puddle.id
        });
      currX = (currentWeight / cumWeight) * pool.width();
      puddleGroup.call(puddle);
    });
  };

  stats.draw = function() {
    puddles.forEach(function(puddle) {
      var puddleGroup = pool.group().select('#puddle_' + puddle.id);
      if (puddle.pie) {
        var thisPie = _.find(pies, function(p) {
          return p.id === puddle.id;
        });
        var createAPie = function(puddleGroup, data) {
          var slices = stats.createPie(puddleGroup, data[puddle.id.toLowerCase()]);
          pies.push({
            'id': puddle.id,
            'slices': slices
          });
        };
        // when NaN(s) present, create a no data view
        if (stats.hasNaN(data[puddle.id.toLowerCase()])) {
          pies = _.reject(pies, function(pie) {
            return _.isEqual(pie, thisPie);
          });
          createAPie(puddleGroup, data);
        }
        // or if good data, but no pie yet, create a pie
        else if (!thisPie) {
          createAPie(puddleGroup, data);
        }
        else {
          // or if no data view is the existing "pie", recreate a real pie
          if (thisPie.slices === null) {
            pies = _.reject(pies, function(pie) {
              return _.isEqual(pie, thisPie);
            });
            createAPie(puddleGroup, data);
          }
          // or just update the current pie
          else {
            stats.updatePie(thisPie, data[puddle.id.toLowerCase()]);
          }
        }
      }
      else {
        if (!stats.rectGroup) {
          stats.createRect(puddle, puddleGroup, data[puddle.id.toLowerCase()]);
        }
        else {
          stats.updateAverage(puddle, puddleGroup, data[puddle.id.toLowerCase()]);
        }
      }
      var display = stats.getDisplay(puddle.id);
      puddle.dataDisplay(puddleGroup, display);
    });
  };

  stats.createRect = function(puddle, puddleGroup, data) {
    var rectGroup = puddleGroup.append('g')
      .attr('id', 'd3-stats-rect-group');

    puddle.height(pool.height() * (4/5));

    rectGroup.append('rect')
      .attr({
        'x': puddle.width() / 16,
        'y': pool.height() / 10,
        'width': puddle.width() / 8,
        'height': pool.height() * (4/5),
        'class': 'd3-stats-rect rect-left'
      });

    rectGroup.append('rect')
      .attr({
        'x': puddle.width() * (3/16),
        'y': pool.height() / 10,
        'width': puddle.width() / 8,
        'height': pool.height() * (4/5),
        'class': 'd3-stats-rect rect-right'
      });

    rectScale = scales.bgLog(opts.cbg.data, puddle, 0);

    rectGroup.append('line')
      .attr({
        'x1': puddle.width() / 16,
        'x2': puddle.width() * (5/16),
        'y1': rectScale(80) + (pool.height() / 10),
        'y2': rectScale(80) + (pool.height() / 10),
        'class': 'd3-stats-rect-line'
      });

    rectGroup.append('line')
      .attr({
        'x1': puddle.width() / 16,
        'x2': puddle.width() * (5/16),
        'y1': rectScale(180) + (pool.height() / 10),
        'y2': rectScale(180) + (pool.height() / 10),
        'class': 'd3-stats-rect-line'
      });
    var imageY = rectScale(data.value) - (opts.size / 2) + (puddle.height() / 10);
    // don't append an image if imageY is NaN or Infinity
    if (isFinite(imageY)) {
      rectGroup.append('image')
        .attr({
          'xlink:href': function() {
            if (data.value <= opts.classes['very-low'].boundary) {
              return opts.imagesBaseUrl + '/smbg/very_low.svg';
            }
            else if ((data.value > opts.classes['very-low'].boundary) && (data.value <= opts.classes.low.boundary)) {
              return opts.imagesBaseUrl + '/smbg/low.svg';
            }
            else if ((data.value > opts.classes.low.boundary) && (data.value <= opts.classes.target.boundary)) {
              return opts.imagesBaseUrl + '/smbg/target.svg';
            }
            else if ((data.value > opts.classes.target.boundary) && (data.value <= opts.classes.high.boundary)) {
              return opts.imagesBaseUrl + '/smbg/high.svg';
            }
            else if (data.value > opts.classes.high.boundary) {
              return opts.imagesBaseUrl + '/smbg/very_high.svg';
            }
          },
          'x': (puddle.width() * (3/16)) - (opts.size / 2),
          'y': imageY,
          'width': opts.size,
          'height': opts.size,
          'class': 'd3-image d3-stats-image'
        });
    }
    else {
      rectGroup.append('image')
        .attr({
          'xlink:href': function() {
            if (data.value <= opts.classes['very-low'].boundary) {
              return opts.imagesBaseUrl + '/smbg/very_low.svg';
            }
            else if ((data.value > opts.classes['very-low'].boundary) && (data.value <= opts.classes.low.boundary)) {
              return opts.imagesBaseUrl + '/smbg/low.svg';
            }
            else if ((data.value > opts.classes.low.boundary) && (data.value <= opts.classes.target.boundary)) {
              return opts.imagesBaseUrl + '/smbg/target.svg';
            }
            else if ((data.value > opts.classes.target.boundary) && (data.value <= opts.classes.high.boundary)) {
              return opts.imagesBaseUrl + '/smbg/high.svg';
            }
            else if (data.value > opts.classes.high.boundary) {
              return opts.imagesBaseUrl + '/smbg/very_high.svg';
            }
            else {
              return opts.imagesBaseUrl + '/ux/scroll_thumb.svg';
            }
          },
          'x': (puddle.width() * (3/16)) - (opts.size / 2),
          'y': rectScale(100) - (opts.size / 2) + (puddle.height() / 10),
          'width': opts.size,
          'height': opts.size,
          'class': 'd3-image d3-stats-image hidden'
        });
    }

    stats.rectGroup = rectGroup;

    if (isNaN(data.value)) {
      puddleGroup.classed('d3-insufficient-data', true);
      stats.rectGroup.selectAll('.d3-stats-image').classed('hidden', true);
    }
    else {
      puddleGroup.classed('d3-insufficient-data', false);
      stats.rectGroup.selectAll('.d3-stats-image').classed('hidden', false);
    }
  };

  stats.updateAverage = function(puddle, puddleGroup, data) {
    if (isNaN(data.value)) {
      puddleGroup.classed('d3-insufficient-data', true);
      stats.rectGroup.selectAll('.d3-stats-image').classed('hidden', true);
    }
    else {
      puddleGroup.classed('d3-insufficient-data', false);
    }
    var imageY = rectScale(data.value) - (opts.size / 2) + (puddle.height() / 10);
    if (isFinite(imageY)) {
      stats.rectGroup.selectAll('.d3-stats-image')
        .attr({
          'xlink:href': function() {
            if (data.value <= opts.classes['very-low'].boundary) {
              return opts.imagesBaseUrl + '/smbg/very_low.svg';
            }
            else if ((data.value > opts.classes['very-low'].boundary) && (data.value <= opts.classes.low.boundary)) {
              return opts.imagesBaseUrl + '/smbg/low.svg';
            }
            else if ((data.value > opts.classes.low.boundary) && (data.value <= opts.classes.target.boundary)) {
              return opts.imagesBaseUrl + '/smbg/target.svg';
            }
            else if ((data.value > opts.classes.target.boundary) && (data.value <= opts.classes.high.boundary)) {
              return opts.imagesBaseUrl + '/smbg/high.svg';
            }
            else if (data.value > opts.classes.high.boundary) {
              return opts.imagesBaseUrl + '/smbg/very_high.svg';
            }
          },
          'y': imageY
        })
        .classed('hidden', false);
    }
  };

  stats.createPie = function(puddleGroup, data) {
    var xOffset = (pool.width()/3) * (1/6);
    var yOffset = pool.height() / 2;
    puddleGroup.selectAll('.d3-stats-pie').remove();
    var pieGroup = puddleGroup.append('g')
      .attr({
        'transform': 'translate(' + xOffset + ',' + yOffset + ')',
        'class': 'd3-stats-pie'
      });
    if (stats.hasNaN(data)) {
      puddleGroup.classed('d3-insufficient-data', true);
      pieGroup.append('circle')
        .attr({
          'cx': 0,
          'cy': 0,
          'r': opts.pieRadius
        });

      return null;
    }
    else {
      puddleGroup.classed('d3-insufficient-data', false);
      pie = d3.layout.pie().value(function(d) {
          return d.value;
        })
        .sort(null);

      arc = d3.svg.arc()
        .innerRadius(0)
        .outerRadius(opts.pieRadius);

      var slices = pieGroup.selectAll('g.d3-stats-slice')
        .data(pie(data))
        .enter()
        .append('path')
        .attr({
          'd': arc,
          'class': function(d) {
            return 'd3-stats-slice d3-' + d.data.type;
          }
        });

      return slices;
    }
  };

  stats.updatePie = function(thisPie, data) {
    thisPie.slices.data(pie(data))
      .attr({
        'd': arc
      });
  };

  stats.hasNaN = function(a) {
    var found = false;
    a.forEach(function(obj) {
      if (isNaN(obj.value)) {
        found = true;
      }
    });
    return found;
  };

  stats.newPuddle = function(id, head, lead, weight, pieBoolean) {
    var p = new Puddle({
      'id': id,
      'head': head,
      'lead': lead,
      'width': pool.width()/3,
      'height': pool.height(),
      'weight': weight,
      'xOffset': function() {
        if (pieBoolean) {
          return (pool.width()/3) / 3;
        }
        else {
          return (pool.width()/3) * (2 / 5);
        }
      },
      'pie': pieBoolean
    });
    puddles.push(p);
  };

  stats.getDisplay = function(id) {
    switch (id) {
    case 'Ratio':
      return stats.ratioDisplay();
    case 'Range':
      return stats.rangeDisplay();
    case 'Average':
      return stats.averageDisplay();
    }
  };

  stats.ratioDisplay = function() {
    var bolus = _.findWhere(data.ratio, {'type': 'bolus'}).value;
    var basal = _.findWhere(data.ratio, {'type': 'basal'}).value;
    var total = bolus + basal;
    return [{
        'text': format.percentage(basal/total) + ' : ',
        'class': 'd3-stats-basal'
      },
      {
        'text': format.percentage(bolus/total),
        'class': 'd3-stats-bolus'
      }];
  };

  stats.rangeDisplay = function() {
    var target = _.findWhere(data.range, {'type': 'bg-target'}).value;
    var total = parseFloat(data.cbgReadings);
    return [{'text': format.percentage(target/total), 'class': 'd3-stats-percentage'}];
  };

  stats.averageDisplay = function() {
    if (isNaN(data.average.value)) {
      return [{'text': '--- mg/dL', 'class': 'd3-stats-' + data.average.category}];
    }
    else {
      return [{'text': data.average.value + ' mg/dL', 'class': 'd3-stats-' + data.average.category}];
    }
  };

  stats.getStats = function(domainObj) {
    var start = domainObj.domain[0].valueOf(), end = domainObj.domain[1].valueOf();
    opts.twoWeekOptions.startIndex = domainObj.startIndex;
    var basalData = opts.basal.totalBasal(start, end, opts.twoWeekOptions);
    var excluded = basalData.excluded;
    var cbgStats = opts.cbg.getStats(start, end, opts.twoWeekOptions);
    data.ratio = [
      {
        'type': 'bolus',
        'value': opts.bolus.totalBolus(start, end, {'excluded': excluded})
      },
      {
        'type': 'basal',
        'value': basalData.total
      }
    ];
    var range = cbgStats.breakdown;
    data.range = [
      {
        'type': 'bg-low',
        'value': range.low,
      },
      {
        'type': 'bg-target',
        'value': range.target,
      },
      {
        'type': 'bg-high',
        'value': range.high
      }
    ];
    data.cbgReadings = range.total;
    data.average = cbgStats.average;
  };

  return stats;
};
},{"../../data/util/datetime":10,"../../data/util/format":11,"../../lib/":14,"../util/scales":26,"./puddle":23}],25:[function(require,module,exports){
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

var _ = require('../../lib/')._;
var log = require('../../lib/').bows('Fill');

module.exports = function(pool, opts) {

  var fills = [],
      defaults = {
        classes: {
          0: 'darkest',
          3: 'dark',
          6: 'lighter',
          9: 'light',
          12: 'lightest',
          15: 'lighter',
          18: 'dark',
          21: 'darkest'
        },
        duration: 3,
        gutter: 0
      };

  _.defaults(opts || {}, defaults);

  function pushFillFor(start, end) {
    fills.push({
      width: opts.xScale(end) - opts.xScale(start),
      x: opts.xScale(start),
      fill: opts.classes[start.getUTCHours()]
    });
  }

  function durationSegmentedDomain() {
    var first = new Date(opts.endpoints[0]);
    var last = new Date(opts.endpoints[1]);
    // make sure we encapsulate the domain completely by padding the start and end with `opts.duration`
    first.setUTCHours(first.getUTCHours() - first.getUTCHours() % opts.duration - opts.duration);
    last.setUTCHours(last.getUTCHours() + last.getUTCHours() % opts.duration + opts.duration);
    return d3.time.hour.utc.range(first, last, opts.duration);
  }

  function fill(selection) {
    if (!opts.xScale) {
      opts.xScale = pool.xScale().copy();
    }
    var i, range;

    range = durationSegmentedDomain();
    for (i = 0; i < range.length - 1; i++) {
      pushFillFor(range[i], range[i + 1]);
    }

    if (opts.dataGutter) {
      fills.shift();
    }

    selection.selectAll('rect')
      .data(fills)
      .enter()
      .append('rect')
      .attr({
        'x': function(d, i) {
          if (opts.dataGutter) {
            if (i === 0) {
              return d.x - opts.dataGutter;
            }
            else {
              return d.x;
            }
          }
          else {
            return d.x;
          }
        },
        'y': function() {
          if (opts.gutter.top) {
            return opts.gutter.top;
          }
          else {
            return opts.gutter;
          }
        },
        'width': function(d, i) {
          if (opts.dataGutter) {
            if ((i === 0) || (i === fills.length  - 1)) {
              return d.width + opts.dataGutter;
            }
            else {
              return d.width;
            }
          }
          else {
            return d.width;
          }
        },
        'height': function() {
          if (opts.gutter.top) {
            return pool.height() - opts.gutter.top - opts.gutter.bottom;
          }
          else {
            return pool.height() - 2 * opts.gutter;
          }
        },
        'class': function(d) {
          return 'd3-rect-fill d3-fill-' + d.fill;
        }
      });
  }

  return fill;
};

},{"../../lib/":14}],26:[function(require,module,exports){
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

var d3 = require('../../lib/').d3;
var _ = require('../../lib/')._;

var scales = {
  MAX_CBG: 401,

  bg: function(data, pool, pad) {
    var ext = d3.extent(data, function(d) { return d.value; });
    if (ext > this.MAX_CBG) {
      return d3.scale.linear()
        .domain([0, this.MAX_CBG])
        .range([pool.height() - pad, pad])
        .clamp();
    }
    else {
      return d3.scale.linear()
        .domain([0, ext[1]])
        .range([pool.height() - pad, pad]);
    }
  },
  bgLog: function(data, pool, pad) {
    var ext = d3.extent(data, function(d) { return d.value; });
    if (ext > this.MAX_CBG) {
      return d3.scale.log()
        .domain(ext[0], this.MAX_CBG)
        .range([pool.height() - pad, pad])
        .clamp();
    }
    else {
      return d3.scale.log()
        .domain(ext)
        .range([pool.height() - pad, pad]);
    }
  },
  bgTicks: function(data) {
    var defaultTicks = [40, 80, 120, 180, 300];
    // check for data that looks like mmol and generation of different defaultTicks should go here
    var ext = d3.extent(data, function(d) { return d.value; });
    // if the min of our data is greater than any of the defaultTicks, remove that tick
    defaultTicks.forEach(function(tick) {
      if (ext[0] > tick) {
        defaultTicks.shift();
      }
    });
    defaultTicks.reverse();
    defaultTicks.forEach(function(tick) {
      if (ext[1] < tick) {
        defaultTicks.shift();
      }
    });
    return defaultTicks.reverse();
  },
  carbs: function(data, pool) {
    var scale = d3.scale.linear()
      .domain([0, d3.max(data, function(d) { return d.value; })])
      .range([0, 0.475 * pool.height()]);
    return scale;
  },
  bolus: function(data, pool) {
    var scale = d3.scale.linear()
      .domain([0, d3.max(data, function(d) { return d.value; })])
      .range([pool.height(), 0.525 * pool.height()]);
    return scale;
  },
  basal: function(data, pool) {
    var scale = d3.scale.linear()
      .domain([0, d3.max(data, function(d) { return d.value; }) * 1.1])
      .rangeRound([pool.height(), 0]);
    return scale;
  }
};

module.exports = scales;
},{"../../lib/":14}],27:[function(require,module,exports){
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

var d3 = require('../../lib/').d3;

var log = require('../../lib/').bows('Tooltip');

module.exports = function(container, tooltipsGroup) {

  var id, timestampHeight = 20;

  function tooltip(selection,
    d,
    tooltipXPos,
    path,
    makeTimestamp,
    image,
    tooltipWidth,
    tooltipHeight,
    imageX, imageY,
    textX, textY,
    customText, tspan) {
    var tooltipGroup = selection.append('g')
      .attr('class', 'd3-tooltip')
      .attr('id', 'tooltip_' + d._id);

    var imagesBaseUrl = container.imagesBaseUrl();

    var currentTranslation = container.currentTranslation();

    var locationInWindow = currentTranslation + tooltipXPos;

    var translation = 0;

    var newBasalPosition;

    // moving basal tooltips at edges of display
    if (path === 'basal') {
      if (locationInWindow > container.width() - (((container.width() - container.axisGutter()) / 24) * 3)) {
        newBasalPosition = -currentTranslation + container.width() - tooltipWidth;
        if (newBasalPosition < imageX) {
          translation = newBasalPosition - imageX;
          imageX = newBasalPosition;
        }
      }
      else if (locationInWindow < (((container.width() - container.axisGutter()) / 24) * 3)) {
        newBasalPosition = -currentTranslation + container.axisGutter();
        if (newBasalPosition > imageX) {
          translation = newBasalPosition - imageX;
          imageX = newBasalPosition;
        }
      }
    }
    // and bolus, carbs, cbg, smbg
    if ((path === 'bolus') || (path === 'carbs') || (path === 'cbg') || (path === 'smbg')) {
      if (locationInWindow > container.width() - (((container.width() - container.axisGutter()) / 24) * 3)) {
        translation = -tooltipWidth;
      }
    }

    // for now (unless I can persude Sara and Alix otherwise), high cbg values are a special case
    if (image.indexOf('cbg_tooltip_high') !== -1) {
      if (locationInWindow < (((container.width() - container.axisGutter()) / 24) * 3)) {
        tooltipGroup.append('image')
          .attr({
            'xlink:href': imagesBaseUrl + '/' + path + '/' + image,
            'x': imageX,
            'y': imageY,
            'width': tooltipWidth,
            'height': tooltipHeight,
            'class': 'd3-tooltip-image'
          });

        tooltipGroup.append('text')
          .attr({
            'x': textX,
            'y': textY,
            'class': 'd3-tooltip-text d3-' + path
          })
          .text(function() {
            return d.value;
          });
      }
      else {
        tooltipGroup.append('image')
          .attr({
            'xlink:href': function() {
              var str =  imagesBaseUrl + '/' + path + '/' + image;
              return str.replace('.svg', '_left.svg');
            },
            'x': imageX - tooltipWidth,
            'y': imageY,
            'width': tooltipWidth,
            'height': tooltipHeight,
            'class': 'd3-tooltip-image'
          });

        tooltipGroup.append('text')
          .attr({
            'x': textX - tooltipWidth,
            'y': textY,
            'class': 'd3-tooltip-text d3-' + path
          })
          .text(function() {
            return d.value;
          });
      }
    }
    // if the data point is three hours from the end of the data in view or less, use a left tooltip
    else if ((locationInWindow > container.width() - (((container.width() - container.axisGutter()) / 24) * 3)) &&
      (path !== 'basal')) {
      tooltipGroup.append('image')
        .attr({
          'xlink:href': function() {
            var str =  imagesBaseUrl + '/' + path + '/' + image;
            return str.replace('.svg', '_left.svg');
          },
          'x': imageX - tooltipWidth,
          'y': imageY,
          'width': tooltipWidth,
          'height': tooltipHeight,
          'class': 'd3-tooltip-image'
        });

      if (tspan) {
        tooltipGroup.append('g')
          .attr({
            'class': 'd3-tooltip-text-group',
            'transform': 'translate(' + translation + ',0)'
          })
          .append('text')
          .attr({
            'x': textX,
            'y': textY,
            'class': 'd3-tooltip-text d3-' + path
          })
          .text(function() {
            if (customText) {
              return customText;
            }
            else {
              return d.value;
            }
          });
        tooltipGroup.select('.d3-tooltip-text-group').select('text')
          .append('tspan')
          .text(' ' + tspan);
      }
      else {
        tooltipGroup.append('g')
          .attr({
            'class': 'd3-tooltip-text-group',
            'transform': 'translate(' + translation + ',0)'
          })
          .append('text')
          .attr({
            'x': textX,
            'y': textY,
            'class': 'd3-tooltip-text d3-' + path
          })
          .text(function() {
            if (customText) {
              return customText;
            }
            else {
              return d.value;
            }
          });
      }

      // adjust the values needed for the timestamp
      imageX = imageX - tooltipWidth;
      textX = textX - tooltipWidth;
    }
    else {
      tooltipGroup.append('image')
        .attr({
          'xlink:href': imagesBaseUrl + '/' + path + '/' + image,
          'x': imageX,
          'y': imageY,
          'width': tooltipWidth,
          'height': tooltipHeight,
          'class': 'd3-tooltip-image'
        });

      if (tspan) {
        tooltipGroup.append('g')
        .attr({
          'class': 'd3-tooltip-text-group',
          'transform': 'translate(' + translation + ',0)'
        })
        .append('text')
        .attr({
          'x': textX,
          'y': textY,
          'class': 'd3-tooltip-text d3-' + path
        })
        .text(function() {
          if (customText) {
            return customText;
          }
          else {
            return d.value;
          }
        });
        tooltipGroup.select('.d3-tooltip-text-group').select('text')
          .append('tspan')
          .text(' ' + tspan);
      }
      else {
        tooltipGroup.append('g')
          .attr({
            'class': 'd3-tooltip-text-group',
            'transform': 'translate(' + translation + ',0)'
          })
          .append('text')
          .attr({
            'x': textX,
            'y': textY,
            'class': 'd3-tooltip-text d3-' + path
          })
          .text(function() {
            if (customText) {
              return customText;
            }
            else {
              return d.value;
            }
          });
      }

    }

    if (makeTimestamp) {
      tooltip.timestamp(d, tooltipGroup, imageX, imageY, textX, textY, tooltipWidth, tooltipHeight);
    }
  }

  tooltip.timestamp = function(d, tooltipGroup, imageX, imageY, textX, textY, tooltipWidth, tooltipHeight) {
    var magic = timestampHeight * 1.2;
    var timestampY = imageY() - timestampHeight;
    var timestampTextY = timestampY + magic / 2;

    var formatTime = d3.time.format.utc('%-I:%M %p');
    var t = formatTime(new Date(d.normalTime));
    tooltipGroup.append('rect')
      .attr({
        'x': imageX,
        'y': timestampY,
        'width': tooltipWidth,
        'height': timestampHeight,
        'class': 'd3-tooltip-rect'
      });
    tooltipGroup.append('text')
      .attr({
        'x': textX,
        'y': timestampTextY,
        'baseline-shift': (magic - timestampHeight) / 2,
        'class': 'd3-tooltip-text d3-tooltip-timestamp'
      })
      .text('at ' + t);
  };

  tooltip.addGroup = function(pool, type) {
    tooltipsGroup.append('g')
      .attr('id', tooltip.id() + '_' + type)
      .attr('transform', pool.attr('transform'));
  };

  // getters & setters
  tooltip.id = function(x) {
    if (!arguments.length) return id;
    id = tooltipsGroup.attr('id');
    return tooltip;
  };

  return tooltip;
};
},{"../../lib/":14}],28:[function(require,module,exports){
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

var d3 = require('./lib/').d3;
var _ = require('./lib/')._;

var log = require('./lib/').bows('Pool');
 
function Pool (container) {

  var data,
    id, label,
    index, weight, yPosition,
    height, minHeight = 20, maxHeight = 300,
    group,
    mainSVG = d3.select(container.id()),
    xScale,
    imagesBaseUrl = container.imagesBaseUrl(),
    yAxis = [],
    plotTypes = [],
    tooltips;

  this.render = function(selection, poolData) {
    var pool = this;
    plotTypes.forEach(function(plotType) {
      if (container.dataFill[plotType.type]) {
        plotType.data = _.where(poolData, {'type': plotType.type});
        if (plotType.data.length !== 0) {
          var dataGroup = group.selectAll('#' + id + '_' + plotType.type).data([plotType.data]);
          dataGroup.enter().append('g').attr('id', id + '_' + plotType.type);
          dataGroup.call(plotType.plot);
        }
      }
      else if (plotType.type === 'stats') {
        var statsGroup = group.selectAll('#' + id + '_stats').data([null]);
        statsGroup.enter().append('g').attr('id', id + '_stats').call(plotType.plot);
      }
      else {
        pool.noDataFill(plotType);
      }
    });
    this.drawAxis();
    this.drawLabel();
  };

  this.clear = function() {
    plotTypes.forEach(function(plotType) {
      if (container.dataFill[plotType.type])  {
        group.select('#' + id + '_' + plotType.type).remove();
      }
    });
  };

  // non-chainable methods
  this.pan = function(e) {
    container.latestTranslation(e.translate[0]);
    plotTypes.forEach(function(plotType) {
      if (plotType.panBoolean) {
        d3.select('#' + id + '_' + plotType.type).attr('transform', 'translate(' + e.translate[0] + ',0)');
      }
    });
  };

  this.scroll = function(e) {
    container.latestTranslation(e.translate[1]);
    plotTypes.forEach(function(plotType) {
      d3.select('#' + id + '_' + plotType.type).attr('transform', 'translate(0,' + e.translate[1] + ')');
    });
  };

  // getters only
  this.group = function() {
    return group;
  };

  this.width = function() {
    return container.width() - container.axisGutter();
  };

  this.imagesBaseUrl = function() {
    return imagesBaseUrl;
  };

  // only once methods
  this.drawLabel = _.once(function() {
    var labelGroup = d3.select('#tidelineLabels');
    labelGroup.append('text')
      .attr({
        'id': 'pool_' + id + '_label',
        'class': 'd3-pool-label',
        'transform': 'translate(' + container.axisGutter() + ',' + yPosition + ')'
      })
      .text(label);
    return this;
  });

  this.drawAxis = _.once(function() {
    var axisGroup = d3.select('#tidelineYAxes');
    yAxis.forEach(function(axis, i) {
      axisGroup.append('g')
        .attr('class', 'd3-y d3-axis')
        .attr('id', 'pool_' + id + '_yAxis_' + i)
        .attr('transform', 'translate(' + (container.axisGutter() - 1) + ',' + yPosition + ')')
        .call(axis);
    });
    return this;
  });

  this.noDataFill = _.once(function(plotType) {
    d3.select('#' + id).append('g').attr('id', id + '_' + plotType.type).call(plotType.plot);
    return this;
  });

  // getters & setters
  this.id = function(x, selection) {
    if (!arguments.length) return id;
    id = x;
    group = selection.append('g').attr('id', id);
    return this;
  };

  this.label = function(x) {
    if (!arguments.length) return label;
    label = x;
    return this;
  };

  this.index = function(x) {
    if (!arguments.length) return index;
    index = x;
    return this;
  };

  this.weight = function(x) {
    if (!arguments.length) return weight;
    weight = x;
    return this;
  };

  this.height = function(x) {
    if (!arguments.length) return height;
    x = x * this.weight();
    if (x <= maxHeight) {
      if (x >= minHeight) {
        height = x;
      }
      else {
        height = minHeight;
      }
    }
    else {
      height = maxHeight;
    }
    return this;
  };

  this.yPosition = function(x) {
    if (!arguments.length) return yPosition;
    yPosition = x;
    return this;
  };

  this.tooltips = function(f) {
    if (!arguments.length) return tooltips;
    tooltips = f;
    return this;
  };

  this.xScale = function(f) {
    if (!arguments.length) return xScale;
    xScale = f;
    return this;
  };

  this.yAxis = function(x) {
    if (!arguments.length) return yAxis;
    yAxis.push(x);
    return this;
  };

  this.addPlotType = function (dataType, plotFunction, dataFillBoolean, panBoolean) {
    plotTypes.push({
      type: dataType,
      plot: plotFunction,
      panBoolean: panBoolean
    });
    if (dataFillBoolean) {
      container.dataFill[dataType] = true;
    }
    return this;
  };

  return this;
}

module.exports = Pool;

},{"./lib/":14}],29:[function(require,module,exports){
/* 
 * == BSD2 LICENSE ==
 */

var _ = require('./lib/')._;

var log = require('./lib/').bows('TidelineData');

function TidelineData(data) {

  data = _.map(data, function(d, i) {
    if (!d.index) {
      d.index = i;
      return d;
    }
  });

  this.data = data;

  return this;
}

module.exports = TidelineData;
},{"./lib/":14}],30:[function(require,module,exports){
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

var d3 = require('./lib/').d3;
var _ = require('./lib/')._;

var log = require('./lib/').bows('Two Week');

module.exports = function(emitter) {
  // required externals
  var Pool = require('./pool');

  // constants
  var MS_IN_24 = 86400000;

  // basic attributes
  var id = 'tidelineSVGTwoWeek',
    minWidth = 400, minHeight = 400,
    width = minWidth, height = minHeight,
    imagesBaseUrl = 'img',
    nav = {
      axisHeight: 30,
      navGutter: 20,
      scrollThumbRadius: 8,
      currentTranslation: 0
    },
    axisGutter = 52, dataGutter, dayTickSize = 0,
    statsHeight = 100,
    pools = [], poolGroup, days, daysGroup,
    xScale = d3.scale.linear(), xAxis, yScale = d3.time.scale.utc(), yAxis,
    data, endpoints, viewEndpoints, dataStartNoon, dataEndNoon, poolScaleHeight,
    lessThanTwoWeeks = false,
    sortReverse = true, viewIndex,
    mainGroup, scrollNav, scrollHandleTrigger = true,
    cachedDomain;

  container.dataFill = {};

  function container(selection) {
    var mainSVG = selection.append('svg');

    mainGroup = mainSVG.append('g').attr('id', 'tidelineMain');

    // update SVG dimenions and ID
    mainSVG.attr({
      'id': id,
      'width': width,
      'height': height,
      'class': 'hidden'
    });

    mainGroup.append('rect')
      .attr({
        'id': 'poolsInvisibleRect',
        'width': width - nav.navGutter,
        'height': height,
        'opacity': 0.0
      });
  }

  // non-chainable methods
  container.panForward = function() {
    log('Jumped forward two weeks.');
    if (sortReverse) {
      nav.currentTranslation += height - nav.axisHeight - statsHeight;
      mainGroup.transition().duration(500).tween('zoom', function() {
        var iy = d3.interpolate(nav.currentTranslation - height + nav.axisHeight + statsHeight, nav.currentTranslation);
        return function(t) {
          nav.scroll.translate([0, iy(t)]);
          nav.scroll.event(mainGroup);
        };
      });
    }
    else {
      nav.currentTranslation -= height - nav.axisHeight - statsHeight;
      mainGroup.transition().duration(500).tween('zoom', function() {
        var iy = d3.interpolate(nav.currentTranslation + height - nav.axisHeight - statsHeight, nav.currentTranslation);
        return function(t) {
          nav.scroll.translate([0, iy(t)]);
          nav.scroll.event(mainGroup);
        };
      });
    }
  };

  container.panBack = function() {
    log('Jumped back two weeks.');
    if (sortReverse) {
      nav.currentTranslation -= height - nav.axisHeight - statsHeight;
      mainGroup.transition().duration(500).tween('zoom', function() {
        var iy = d3.interpolate(nav.currentTranslation + height - nav.axisHeight - statsHeight, nav.currentTranslation);
        return function(t) {
          nav.scroll.translate([0, iy(t)]);
          nav.scroll.event(mainGroup);
        };
      });
    }
    else {
      nav.currentTranslation += height - nav.axisHeight - statsHeight;
      mainGroup.transition().duration(500).tween('zoom', function() {
        var iy = d3.interpolate(nav.currentTranslation - height + nav.axisHeight + statsHeight, nav.currentTranslation);
        return function(t) {
          nav.scroll.translate([0, iy(t)]);
          nav.scroll.event(mainGroup);
        };
      });
    }
  };

  container.newPool = function() {
    var p = new Pool(container);
    pools.push(p);
    return p;
  };

  container.arrangePools = function() {
    // 14 days = 2 weeks
    var numPools = 14;
    // all two-week pools have a weight of 1.0
    var weight = 1.0;
    var cumWeight = weight * numPools;
    var totalPoolsHeight =
      container.height() - nav.axisHeight - statsHeight;
    poolScaleHeight = totalPoolsHeight/cumWeight;
    var actualPoolsHeight = 0;
    pools.forEach(function(pool) {
      pool.height(poolScaleHeight);
      actualPoolsHeight += pool.height();
      poolScaleHeight = pool.height();
    });
    var currentYPosition, nextBatchYPosition, pool;
    if (sortReverse) {
      currentYPosition = nav.axisHeight;
      nextBatchYPosition = currentYPosition - poolScaleHeight;
      for (var i = viewIndex; i >= 0; i--) {
        pool = pools[i];
        pool.yPosition(currentYPosition);
        currentYPosition += pool.height();
        pool.group().attr('transform', 'translate(0,' + pool.yPosition() + ')');
      }
      currentYPosition = nextBatchYPosition;
      for (var j = viewIndex + 1; j < pools.length; j++) {
        pool = pools[j];
        pool.yPosition(currentYPosition);
        currentYPosition -= pool.height();
        pool.group().attr('transform', 'translate(0,' + pool.yPosition() + ')');
      }
    }
    else {
      currentYPosition = container.height() - statsHeight - poolScaleHeight;
      nextBatchYPosition = currentYPosition + poolScaleHeight;
      for (var k = viewIndex; k < pools.length; k++) {
        pool = pools[k];
        pool.yPosition(currentYPosition);
        currentYPosition -= pool.height();
        pool.group().attr('transform', 'translate(0,' + pool.yPosition() + ')');
      }
      currentYPosition = nextBatchYPosition;
      for (var l = viewIndex - 1; l >= 0; l--) {
        pool = pools[l];
        pool.yPosition(currentYPosition);
        currentYPosition += pool.height();
        pool.group().attr('transform', 'translate(0,' + pool.yPosition() + ')');
      }
    }

    // setup stats group
    container.poolStats = new Pool(container);
    container.poolStats.id('poolStats', poolGroup).weight(1.0).height(statsHeight * (4/5));
    container.poolStats.group().attr({
      'transform': 'translate(' + axisGutter + ',' + (height - statsHeight) + ')'
    });
    container.poolStats.group().append('rect')
      .attr({
        'x': 0,
        'y': 0,
        'width': width - axisGutter - nav.navGutter,
        'height': statsHeight,
        'fill': 'white'
      });
  };

  container.clear = function() {
    emitter.removeAllListeners('numbers');
    container.currentTranslation(0).latestTranslation(0);
    var ids = ['#tidelinePools', '#tidelineXAxisGroup', '#tidelineYAxisGroup', '#tidelineScrollNav'];
    ids.forEach(function(id) {
      mainGroup.select(id).remove();
    });
    data = [];
    pools = [];

    return container;
  };

  container.hide = function() {
    d3.select('#' + id).classed('hidden', true);

    return container;
  };

  container.show = function() {
    d3.select('#' + id).classed('hidden', false);

    return container;
  };

  container.navString = function(a) {
    if (!arguments.length) {
      a = yScale.domain();
      cachedDomain = a;
    }
    if (sortReverse) {
      a.reverse();
      a[0].setUTCDate(a[0].getUTCDate() + 1);
    }
    else {
      a[0].setUTCDate(a[0].getUTCDate() + 1);
    }
    if (!d3.select('#' + id).classed('hidden')) {
      // domain should go from midnight to midnight, not noon to noon
      a[0].setUTCHours(a[0].getUTCHours() - 12);
      var topDate = a[0].toISOString().slice(0,10);
      a[1].setUTCHours(a[1].getUTCHours() + 12);
      var bottomDate = a[1].toISOString().slice(0,10);
      var midnight = 'T00:00:00.000Z';
      if ((topDate !== cachedDomain[0]) || (bottomDate !== cachedDomain[1])) {
        cachedDomain = [new Date(topDate + midnight), new Date(bottomDate + midnight)];
        emitter.emit('currentDomain', {
          'domain': cachedDomain,
          'startIndex': data[0].index
        });
      }
      emitter.emit('navigated', [a[0].toISOString(), a[1].toISOString()]);
    }
  };

  // getters only
  container.pools = function() {
    return pools;
  };

  container.poolGroup = function() {
    return poolGroup;
  };

  container.days = function() {
    return days;
  };

  container.daysGroup = function() {
    return daysGroup;
  };

  container.id = function() {
    return id;
  };

  container.axisGutter = function() {
    return axisGutter;
  };

  container.navGutter = function() {
    return nav.navGutter;
  };

  // chainable methods
  container.setup = function() {
    poolGroup = mainGroup.append('g').attr('id', 'tidelinePools');

    mainGroup.append('g')
      .attr('id', 'tidelineXAxisGroup')
      .append('rect')
      .attr({
        'id': 'xAxisInvisibleRect',
        'x': axisGutter,
        'height': nav.axisHeight,
        'width': width - axisGutter,
        'fill': 'white'
      });

    mainGroup.append('g')
      .attr('id', 'tidelineYAxisGroup')
      .append('rect')
      .attr({
        'id': 'yAxisInvisibleRect',
        'x': 0,
        'height': height,
        'width': axisGutter,
        'fill': 'white'
      });

    daysGroup = poolGroup.append('g').attr('id', 'daysGroup');

    scrollNav = mainGroup.append('g')
      .attr('class', 'y scroll')
      .attr('id', 'tidelineScrollNav');

    return container;
  };

  container.setAxes = function() {
    // set the domain and range for the two-week x-scale
    xScale.domain([0, MS_IN_24])
      .range([axisGutter + dataGutter, width - nav.navGutter - dataGutter]);
    xAxis = d3.svg.axis().scale(xScale).orient('top').outerTickSize(0).innerTickSize(15)
      .tickValues(function() {
        var a = [];
        for (var i = 0; i < 8; i++) {
          a.push((MS_IN_24/8) * i);
        }
        return a;
      })
      .tickFormat(function(d) {
        var hour = d/(MS_IN_24/24);
        if ((hour > 0) && (hour < 12)) {
          return hour + ' am';
        }
        else if (hour > 12) {
          return (hour - 12) + ' pm';
        }
        else if (hour === 0) {
          return '12 am';
        }
        else {
          return '12 pm';
        }
      });

    mainGroup.select('#tidelineXAxisGroup')
      .append('g')
      .attr('class', 'd3-x d3-axis')
      .attr('id', 'tidelineXAxis')
      .attr('transform', 'translate(0,' + (nav.axisHeight - 1) + ')')
      .call(xAxis);

    mainGroup.selectAll('#tidelineXAxis g.tick text').style('text-anchor', 'start').attr('transform', 'translate(5,15)');

    // set the domain and range for the main two-week y-scale
    yScale.domain(viewEndpoints)
      .range([nav.axisHeight, height - statsHeight])
      .ticks(d3.time.day.utc, 1);

    yAxis = d3.svg.axis().scale(yScale)
      .orient('left')
      .outerTickSize(0)
      .innerTickSize(dayTickSize)
      .tickFormat(d3.time.format.utc('%a'));

    mainGroup.select('#tidelineYAxisGroup')
      .append('g')
      .attr('class', 'd3-y d3-axis d3-day-axis')
      .attr('id', 'tidelineYAxis')
      .attr('transform', 'translate(' + (axisGutter - 1) + ',0)')
      .call(yAxis);

    container.dayAxisHacks();

    if (sortReverse) {
      var start = new Date(dataStartNoon);
      start.setUTCDate(start.getUTCDate() - 1);
      nav.scrollScale = d3.time.scale.utc()
          .domain([dataEndNoon, start])
          .range([nav.axisHeight + nav.scrollThumbRadius, height - statsHeight - nav.scrollThumbRadius]);
    }
    else {
      nav.scrollScale = d3.time.scale.utc()
        .domain([dataStartNoon, dataEndNoon])
        .range([nav.axisHeight + nav.scrollThumbRadius, height - statsHeight - nav.scrollThumbRadius]);
    }

    pools.forEach(function(pool) {
      pool.xScale(xScale.copy());
    });

    return container;
  };

  container.dayAxisHacks = function() {
    // TODO: demagicify all the magic numbers in this function
    var tickLabels = mainGroup.selectAll('.d3-day-axis').selectAll('.tick');

    tickLabels.selectAll('.d3-date').remove();

    var xPos = tickLabels.select('text').attr('x'), dy = tickLabels.select('text').attr('dy');

    tickLabels.append('text')
      .text(function(d) {
        return d3.time.format.utc('%b %-d')(d);
      })
      .attr({
        'x': xPos,
        'y': 0,
        'dy': dy,
        'class': 'd3-date',
        'text-anchor': 'end'
      });

    tickLabels.selectAll('text')
      .attr({
        'transform': function() {
          if (d3.select(this).classed('d3-date')) {
            return 'translate(' + (dayTickSize - 6) + ',8)';
          }
          else {
            return 'translate(' + (dayTickSize - 6) + ',-6)';
          }
        }
      })
      .classed('d3-weekend', function(d) {
        // Sunday is 0
        var date = d.getUTCDay();
        if ((date === 0) || (date === 6)) {
          return true;
        }
        else {
          return false;
        }
      });

    return container;
  };

  container.setNav = function() {
    var maxTranslation, minTranslation;
    if (sortReverse) {
      maxTranslation = yScale(dataStartNoon) - yScale(dataEndNoon) + poolScaleHeight + (14 - (viewIndex + 1)) * poolScaleHeight;
      minTranslation = (14 - (viewIndex + 1)) * poolScaleHeight;
    }
    else {
      maxTranslation = -yScale(dataStartNoon) + nav.axisHeight;
      minTranslation = -yScale(dataEndNoon) + nav.axisHeight;
    }
    nav.scroll = d3.behavior.zoom()
      .scaleExtent([1, 1])
      .y(yScale)
      .on('zoom', function() {
        var e = d3.event;
        if (e.translate[1] < minTranslation) {
          e.translate[1] = minTranslation;
        }
        else if (e.translate[1] > maxTranslation) {
          e.translate[1] = maxTranslation;
        }
        nav.scroll.translate([0, e.translate[1]]);
        mainGroup.select('.d3-y.d3-axis').call(yAxis);
        container.dayAxisHacks();
        for (var i = 0; i < pools.length; i++) {
          pools[i].scroll(e);
        }
        container.navString(yScale.domain());
        if (scrollHandleTrigger) {
          mainGroup.select('#scrollThumb').transition().ease('linear').attr('y', function(d) {
            if (sortReverse) {
              d.y = nav.scrollScale(yScale.domain()[1]);
            }
            else {
              d.y = nav.scrollScale(yScale.domain()[0]);
            }
            return d.y - nav.scrollThumbRadius;
          });
        }
      })
      .on('zoomend', function() {
        container.currentTranslation(nav.latestTranslation);
        scrollHandleTrigger = true;
      });

    mainGroup.call(nav.scroll);

    return container;
  };

  container.setScrollNav = function() {
    if (!lessThanTwoWeeks) {
      var translationAdjustment, yStart, xPos;
      if (sortReverse) {
        yStart = nav.scrollScale(viewEndpoints[1]);
        translationAdjustment = height - statsHeight;

        scrollNav.append('rect')
        .attr({
          'x': 0,
          'y': nav.scrollScale(dataEndNoon) - nav.scrollThumbRadius,
          'width': nav.navGutter,
          'height': height - nav.axisHeight,
          'fill': 'white',
          'id': 'scrollNavInvisibleRect'
        });

        xPos = nav.navGutter / 2;


        var start = new Date(dataStartNoon);
        start.setUTCDate(start.getUTCDate() - 1);

        scrollNav.attr('transform', 'translate(' + (width - nav.navGutter) + ',0)')
          .append('line')
          .attr({
            'x1': xPos,
            'x2': xPos,
            'y1': nav.scrollScale(dataEndNoon) - nav.scrollThumbRadius,
            'y2': nav.scrollScale(start) + nav.scrollThumbRadius
          });
      }
      else {
        yStart = nav.scrollScale(viewEndpoints[0]);
        translationAdjustment = nav.axisHeight;

        scrollNav.append('rect')
        .attr({
          'x': 0,
          'y': nav.scrollScale(dataStartNoon) - nav.scrollThumbRadius,
          'width': nav.navGutter,
          'height': height - nav.axisHeight,
          'fill': 'white',
          'id': 'scrollNavInvisibleRect'
        });

        xPos = nav.navGutter / 2;

        scrollNav.attr('transform', 'translate(' + (width - nav.navGutter) + ',0)')
          .append('line')
          .attr({
            'x1': xPos,
            'x2': xPos,
            'y1': nav.scrollScale(dataStartNoon) - nav.scrollThumbRadius,
            'y2': nav.scrollScale(dataEndNoon) + nav.scrollThumbRadius
          });
      }

      var dyLowest = nav.scrollScale.range()[1];
      var dyHighest = nav.scrollScale.range()[0];

      var drag = d3.behavior.drag()
        .origin(function(d) {
          return d;
        })
        .on('dragstart', function() {
          d3.event.sourceEvent.stopPropagation(); // silence the click-and-drag listener
        })
        .on('drag', function(d) {
          d.y += d3.event.dy;
          if (d.y > dyLowest) {
            d.y = dyLowest;
          }
          else if (d.y < dyHighest) {
            d.y = dyHighest;
          }
          d3.select(this).attr('y', function(d) { return d.y - nav.scrollThumbRadius; });
          var date = nav.scrollScale.invert(d.y);
          nav.currentTranslation -= yScale(date) - translationAdjustment;
          scrollHandleTrigger = false;
          nav.scroll.translate([0, nav.currentTranslation]);
          nav.scroll.event(mainGroup);
        });

      scrollNav.selectAll('image')
        .data([{'x': 0, 'y': yStart}])
        .enter()
        .append('image')
        .attr({
          'xlink:href': imagesBaseUrl + '/ux/scroll_thumb.svg',
          'x': xPos - nav.scrollThumbRadius,
          'y': function(d) {
            return d.y - nav.scrollThumbRadius;
          },
          'width': 2 * nav.scrollThumbRadius,
          'height': 2 * nav.scrollThumbRadius,
          'id': 'scrollThumb'
        })
        .call(drag);
    }

    return container;
  };

  // getters and setters
  container.width = function(x) {
    if (!arguments.length) return width;
    if (x >= minWidth) {
      width = x;
    }
    else {
      width = minWidth;
    }
    return container;
  };

  container.height = function(x) {
    if (!arguments.length) return height;
    var totalHeight = x + nav.axisHeight;
    if (totalHeight >= minHeight) {
      height = x;
    }
    else {
      height = minHeight;
    }
    return container;
  };

  container.imagesBaseUrl = function(x) {
    if (!arguments.length) return imagesBaseUrl;
    imagesBaseUrl = x;
    return container;
  };

  container.dataGutter = function(x) {
    if (!arguments.length) return dataGutter;
    dataGutter = x;
    return container;
  };

  container.latestTranslation = function(x) {
    if (!arguments.length) return nav.latestTranslation;
    nav.latestTranslation = x;
    return container;
  };

  container.currentTranslation = function(x) {
    if (!arguments.length) return nav.currentTranslation;
    nav.currentTranslation = x;
    return container;
  };

  container.sortReverse = function(b) {
    if (!arguments.length) return sortReverse;
    if (b === (true || false)) {
      sortReverse = b;
    }
    return container;
  };

  // data getters and setters
  container.data = function(a, viewEndDate) {
    if (!arguments.length) return data;

    data = a;

    var first = new Date(a[0].normalTime);
    var last = new Date(a[a.length - 1].normalTime);
    
    endpoints = [first, last];
    container.endpoints = endpoints;

    function createDay(d) {
      return new Date(d.toISOString().slice(0,11) + '00:00:00Z');
    }
    days = [];
    var firstDay = createDay(new Date(container.endpoints[0]));
    var lastDay = createDay(new Date(container.endpoints[1]));
    days.push(firstDay.toISOString().slice(0,10));
    var currentDay = firstDay;
    while (currentDay < lastDay) {
      var newDay = new Date(currentDay);
      newDay.setUTCDate(newDay.getUTCDate() + 1);
      days.push(newDay.toISOString().slice(0,10));
      currentDay = newDay;
    }

    if (days.length < 14) {
      var day = new Date(firstDay);
      // fill in previous days if less than two weeks data
      while (days.length < 14) {
        day.setUTCDate(day.getUTCDate() - 1);
        days.unshift(day.toISOString().slice(0,10));
        currentDay = day;
      }
      first = days[0];
      lessThanTwoWeeks = true;
    }

    dataStartNoon = new Date(first);
    dataStartNoon.setUTCHours(12);
    dataStartNoon.setUTCMinutes(0);
    dataStartNoon.setUTCSeconds(0);
    if (!sortReverse) {
      dataStartNoon.setUTCDate(dataStartNoon.getUTCDate() - 1);
    }

    var noon = '12:00:00Z';

    dataEndNoon = new Date(last);
    dataEndNoon.setUTCDate(dataEndNoon.getUTCDate() - 14);
    dataEndNoon = new Date(dataEndNoon.toISOString().slice(0,11) + noon);

    if (!viewEndDate) {
      viewEndDate = new Date(days[0]);
    } else {
      viewEndDate = new Date(viewEndDate);
    }

    var viewBeginning = new Date(viewEndDate);
    viewBeginning.setUTCDate(viewBeginning.getUTCDate() - 14);
    var firstDayInView;

    if (sortReverse) {
      this.days = days;

      firstDayInView = new Date(days[0]);
    }
    else {
      this.days = days.reverse();

      firstDayInView = new Date(days[days.length - 1]);
    }

    if (viewBeginning < firstDayInView) {
      firstDayInView.setUTCDate(firstDayInView.getUTCDate() - 1);
      viewBeginning = new Date(firstDayInView);
      viewEndDate = new Date(firstDayInView);
      viewEndDate.setUTCDate(viewEndDate.getUTCDate() + 14);
    }
    viewEndpoints = [new Date(viewBeginning.toISOString().slice(0,11) + noon), new Date(viewEndDate.toISOString().slice(0,11) + noon)];
    if (sortReverse) {
      viewEndpoints = viewEndpoints.reverse();
    }
    viewIndex = days.indexOf(viewEndDate.toISOString().slice(0,10));

    container.dataPerDay = [];

    this.days.forEach(function(day) {
      var thisDay = {
        'year': day.slice(0,4),
        'month': day.slice(5,7),
        'day': day.slice(8,10)
      };
      container.dataPerDay.push(_.filter(data, function(d) {
        var date = new Date(d.normalTime);
        if ((date.getUTCFullYear() === parseInt(thisDay.year, 10)) &&
          (date.getUTCMonth() + 1 === parseInt(thisDay.month, 10)) &&
          (date.getUTCDate() === parseInt(thisDay.day, 10))) {
          return d;
        }
      }));
    });
    
    return container;
  };

  return container;
};

},{"./lib/":14,"./pool":28}],31:[function(require,module,exports){
(function(exports){
crossfilter.version = "1.3.7";
function crossfilter_identity(d) {
  return d;
}
crossfilter.permute = permute;

function permute(array, index) {
  for (var i = 0, n = index.length, copy = new Array(n); i < n; ++i) {
    copy[i] = array[index[i]];
  }
  return copy;
}
var bisect = crossfilter.bisect = bisect_by(crossfilter_identity);

bisect.by = bisect_by;

function bisect_by(f) {

  // Locate the insertion point for x in a to maintain sorted order. The
  // arguments lo and hi may be used to specify a subset of the array which
  // should be considered; by default the entire array is used. If x is already
  // present in a, the insertion point will be before (to the left of) any
  // existing entries. The return value is suitable for use as the first
  // argument to `array.splice` assuming that a is already sorted.
  //
  // The returned insertion point i partitions the array a into two halves so
  // that all v < x for v in a[lo:i] for the left side and all v >= x for v in
  // a[i:hi] for the right side.
  function bisectLeft(a, x, lo, hi) {
    while (lo < hi) {
      var mid = lo + hi >>> 1;
      if (f(a[mid]) < x) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }

  // Similar to bisectLeft, but returns an insertion point which comes after (to
  // the right of) any existing entries of x in a.
  //
  // The returned insertion point i partitions the array into two halves so that
  // all v <= x for v in a[lo:i] for the left side and all v > x for v in
  // a[i:hi] for the right side.
  function bisectRight(a, x, lo, hi) {
    while (lo < hi) {
      var mid = lo + hi >>> 1;
      if (x < f(a[mid])) hi = mid;
      else lo = mid + 1;
    }
    return lo;
  }

  bisectRight.right = bisectRight;
  bisectRight.left = bisectLeft;
  return bisectRight;
}
var heap = crossfilter.heap = heap_by(crossfilter_identity);

heap.by = heap_by;

function heap_by(f) {

  // Builds a binary heap within the specified array a[lo:hi]. The heap has the
  // property such that the parent a[lo+i] is always less than or equal to its
  // two children: a[lo+2*i+1] and a[lo+2*i+2].
  function heap(a, lo, hi) {
    var n = hi - lo,
        i = (n >>> 1) + 1;
    while (--i > 0) sift(a, i, n, lo);
    return a;
  }

  // Sorts the specified array a[lo:hi] in descending order, assuming it is
  // already a heap.
  function sort(a, lo, hi) {
    var n = hi - lo,
        t;
    while (--n > 0) t = a[lo], a[lo] = a[lo + n], a[lo + n] = t, sift(a, 1, n, lo);
    return a;
  }

  // Sifts the element a[lo+i-1] down the heap, where the heap is the contiguous
  // slice of array a[lo:lo+n]. This method can also be used to update the heap
  // incrementally, without incurring the full cost of reconstructing the heap.
  function sift(a, i, n, lo) {
    var d = a[--lo + i],
        x = f(d),
        child;
    while ((child = i << 1) <= n) {
      if (child < n && f(a[lo + child]) > f(a[lo + child + 1])) child++;
      if (x <= f(a[lo + child])) break;
      a[lo + i] = a[lo + child];
      i = child;
    }
    a[lo + i] = d;
  }

  heap.sort = sort;
  return heap;
}
var heapselect = crossfilter.heapselect = heapselect_by(crossfilter_identity);

heapselect.by = heapselect_by;

function heapselect_by(f) {
  var heap = heap_by(f);

  // Returns a new array containing the top k elements in the array a[lo:hi].
  // The returned array is not sorted, but maintains the heap property. If k is
  // greater than hi - lo, then fewer than k elements will be returned. The
  // order of elements in a is unchanged by this operation.
  function heapselect(a, lo, hi, k) {
    var queue = new Array(k = Math.min(hi - lo, k)),
        min,
        i,
        x,
        d;

    for (i = 0; i < k; ++i) queue[i] = a[lo++];
    heap(queue, 0, k);

    if (lo < hi) {
      min = f(queue[0]);
      do {
        if (x = f(d = a[lo]) > min) {
          queue[0] = d;
          min = f(heap(queue, 0, k)[0]);
        }
      } while (++lo < hi);
    }

    return queue;
  }

  return heapselect;
}
var insertionsort = crossfilter.insertionsort = insertionsort_by(crossfilter_identity);

insertionsort.by = insertionsort_by;

function insertionsort_by(f) {

  function insertionsort(a, lo, hi) {
    for (var i = lo + 1; i < hi; ++i) {
      for (var j = i, t = a[i], x = f(t); j > lo && f(a[j - 1]) > x; --j) {
        a[j] = a[j - 1];
      }
      a[j] = t;
    }
    return a;
  }

  return insertionsort;
}
// Algorithm designed by Vladimir Yaroslavskiy.
// Implementation based on the Dart project; see lib/dart/LICENSE for details.

var quicksort = crossfilter.quicksort = quicksort_by(crossfilter_identity);

quicksort.by = quicksort_by;

function quicksort_by(f) {
  var insertionsort = insertionsort_by(f);

  function sort(a, lo, hi) {
    return (hi - lo < quicksort_sizeThreshold
        ? insertionsort
        : quicksort)(a, lo, hi);
  }

  function quicksort(a, lo, hi) {
    // Compute the two pivots by looking at 5 elements.
    var sixth = (hi - lo) / 6 | 0,
        i1 = lo + sixth,
        i5 = hi - 1 - sixth,
        i3 = lo + hi - 1 >> 1,  // The midpoint.
        i2 = i3 - sixth,
        i4 = i3 + sixth;

    var e1 = a[i1], x1 = f(e1),
        e2 = a[i2], x2 = f(e2),
        e3 = a[i3], x3 = f(e3),
        e4 = a[i4], x4 = f(e4),
        e5 = a[i5], x5 = f(e5);

    var t;

    // Sort the selected 5 elements using a sorting network.
    if (x1 > x2) t = e1, e1 = e2, e2 = t, t = x1, x1 = x2, x2 = t;
    if (x4 > x5) t = e4, e4 = e5, e5 = t, t = x4, x4 = x5, x5 = t;
    if (x1 > x3) t = e1, e1 = e3, e3 = t, t = x1, x1 = x3, x3 = t;
    if (x2 > x3) t = e2, e2 = e3, e3 = t, t = x2, x2 = x3, x3 = t;
    if (x1 > x4) t = e1, e1 = e4, e4 = t, t = x1, x1 = x4, x4 = t;
    if (x3 > x4) t = e3, e3 = e4, e4 = t, t = x3, x3 = x4, x4 = t;
    if (x2 > x5) t = e2, e2 = e5, e5 = t, t = x2, x2 = x5, x5 = t;
    if (x2 > x3) t = e2, e2 = e3, e3 = t, t = x2, x2 = x3, x3 = t;
    if (x4 > x5) t = e4, e4 = e5, e5 = t, t = x4, x4 = x5, x5 = t;

    var pivot1 = e2, pivotValue1 = x2,
        pivot2 = e4, pivotValue2 = x4;

    // e2 and e4 have been saved in the pivot variables. They will be written
    // back, once the partitioning is finished.
    a[i1] = e1;
    a[i2] = a[lo];
    a[i3] = e3;
    a[i4] = a[hi - 1];
    a[i5] = e5;

    var less = lo + 1,   // First element in the middle partition.
        great = hi - 2;  // Last element in the middle partition.

    // Note that for value comparison, <, <=, >= and > coerce to a primitive via
    // Object.prototype.valueOf; == and === do not, so in order to be consistent
    // with natural order (such as for Date objects), we must do two compares.
    var pivotsEqual = pivotValue1 <= pivotValue2 && pivotValue1 >= pivotValue2;
    if (pivotsEqual) {

      // Degenerated case where the partitioning becomes a dutch national flag
      // problem.
      //
      // [ |  < pivot  | == pivot | unpartitioned | > pivot  | ]
      //  ^             ^          ^             ^            ^
      // left         less         k           great         right
      //
      // a[left] and a[right] are undefined and are filled after the
      // partitioning.
      //
      // Invariants:
      //   1) for x in ]left, less[ : x < pivot.
      //   2) for x in [less, k[ : x == pivot.
      //   3) for x in ]great, right[ : x > pivot.
      for (var k = less; k <= great; ++k) {
        var ek = a[k], xk = f(ek);
        if (xk < pivotValue1) {
          if (k !== less) {
            a[k] = a[less];
            a[less] = ek;
          }
          ++less;
        } else if (xk > pivotValue1) {

          // Find the first element <= pivot in the range [k - 1, great] and
          // put [:ek:] there. We know that such an element must exist:
          // When k == less, then el3 (which is equal to pivot) lies in the
          // interval. Otherwise a[k - 1] == pivot and the search stops at k-1.
          // Note that in the latter case invariant 2 will be violated for a
          // short amount of time. The invariant will be restored when the
          // pivots are put into their final positions.
          while (true) {
            var greatValue = f(a[great]);
            if (greatValue > pivotValue1) {
              great--;
              // This is the only location in the while-loop where a new
              // iteration is started.
              continue;
            } else if (greatValue < pivotValue1) {
              // Triple exchange.
              a[k] = a[less];
              a[less++] = a[great];
              a[great--] = ek;
              break;
            } else {
              a[k] = a[great];
              a[great--] = ek;
              // Note: if great < k then we will exit the outer loop and fix
              // invariant 2 (which we just violated).
              break;
            }
          }
        }
      }
    } else {

      // We partition the list into three parts:
      //  1. < pivot1
      //  2. >= pivot1 && <= pivot2
      //  3. > pivot2
      //
      // During the loop we have:
      // [ | < pivot1 | >= pivot1 && <= pivot2 | unpartitioned  | > pivot2  | ]
      //  ^            ^                        ^              ^             ^
      // left         less                     k              great        right
      //
      // a[left] and a[right] are undefined and are filled after the
      // partitioning.
      //
      // Invariants:
      //   1. for x in ]left, less[ : x < pivot1
      //   2. for x in [less, k[ : pivot1 <= x && x <= pivot2
      //   3. for x in ]great, right[ : x > pivot2
      for (var k = less; k <= great; k++) {
        var ek = a[k], xk = f(ek);
        if (xk < pivotValue1) {
          if (k !== less) {
            a[k] = a[less];
            a[less] = ek;
          }
          ++less;
        } else {
          if (xk > pivotValue2) {
            while (true) {
              var greatValue = f(a[great]);
              if (greatValue > pivotValue2) {
                great--;
                if (great < k) break;
                // This is the only location inside the loop where a new
                // iteration is started.
                continue;
              } else {
                // a[great] <= pivot2.
                if (greatValue < pivotValue1) {
                  // Triple exchange.
                  a[k] = a[less];
                  a[less++] = a[great];
                  a[great--] = ek;
                } else {
                  // a[great] >= pivot1.
                  a[k] = a[great];
                  a[great--] = ek;
                }
                break;
              }
            }
          }
        }
      }
    }

    // Move pivots into their final positions.
    // We shrunk the list from both sides (a[left] and a[right] have
    // meaningless values in them) and now we move elements from the first
    // and third partition into these locations so that we can store the
    // pivots.
    a[lo] = a[less - 1];
    a[less - 1] = pivot1;
    a[hi - 1] = a[great + 1];
    a[great + 1] = pivot2;

    // The list is now partitioned into three partitions:
    // [ < pivot1   | >= pivot1 && <= pivot2   |  > pivot2   ]
    //  ^            ^                        ^             ^
    // left         less                     great        right

    // Recursive descent. (Don't include the pivot values.)
    sort(a, lo, less - 1);
    sort(a, great + 2, hi);

    if (pivotsEqual) {
      // All elements in the second partition are equal to the pivot. No
      // need to sort them.
      return a;
    }

    // In theory it should be enough to call _doSort recursively on the second
    // partition.
    // The Android source however removes the pivot elements from the recursive
    // call if the second partition is too large (more than 2/3 of the list).
    if (less < i1 && great > i5) {
      var lessValue, greatValue;
      while ((lessValue = f(a[less])) <= pivotValue1 && lessValue >= pivotValue1) ++less;
      while ((greatValue = f(a[great])) <= pivotValue2 && greatValue >= pivotValue2) --great;

      // Copy paste of the previous 3-way partitioning with adaptions.
      //
      // We partition the list into three parts:
      //  1. == pivot1
      //  2. > pivot1 && < pivot2
      //  3. == pivot2
      //
      // During the loop we have:
      // [ == pivot1 | > pivot1 && < pivot2 | unpartitioned  | == pivot2 ]
      //              ^                      ^              ^
      //            less                     k              great
      //
      // Invariants:
      //   1. for x in [ *, less[ : x == pivot1
      //   2. for x in [less, k[ : pivot1 < x && x < pivot2
      //   3. for x in ]great, * ] : x == pivot2
      for (var k = less; k <= great; k++) {
        var ek = a[k], xk = f(ek);
        if (xk <= pivotValue1 && xk >= pivotValue1) {
          if (k !== less) {
            a[k] = a[less];
            a[less] = ek;
          }
          less++;
        } else {
          if (xk <= pivotValue2 && xk >= pivotValue2) {
            while (true) {
              var greatValue = f(a[great]);
              if (greatValue <= pivotValue2 && greatValue >= pivotValue2) {
                great--;
                if (great < k) break;
                // This is the only location inside the loop where a new
                // iteration is started.
                continue;
              } else {
                // a[great] < pivot2.
                if (greatValue < pivotValue1) {
                  // Triple exchange.
                  a[k] = a[less];
                  a[less++] = a[great];
                  a[great--] = ek;
                } else {
                  // a[great] == pivot1.
                  a[k] = a[great];
                  a[great--] = ek;
                }
                break;
              }
            }
          }
        }
      }
    }

    // The second partition has now been cleared of pivot elements and looks
    // as follows:
    // [  *  |  > pivot1 && < pivot2  | * ]
    //        ^                      ^
    //       less                  great
    // Sort the second partition using recursive descent.

    // The second partition looks as follows:
    // [  *  |  >= pivot1 && <= pivot2  | * ]
    //        ^                        ^
    //       less                    great
    // Simply sort it by recursive descent.

    return sort(a, less, great + 1);
  }

  return sort;
}

var quicksort_sizeThreshold = 32;
var crossfilter_array8 = crossfilter_arrayUntyped,
    crossfilter_array16 = crossfilter_arrayUntyped,
    crossfilter_array32 = crossfilter_arrayUntyped,
    crossfilter_arrayLengthen = crossfilter_arrayLengthenUntyped,
    crossfilter_arrayWiden = crossfilter_arrayWidenUntyped;

if (typeof Uint8Array !== "undefined") {
  crossfilter_array8 = function(n) { return new Uint8Array(n); };
  crossfilter_array16 = function(n) { return new Uint16Array(n); };
  crossfilter_array32 = function(n) { return new Uint32Array(n); };

  crossfilter_arrayLengthen = function(array, length) {
    if (array.length >= length) return array;
    var copy = new array.constructor(length);
    copy.set(array);
    return copy;
  };

  crossfilter_arrayWiden = function(array, width) {
    var copy;
    switch (width) {
      case 16: copy = crossfilter_array16(array.length); break;
      case 32: copy = crossfilter_array32(array.length); break;
      default: throw new Error("invalid array width!");
    }
    copy.set(array);
    return copy;
  };
}

function crossfilter_arrayUntyped(n) {
  var array = new Array(n), i = -1;
  while (++i < n) array[i] = 0;
  return array;
}

function crossfilter_arrayLengthenUntyped(array, length) {
  var n = array.length;
  while (n < length) array[n++] = 0;
  return array;
}

function crossfilter_arrayWidenUntyped(array, width) {
  if (width > 32) throw new Error("invalid array width!");
  return array;
}
function crossfilter_filterExact(bisect, value) {
  return function(values) {
    var n = values.length;
    return [bisect.left(values, value, 0, n), bisect.right(values, value, 0, n)];
  };
}

function crossfilter_filterRange(bisect, range) {
  var min = range[0],
      max = range[1];
  return function(values) {
    var n = values.length;
    return [bisect.left(values, min, 0, n), bisect.left(values, max, 0, n)];
  };
}

function crossfilter_filterAll(values) {
  return [0, values.length];
}
function crossfilter_null() {
  return null;
}
function crossfilter_zero() {
  return 0;
}
function crossfilter_reduceIncrement(p) {
  return p + 1;
}

function crossfilter_reduceDecrement(p) {
  return p - 1;
}

function crossfilter_reduceAdd(f) {
  return function(p, v) {
    return p + +f(v);
  };
}

function crossfilter_reduceSubtract(f) {
  return function(p, v) {
    return p - f(v);
  };
}
exports.crossfilter = crossfilter;

function crossfilter() {
  var crossfilter = {
    add: add,
    remove: removeData,
    dimension: dimension,
    groupAll: groupAll,
    size: size
  };

  var data = [], // the records
      n = 0, // the number of records; data.length
      m = 0, // a bit mask representing which dimensions are in use
      M = 8, // number of dimensions that can fit in `filters`
      filters = crossfilter_array8(0), // M bits per record; 1 is filtered out
      filterListeners = [], // when the filters change
      dataListeners = [], // when data is added
      removeDataListeners = []; // when data is removed

  // Adds the specified new records to this crossfilter.
  function add(newData) {
    var n0 = n,
        n1 = newData.length;

    // If there's actually new data to add…
    // Merge the new data into the existing data.
    // Lengthen the filter bitset to handle the new records.
    // Notify listeners (dimensions and groups) that new data is available.
    if (n1) {
      data = data.concat(newData);
      filters = crossfilter_arrayLengthen(filters, n += n1);
      dataListeners.forEach(function(l) { l(newData, n0, n1); });
    }

    return crossfilter;
  }

  // Removes all records that match the current filters.
  function removeData() {
    var newIndex = crossfilter_index(n, n),
        removed = [];
    for (var i = 0, j = 0; i < n; ++i) {
      if (filters[i]) newIndex[i] = j++;
      else removed.push(i);
    }

    // Remove all matching records from groups.
    filterListeners.forEach(function(l) { l(0, [], removed); });

    // Update indexes.
    removeDataListeners.forEach(function(l) { l(newIndex); });

    // Remove old filters and data by overwriting.
    for (var i = 0, j = 0, k; i < n; ++i) {
      if (k = filters[i]) {
        if (i !== j) filters[j] = k, data[j] = data[i];
        ++j;
      }
    }
    data.length = j;
    while (n > j) filters[--n] = 0;
  }

  // Adds a new dimension with the specified value accessor function.
  function dimension(value) {
    var dimension = {
      filter: filter,
      filterExact: filterExact,
      filterRange: filterRange,
      filterFunction: filterFunction,
      filterAll: filterAll,
      top: top,
      bottom: bottom,
      group: group,
      groupAll: groupAll,
      dispose: dispose,
      remove: dispose // for backwards-compatibility
    };

    var one = ~m & -~m, // lowest unset bit as mask, e.g., 00001000
        zero = ~one, // inverted one, e.g., 11110111
        values, // sorted, cached array
        index, // value rank ↦ object id
        newValues, // temporary array storing newly-added values
        newIndex, // temporary array storing newly-added index
        sort = quicksort_by(function(i) { return newValues[i]; }),
        refilter = crossfilter_filterAll, // for recomputing filter
        refilterFunction, // the custom filter function in use
        indexListeners = [], // when data is added
        dimensionGroups = [],
        lo0 = 0,
        hi0 = 0;

    // Updating a dimension is a two-stage process. First, we must update the
    // associated filters for the newly-added records. Once all dimensions have
    // updated their filters, the groups are notified to update.
    dataListeners.unshift(preAdd);
    dataListeners.push(postAdd);

    removeDataListeners.push(removeData);

    // Incorporate any existing data into this dimension, and make sure that the
    // filter bitset is wide enough to handle the new dimension.
    m |= one;
    if (M >= 32 ? !one : m & (1 << M) - 1) {
      filters = crossfilter_arrayWiden(filters, M <<= 1);
    }
    preAdd(data, 0, n);
    postAdd(data, 0, n);

    // Incorporates the specified new records into this dimension.
    // This function is responsible for updating filters, values, and index.
    function preAdd(newData, n0, n1) {

      // Permute new values into natural order using a sorted index.
      newValues = newData.map(value);
      newIndex = sort(crossfilter_range(n1), 0, n1);
      newValues = permute(newValues, newIndex);

      // Bisect newValues to determine which new records are selected.
      var bounds = refilter(newValues), lo1 = bounds[0], hi1 = bounds[1], i;
      if (refilterFunction) {
        for (i = 0; i < n1; ++i) {
          if (!refilterFunction(newValues[i], i)) filters[newIndex[i] + n0] |= one;
        }
      } else {
        for (i = 0; i < lo1; ++i) filters[newIndex[i] + n0] |= one;
        for (i = hi1; i < n1; ++i) filters[newIndex[i] + n0] |= one;
      }

      // If this dimension previously had no data, then we don't need to do the
      // more expensive merge operation; use the new values and index as-is.
      if (!n0) {
        values = newValues;
        index = newIndex;
        lo0 = lo1;
        hi0 = hi1;
        return;
      }

      var oldValues = values,
          oldIndex = index,
          i0 = 0,
          i1 = 0;

      // Otherwise, create new arrays into which to merge new and old.
      values = new Array(n);
      index = crossfilter_index(n, n);

      // Merge the old and new sorted values, and old and new index.
      for (i = 0; i0 < n0 && i1 < n1; ++i) {
        if (oldValues[i0] < newValues[i1]) {
          values[i] = oldValues[i0];
          index[i] = oldIndex[i0++];
        } else {
          values[i] = newValues[i1];
          index[i] = newIndex[i1++] + n0;
        }
      }

      // Add any remaining old values.
      for (; i0 < n0; ++i0, ++i) {
        values[i] = oldValues[i0];
        index[i] = oldIndex[i0];
      }

      // Add any remaining new values.
      for (; i1 < n1; ++i1, ++i) {
        values[i] = newValues[i1];
        index[i] = newIndex[i1] + n0;
      }

      // Bisect again to recompute lo0 and hi0.
      bounds = refilter(values), lo0 = bounds[0], hi0 = bounds[1];
    }

    // When all filters have updated, notify index listeners of the new values.
    function postAdd(newData, n0, n1) {
      indexListeners.forEach(function(l) { l(newValues, newIndex, n0, n1); });
      newValues = newIndex = null;
    }

    function removeData(reIndex) {
      for (var i = 0, j = 0, k; i < n; ++i) {
        if (filters[k = index[i]]) {
          if (i !== j) values[j] = values[i];
          index[j] = reIndex[k];
          ++j;
        }
      }
      values.length = j;
      while (j < n) index[j++] = 0;

      // Bisect again to recompute lo0 and hi0.
      var bounds = refilter(values);
      lo0 = bounds[0], hi0 = bounds[1];
    }

    // Updates the selected values based on the specified bounds [lo, hi].
    // This implementation is used by all the public filter methods.
    function filterIndexBounds(bounds) {
      var lo1 = bounds[0],
          hi1 = bounds[1];

      if (refilterFunction) {
        refilterFunction = null;
        filterIndexFunction(function(d, i) { return lo1 <= i && i < hi1; });
        lo0 = lo1;
        hi0 = hi1;
        return dimension;
      }

      var i,
          j,
          k,
          added = [],
          removed = [];

      // Fast incremental update based on previous lo index.
      if (lo1 < lo0) {
        for (i = lo1, j = Math.min(lo0, hi1); i < j; ++i) {
          filters[k = index[i]] ^= one;
          added.push(k);
        }
      } else if (lo1 > lo0) {
        for (i = lo0, j = Math.min(lo1, hi0); i < j; ++i) {
          filters[k = index[i]] ^= one;
          removed.push(k);
        }
      }

      // Fast incremental update based on previous hi index.
      if (hi1 > hi0) {
        for (i = Math.max(lo1, hi0), j = hi1; i < j; ++i) {
          filters[k = index[i]] ^= one;
          added.push(k);
        }
      } else if (hi1 < hi0) {
        for (i = Math.max(lo0, hi1), j = hi0; i < j; ++i) {
          filters[k = index[i]] ^= one;
          removed.push(k);
        }
      }

      lo0 = lo1;
      hi0 = hi1;
      filterListeners.forEach(function(l) { l(one, added, removed); });
      return dimension;
    }

    // Filters this dimension using the specified range, value, or null.
    // If the range is null, this is equivalent to filterAll.
    // If the range is an array, this is equivalent to filterRange.
    // Otherwise, this is equivalent to filterExact.
    function filter(range) {
      return range == null
          ? filterAll() : Array.isArray(range)
          ? filterRange(range) : typeof range === "function"
          ? filterFunction(range)
          : filterExact(range);
    }

    // Filters this dimension to select the exact value.
    function filterExact(value) {
      return filterIndexBounds((refilter = crossfilter_filterExact(bisect, value))(values));
    }

    // Filters this dimension to select the specified range [lo, hi].
    // The lower bound is inclusive, and the upper bound is exclusive.
    function filterRange(range) {
      return filterIndexBounds((refilter = crossfilter_filterRange(bisect, range))(values));
    }

    // Clears any filters on this dimension.
    function filterAll() {
      return filterIndexBounds((refilter = crossfilter_filterAll)(values));
    }

    // Filters this dimension using an arbitrary function.
    function filterFunction(f) {
      refilter = crossfilter_filterAll;

      filterIndexFunction(refilterFunction = f);

      lo0 = 0;
      hi0 = n;

      return dimension;
    }

    function filterIndexFunction(f) {
      var i,
          k,
          x,
          added = [],
          removed = [];

      for (i = 0; i < n; ++i) {
        if (!(filters[k = index[i]] & one) ^ (x = f(values[i], i))) {
          if (x) filters[k] &= zero, added.push(k);
          else filters[k] |= one, removed.push(k);
        }
      }
      filterListeners.forEach(function(l) { l(one, added, removed); });
    }

    // Returns the top K selected records based on this dimension's order.
    // Note: observes this dimension's filter, unlike group and groupAll.
    function top(k) {
      var array = [],
          i = hi0,
          j;

      while (--i >= lo0 && k > 0) {
        if (!filters[j = index[i]]) {
          array.push(data[j]);
          --k;
        }
      }

      return array;
    }

    // Returns the bottom K selected records based on this dimension's order.
    // Note: observes this dimension's filter, unlike group and groupAll.
    function bottom(k) {
      var array = [],
          i = lo0,
          j;

      while (i < hi0 && k > 0) {
        if (!filters[j = index[i]]) {
          array.push(data[j]);
          --k;
        }
        i++;
      }

      return array;
    }

    // Adds a new group to this dimension, using the specified key function.
    function group(key) {
      var group = {
        top: top,
        all: all,
        reduce: reduce,
        reduceCount: reduceCount,
        reduceSum: reduceSum,
        order: order,
        orderNatural: orderNatural,
        size: size,
        dispose: dispose,
        remove: dispose // for backwards-compatibility
      };

      // Ensure that this group will be removed when the dimension is removed.
      dimensionGroups.push(group);

      var groups, // array of {key, value}
          groupIndex, // object id ↦ group id
          groupWidth = 8,
          groupCapacity = crossfilter_capacity(groupWidth),
          k = 0, // cardinality
          select,
          heap,
          reduceAdd,
          reduceRemove,
          reduceInitial,
          update = crossfilter_null,
          reset = crossfilter_null,
          resetNeeded = true;

      if (arguments.length < 1) key = crossfilter_identity;

      // The group listens to the crossfilter for when any dimension changes, so
      // that it can update the associated reduce values. It must also listen to
      // the parent dimension for when data is added, and compute new keys.
      filterListeners.push(update);
      indexListeners.push(add);
      removeDataListeners.push(removeData);

      // Incorporate any existing data into the grouping.
      add(values, index, 0, n);

      // Incorporates the specified new values into this group.
      // This function is responsible for updating groups and groupIndex.
      function add(newValues, newIndex, n0, n1) {
        var oldGroups = groups,
            reIndex = crossfilter_index(k, groupCapacity),
            add = reduceAdd,
            initial = reduceInitial,
            k0 = k, // old cardinality
            i0 = 0, // index of old group
            i1 = 0, // index of new record
            j, // object id
            g0, // old group
            x0, // old key
            x1, // new key
            g, // group to add
            x; // key of group to add

        // If a reset is needed, we don't need to update the reduce values.
        if (resetNeeded) add = initial = crossfilter_null;

        // Reset the new groups (k is a lower bound).
        // Also, make sure that groupIndex exists and is long enough.
        groups = new Array(k), k = 0;
        groupIndex = k0 > 1 ? crossfilter_arrayLengthen(groupIndex, n) : crossfilter_index(n, groupCapacity);

        // Get the first old key (x0 of g0), if it exists.
        if (k0) x0 = (g0 = oldGroups[0]).key;

        // Find the first new key (x1), skipping NaN keys.
        while (i1 < n1 && !((x1 = key(newValues[i1])) >= x1)) ++i1;

        // While new keys remain…
        while (i1 < n1) {

          // Determine the lesser of the two current keys; new and old.
          // If there are no old keys remaining, then always add the new key.
          if (g0 && x0 <= x1) {
            g = g0, x = x0;

            // Record the new index of the old group.
            reIndex[i0] = k;

            // Retrieve the next old key.
            if (g0 = oldGroups[++i0]) x0 = g0.key;
          } else {
            g = {key: x1, value: initial()}, x = x1;
          }

          // Add the lesser group.
          groups[k] = g;

          // Add any selected records belonging to the added group, while
          // advancing the new key and populating the associated group index.
          while (!(x1 > x)) {
            groupIndex[j = newIndex[i1] + n0] = k;
            if (!(filters[j] & zero)) g.value = add(g.value, data[j]);
            if (++i1 >= n1) break;
            x1 = key(newValues[i1]);
          }

          groupIncrement();
        }

        // Add any remaining old groups that were greater than all new keys.
        // No incremental reduce is needed; these groups have no new records.
        // Also record the new index of the old group.
        while (i0 < k0) {
          groups[reIndex[i0] = k] = oldGroups[i0++];
          groupIncrement();
        }

        // If we added any new groups before any old groups,
        // update the group index of all the old records.
        if (k > i0) for (i0 = 0; i0 < n0; ++i0) {
          groupIndex[i0] = reIndex[groupIndex[i0]];
        }

        // Modify the update and reset behavior based on the cardinality.
        // If the cardinality is less than or equal to one, then the groupIndex
        // is not needed. If the cardinality is zero, then there are no records
        // and therefore no groups to update or reset. Note that we also must
        // change the registered listener to point to the new method.
        j = filterListeners.indexOf(update);
        if (k > 1) {
          update = updateMany;
          reset = resetMany;
        } else {
          if (k === 1) {
            update = updateOne;
            reset = resetOne;
          } else {
            update = crossfilter_null;
            reset = crossfilter_null;
          }
          groupIndex = null;
        }
        filterListeners[j] = update;

        // Count the number of added groups,
        // and widen the group index as needed.
        function groupIncrement() {
          if (++k === groupCapacity) {
            reIndex = crossfilter_arrayWiden(reIndex, groupWidth <<= 1);
            groupIndex = crossfilter_arrayWiden(groupIndex, groupWidth);
            groupCapacity = crossfilter_capacity(groupWidth);
          }
        }
      }

      function removeData() {
        if (k > 1) {
          var oldK = k,
              oldGroups = groups,
              seenGroups = crossfilter_index(oldK, oldK);

          // Filter out non-matches by copying matching group index entries to
          // the beginning of the array.
          for (var i = 0, j = 0; i < n; ++i) {
            if (filters[i]) {
              seenGroups[groupIndex[j] = groupIndex[i]] = 1;
              ++j;
            }
          }

          // Reassemble groups including only those groups that were referred
          // to by matching group index entries.  Note the new group index in
          // seenGroups.
          groups = [], k = 0;
          for (i = 0; i < oldK; ++i) {
            if (seenGroups[i]) {
              seenGroups[i] = k++;
              groups.push(oldGroups[i]);
            }
          }

          if (k > 1) {
            // Reindex the group index using seenGroups to find the new index.
            for (var i = 0; i < j; ++i) groupIndex[i] = seenGroups[groupIndex[i]];
          } else {
            groupIndex = null;
          }
          filterListeners[filterListeners.indexOf(update)] = k > 1
              ? (reset = resetMany, update = updateMany)
              : k === 1 ? (reset = resetOne, update = updateOne)
              : reset = update = crossfilter_null;
        } else if (k === 1) {
          for (var i = 0; i < n; ++i) if (filters[i]) return;
          groups = [], k = 0;
          filterListeners[filterListeners.indexOf(update)] =
          update = reset = crossfilter_null;
        }
      }

      // Reduces the specified selected or deselected records.
      // This function is only used when the cardinality is greater than 1.
      function updateMany(filterOne, added, removed) {
        if (filterOne === one || resetNeeded) return;

        var i,
            k,
            n,
            g;

        // Add the added values.
        for (i = 0, n = added.length; i < n; ++i) {
          if (!(filters[k = added[i]] & zero)) {
            g = groups[groupIndex[k]];
            g.value = reduceAdd(g.value, data[k]);
          }
        }

        // Remove the removed values.
        for (i = 0, n = removed.length; i < n; ++i) {
          if ((filters[k = removed[i]] & zero) === filterOne) {
            g = groups[groupIndex[k]];
            g.value = reduceRemove(g.value, data[k]);
          }
        }
      }

      // Reduces the specified selected or deselected records.
      // This function is only used when the cardinality is 1.
      function updateOne(filterOne, added, removed) {
        if (filterOne === one || resetNeeded) return;

        var i,
            k,
            n,
            g = groups[0];

        // Add the added values.
        for (i = 0, n = added.length; i < n; ++i) {
          if (!(filters[k = added[i]] & zero)) {
            g.value = reduceAdd(g.value, data[k]);
          }
        }

        // Remove the removed values.
        for (i = 0, n = removed.length; i < n; ++i) {
          if ((filters[k = removed[i]] & zero) === filterOne) {
            g.value = reduceRemove(g.value, data[k]);
          }
        }
      }

      // Recomputes the group reduce values from scratch.
      // This function is only used when the cardinality is greater than 1.
      function resetMany() {
        var i,
            g;

        // Reset all group values.
        for (i = 0; i < k; ++i) {
          groups[i].value = reduceInitial();
        }

        // Add any selected records.
        for (i = 0; i < n; ++i) {
          if (!(filters[i] & zero)) {
            g = groups[groupIndex[i]];
            g.value = reduceAdd(g.value, data[i]);
          }
        }
      }

      // Recomputes the group reduce values from scratch.
      // This function is only used when the cardinality is 1.
      function resetOne() {
        var i,
            g = groups[0];

        // Reset the singleton group values.
        g.value = reduceInitial();

        // Add any selected records.
        for (i = 0; i < n; ++i) {
          if (!(filters[i] & zero)) {
            g.value = reduceAdd(g.value, data[i]);
          }
        }
      }

      // Returns the array of group values, in the dimension's natural order.
      function all() {
        if (resetNeeded) reset(), resetNeeded = false;
        return groups;
      }

      // Returns a new array containing the top K group values, in reduce order.
      function top(k) {
        var top = select(all(), 0, groups.length, k);
        return heap.sort(top, 0, top.length);
      }

      // Sets the reduce behavior for this group to use the specified functions.
      // This method lazily recomputes the reduce values, waiting until needed.
      function reduce(add, remove, initial) {
        reduceAdd = add;
        reduceRemove = remove;
        reduceInitial = initial;
        resetNeeded = true;
        return group;
      }

      // A convenience method for reducing by count.
      function reduceCount() {
        return reduce(crossfilter_reduceIncrement, crossfilter_reduceDecrement, crossfilter_zero);
      }

      // A convenience method for reducing by sum(value).
      function reduceSum(value) {
        return reduce(crossfilter_reduceAdd(value), crossfilter_reduceSubtract(value), crossfilter_zero);
      }

      // Sets the reduce order, using the specified accessor.
      function order(value) {
        select = heapselect_by(valueOf);
        heap = heap_by(valueOf);
        function valueOf(d) { return value(d.value); }
        return group;
      }

      // A convenience method for natural ordering by reduce value.
      function orderNatural() {
        return order(crossfilter_identity);
      }

      // Returns the cardinality of this group, irrespective of any filters.
      function size() {
        return k;
      }

      // Removes this group and associated event listeners.
      function dispose() {
        var i = filterListeners.indexOf(update);
        if (i >= 0) filterListeners.splice(i, 1);
        i = indexListeners.indexOf(add);
        if (i >= 0) indexListeners.splice(i, 1);
        i = removeDataListeners.indexOf(removeData);
        if (i >= 0) removeDataListeners.splice(i, 1);
        return group;
      }

      return reduceCount().orderNatural();
    }

    // A convenience function for generating a singleton group.
    function groupAll() {
      var g = group(crossfilter_null), all = g.all;
      delete g.all;
      delete g.top;
      delete g.order;
      delete g.orderNatural;
      delete g.size;
      g.value = function() { return all()[0].value; };
      return g;
    }

    // Removes this dimension and associated groups and event listeners.
    function dispose() {
      dimensionGroups.forEach(function(group) { group.dispose(); });
      var i = dataListeners.indexOf(preAdd);
      if (i >= 0) dataListeners.splice(i, 1);
      i = dataListeners.indexOf(postAdd);
      if (i >= 0) dataListeners.splice(i, 1);
      i = removeDataListeners.indexOf(removeData);
      if (i >= 0) removeDataListeners.splice(i, 1);
      for (i = 0; i < n; ++i) filters[i] &= zero;
      m &= zero;
      return dimension;
    }

    return dimension;
  }

  // A convenience method for groupAll on a dummy dimension.
  // This implementation can be optimized since it always has cardinality 1.
  function groupAll() {
    var group = {
      reduce: reduce,
      reduceCount: reduceCount,
      reduceSum: reduceSum,
      value: value,
      dispose: dispose,
      remove: dispose // for backwards-compatibility
    };

    var reduceValue,
        reduceAdd,
        reduceRemove,
        reduceInitial,
        resetNeeded = true;

    // The group listens to the crossfilter for when any dimension changes, so
    // that it can update the reduce value. It must also listen to the parent
    // dimension for when data is added.
    filterListeners.push(update);
    dataListeners.push(add);

    // For consistency; actually a no-op since resetNeeded is true.
    add(data, 0, n);

    // Incorporates the specified new values into this group.
    function add(newData, n0) {
      var i;

      if (resetNeeded) return;

      // Add the added values.
      for (i = n0; i < n; ++i) {
        if (!filters[i]) {
          reduceValue = reduceAdd(reduceValue, data[i]);
        }
      }
    }

    // Reduces the specified selected or deselected records.
    function update(filterOne, added, removed) {
      var i,
          k,
          n;

      if (resetNeeded) return;

      // Add the added values.
      for (i = 0, n = added.length; i < n; ++i) {
        if (!filters[k = added[i]]) {
          reduceValue = reduceAdd(reduceValue, data[k]);
        }
      }

      // Remove the removed values.
      for (i = 0, n = removed.length; i < n; ++i) {
        if (filters[k = removed[i]] === filterOne) {
          reduceValue = reduceRemove(reduceValue, data[k]);
        }
      }
    }

    // Recomputes the group reduce value from scratch.
    function reset() {
      var i;

      reduceValue = reduceInitial();

      for (i = 0; i < n; ++i) {
        if (!filters[i]) {
          reduceValue = reduceAdd(reduceValue, data[i]);
        }
      }
    }

    // Sets the reduce behavior for this group to use the specified functions.
    // This method lazily recomputes the reduce value, waiting until needed.
    function reduce(add, remove, initial) {
      reduceAdd = add;
      reduceRemove = remove;
      reduceInitial = initial;
      resetNeeded = true;
      return group;
    }

    // A convenience method for reducing by count.
    function reduceCount() {
      return reduce(crossfilter_reduceIncrement, crossfilter_reduceDecrement, crossfilter_zero);
    }

    // A convenience method for reducing by sum(value).
    function reduceSum(value) {
      return reduce(crossfilter_reduceAdd(value), crossfilter_reduceSubtract(value), crossfilter_zero);
    }

    // Returns the computed reduce value.
    function value() {
      if (resetNeeded) reset(), resetNeeded = false;
      return reduceValue;
    }

    // Removes this group and associated event listeners.
    function dispose() {
      var i = filterListeners.indexOf(update);
      if (i >= 0) filterListeners.splice(i);
      i = dataListeners.indexOf(add);
      if (i >= 0) dataListeners.splice(i);
      return group;
    }

    return reduceCount();
  }

  // Returns the number of records in this crossfilter, irrespective of any filters.
  function size() {
    return n;
  }

  return arguments.length
      ? add(arguments[0])
      : crossfilter;
}

// Returns an array of size n, big enough to store ids up to m.
function crossfilter_index(n, m) {
  return (m < 0x101
      ? crossfilter_array8 : m < 0x10001
      ? crossfilter_array16
      : crossfilter_array32)(n);
}

// Constructs a new array of size n, with sequential values from 0 to n - 1.
function crossfilter_range(n) {
  var range = crossfilter_index(n, n);
  for (var i = -1; ++i < n;) range[i] = i;
  return range;
}

function crossfilter_capacity(w) {
  return w === 8
      ? 0x100 : w === 16
      ? 0x10000
      : 0x100000000;
}
})(typeof exports !== 'undefined' && exports || this);

},{}],32:[function(require,module,exports){
module.exports = require("./crossfilter").crossfilter;

},{"./crossfilter":31}],33:[function(require,module,exports){
var Duration = (function () {

    var millisecond = 1,
        second      = 1000 * millisecond,
        minute      = 60   * second,
        hour        = 60   * minute,
        day         = 24   * hour,
        week        = 7    * day;

    var unitMap = {
        "ms" : millisecond,
        "s"  : second,
        "m"  : minute,
        "h"  : hour,
        "d"  : day,
        "w"  : week
    };

    var Duration = function (value) {
        if (value instanceof Duration) {
          return value;
        }
        switch (typeof value) {
            case "number":
                this._milliseconds = value;
                break;
            case "string":
                this._milliseconds = Duration.parse(value).valueOf();
                break;
            case "undefined":
                this._milliseconds = 0;
                break;
            default:
                throw new Error("invalid duration: " + value);
        }
    };

    Duration.millisecond = new Duration(millisecond);
    Duration.second      = new Duration(second);
    Duration.minute      = new Duration(minute);
    Duration.hour        = new Duration(hour);
    Duration.day         = new Duration(day);
    Duration.week        = new Duration(week);

    Duration.prototype.nanoseconds = function () {
        return this._milliseconds * 1000000;
    };

    Duration.prototype.microseconds = function () {
        return this._milliseconds * 1000;
    };

    Duration.prototype.milliseconds = function () {
        return this._milliseconds;
    };

    Duration.prototype.seconds = function () {
        return Math.floor(this._milliseconds / second);
    };

    Duration.prototype.minutes = function () {
        return Math.floor(this._milliseconds / minute);
    };

    Duration.prototype.hours = function () {
        return Math.floor(this._milliseconds / hour);
    };

    Duration.prototype.days = function () {
      return Math.floor(this._milliseconds / day);
    };

    Duration.prototype.weeks = function () {
      return Math.floor(this._milliseconds / week);
    };

    Duration.prototype.toString = function () {
      var str          = "",
          milliseconds = Math.abs(this._milliseconds),
          sign         = this._milliseconds < 0 ? "-" : "";

      // no units for 0 duration
      if (milliseconds === 0) {
        return "0";
      }

      // days
      var days = Math.floor(milliseconds / day);
      if (days !== 0) {
        milliseconds -= day * days;
        str += days.toString() + "d";
      }

      // hours
      var hours = Math.floor(milliseconds / hour);
      if (hours !== 0) {
        milliseconds -= hour * hours;
        str += hours.toString() + "h";
      }

      // minutes
      var minutes = Math.floor(milliseconds / minute);
      if (minutes !== 0) {
        milliseconds -= minute * minutes;
        str += minutes.toString() + "m";
      }

      // seconds
      var seconds = Math.floor(milliseconds / second);
      if (seconds !== 0) {
        milliseconds -= second * seconds;
        str += seconds.toString() + "s";
      }

      // milliseconds
      if (milliseconds !== 0) {
        str += milliseconds.toString() + "ms";
      }

      return sign + str;
    };

    Duration.prototype.valueOf = function () {
      return this._milliseconds;
    };

    Duration.parse = function (duration) {

        if (duration === "0" || duration === "+0" || duration === "-0") {
          return new Duration(0);
        }

        var regex = /([\-\+\d\.]+)([a-z]+)/g,
            total = 0,
            count = 0,
            sign  = duration[0] === '-' ? -1 : 1,
            unit, value, match;

        while (match = regex.exec(duration)) {

            unit  = match[2];
            value = Math.abs(parseFloat(match[1]));
            count++;

            if (isNaN(value)) {
              throw new Error("invalid duration");
            }

            if (typeof unitMap[unit] === "undefined") {
              throw new Error("invalid unit: " + unit);
            }

            total += value * unitMap[unit];
        }

        if (count === 0) {
          throw new Error("invalid duration");
        }

        return new Duration(total * sign);
    };

    Duration.fromMicroseconds = function (us) {
        var ms = Math.floor(us / 1000);
        return new Duration(ms);
    };

    Duration.fromNanoseconds = function (ns) {
        var ms = Math.floor(ns / 1000000);
        return new Duration(ms);
    };

    return Duration;

}).call(this);

if (typeof module !== "undefined") {
   module.exports = Duration;
}

},{}],34:[function(require,module,exports){
var global=typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {};/**
 * @license
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modern -o ./dist/lodash.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /** Used to pool arrays and objects used internally */
  var arrayPool = [],
      objectPool = [];

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used to prefix keys to avoid issues with `__proto__` and properties on `Object.prototype` */
  var keyPrefix = +new Date + '';

  /** Used as the size when optimizations are enabled for large arrays */
  var largeArraySize = 75;

  /** Used as the max size of the `arrayPool` and `objectPool` */
  var maxPoolSize = 40;

  /** Used to detect and test whitespace */
  var whitespace = (
    // whitespace
    ' \t\x0B\f\xA0\ufeff' +

    // line terminators
    '\n\r\u2028\u2029' +

    // unicode category "Zs" space separators
    '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000'
  );

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-literals-string-literals
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to detected named functions */
  var reFuncName = /^\s*function[ \n\r\t]+\w/;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to match leading whitespace and zeros to be removed */
  var reLeadingSpacesAndZeros = RegExp('^[' + whitespace + ']*0+(?=.$)');

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to assign default `context` object properties */
  var contextProps = [
    'Array', 'Boolean', 'Date', 'Function', 'Math', 'Number', 'Object',
    'RegExp', 'String', '_', 'attachEvent', 'clearTimeout', 'isFinite', 'isNaN',
    'parseInt', 'setTimeout'
  ];

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[funcClass] = false;
  cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
  cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] =
  cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

  /** Used as an internal `_.debounce` options object */
  var debounceOptions = {
    'leading': false,
    'maxWait': 0,
    'trailing': false
  };

  /** Used as the property descriptor for `__bindData__` */
  var descriptor = {
    'configurable': false,
    'enumerable': false,
    'value': null,
    'writable': false
  };

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /** Used as a reference to the global object */
  var root = (objectTypes[typeof window] && window) || this;

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports` */
  var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
  var freeGlobal = objectTypes[typeof global] && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
    root = freeGlobal;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The base implementation of `_.indexOf` without support for binary searches
   * or `fromIndex` constraints.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {*} value The value to search for.
   * @param {number} [fromIndex=0] The index to search from.
   * @returns {number} Returns the index of the matched value or `-1`.
   */
  function baseIndexOf(array, value, fromIndex) {
    var index = (fromIndex || 0) - 1,
        length = array ? array.length : 0;

    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * An implementation of `_.contains` for cache objects that mimics the return
   * signature of `_.indexOf` by returning `0` if the value is found, else `-1`.
   *
   * @private
   * @param {Object} cache The cache object to inspect.
   * @param {*} value The value to search for.
   * @returns {number} Returns `0` if `value` is found, else `-1`.
   */
  function cacheIndexOf(cache, value) {
    var type = typeof value;
    cache = cache.cache;

    if (type == 'boolean' || value == null) {
      return cache[value] ? 0 : -1;
    }
    if (type != 'number' && type != 'string') {
      type = 'object';
    }
    var key = type == 'number' ? value : keyPrefix + value;
    cache = (cache = cache[type]) && cache[key];

    return type == 'object'
      ? (cache && baseIndexOf(cache, value) > -1 ? 0 : -1)
      : (cache ? 0 : -1);
  }

  /**
   * Adds a given value to the corresponding cache object.
   *
   * @private
   * @param {*} value The value to add to the cache.
   */
  function cachePush(value) {
    var cache = this.cache,
        type = typeof value;

    if (type == 'boolean' || value == null) {
      cache[value] = true;
    } else {
      if (type != 'number' && type != 'string') {
        type = 'object';
      }
      var key = type == 'number' ? value : keyPrefix + value,
          typeCache = cache[type] || (cache[type] = {});

      if (type == 'object') {
        (typeCache[key] || (typeCache[key] = [])).push(value);
      } else {
        typeCache[key] = true;
      }
    }
  }

  /**
   * Used by `_.max` and `_.min` as the default callback when a given
   * collection is a string value.
   *
   * @private
   * @param {string} value The character to inspect.
   * @returns {number} Returns the code unit of given character.
   */
  function charAtCallback(value) {
    return value.charCodeAt(0);
  }

  /**
   * Used by `sortBy` to compare transformed `collection` elements, stable sorting
   * them in ascending order.
   *
   * @private
   * @param {Object} a The object to compare to `b`.
   * @param {Object} b The object to compare to `a`.
   * @returns {number} Returns the sort order indicator of `1` or `-1`.
   */
  function compareAscending(a, b) {
    var ac = a.criteria,
        bc = b.criteria,
        index = -1,
        length = ac.length;

    while (++index < length) {
      var value = ac[index],
          other = bc[index];

      if (value !== other) {
        if (value > other || typeof value == 'undefined') {
          return 1;
        }
        if (value < other || typeof other == 'undefined') {
          return -1;
        }
      }
    }
    // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
    // that causes it, under certain circumstances, to return the same value for
    // `a` and `b`. See https://github.com/jashkenas/underscore/pull/1247
    //
    // This also ensures a stable sort in V8 and other engines.
    // See http://code.google.com/p/v8/issues/detail?id=90
    return a.index - b.index;
  }

  /**
   * Creates a cache object to optimize linear searches of large arrays.
   *
   * @private
   * @param {Array} [array=[]] The array to search.
   * @returns {null|Object} Returns the cache object or `null` if caching should not be used.
   */
  function createCache(array) {
    var index = -1,
        length = array.length,
        first = array[0],
        mid = array[(length / 2) | 0],
        last = array[length - 1];

    if (first && typeof first == 'object' &&
        mid && typeof mid == 'object' && last && typeof last == 'object') {
      return false;
    }
    var cache = getObject();
    cache['false'] = cache['null'] = cache['true'] = cache['undefined'] = false;

    var result = getObject();
    result.array = array;
    result.cache = cache;
    result.push = cachePush;

    while (++index < length) {
      result.push(array[index]);
    }
    return result;
  }

  /**
   * Used by `template` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {string} match The matched character to escape.
   * @returns {string} Returns the escaped character.
   */
  function escapeStringChar(match) {
    return '\\' + stringEscapes[match];
  }

  /**
   * Gets an array from the array pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Array} The array from the pool.
   */
  function getArray() {
    return arrayPool.pop() || [];
  }

  /**
   * Gets an object from the object pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Object} The object from the pool.
   */
  function getObject() {
    return objectPool.pop() || {
      'array': null,
      'cache': null,
      'criteria': null,
      'false': false,
      'index': 0,
      'null': false,
      'number': null,
      'object': null,
      'push': null,
      'string': null,
      'true': false,
      'undefined': false,
      'value': null
    };
  }

  /**
   * Releases the given array back to the array pool.
   *
   * @private
   * @param {Array} [array] The array to release.
   */
  function releaseArray(array) {
    array.length = 0;
    if (arrayPool.length < maxPoolSize) {
      arrayPool.push(array);
    }
  }

  /**
   * Releases the given object back to the object pool.
   *
   * @private
   * @param {Object} [object] The object to release.
   */
  function releaseObject(object) {
    var cache = object.cache;
    if (cache) {
      releaseObject(cache);
    }
    object.array = object.cache = object.criteria = object.object = object.number = object.string = object.value = null;
    if (objectPool.length < maxPoolSize) {
      objectPool.push(object);
    }
  }

  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used instead of `Array#slice` to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|string} collection The collection to slice.
   * @param {number} start The start index.
   * @param {number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);

    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Create a new `lodash` function using the given context object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} [context=root] The context object.
   * @returns {Function} Returns the `lodash` function.
   */
  function runInContext(context) {
    // Avoid issues with some ES3 environments that attempt to use values, named
    // after built-in constructors like `Object`, for the creation of literals.
    // ES5 clears this up by stating that literals must use built-in constructors.
    // See http://es5.github.io/#x11.1.5.
    context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;

    /** Native constructor references */
    var Array = context.Array,
        Boolean = context.Boolean,
        Date = context.Date,
        Function = context.Function,
        Math = context.Math,
        Number = context.Number,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

    /**
     * Used for `Array` method references.
     *
     * Normally `Array.prototype` would suffice, however, using an array literal
     * avoids issues in Narwhal.
     */
    var arrayRef = [];

    /** Used for native method references */
    var objectProto = Object.prototype;

    /** Used to restore the original `_` reference in `noConflict` */
    var oldDash = context._;

    /** Used to resolve the internal [[Class]] of values */
    var toString = objectProto.toString;

    /** Used to detect if a method is native */
    var reNative = RegExp('^' +
      String(toString)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/toString| for [^\]]+/g, '.*?') + '$'
    );

    /** Native method shortcuts */
    var ceil = Math.ceil,
        clearTimeout = context.clearTimeout,
        floor = Math.floor,
        fnToString = Function.prototype.toString,
        getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
        hasOwnProperty = objectProto.hasOwnProperty,
        push = arrayRef.push,
        setTimeout = context.setTimeout,
        splice = arrayRef.splice,
        unshift = arrayRef.unshift;

    /** Used to set meta data on functions */
    var defineProperty = (function() {
      // IE 8 only accepts DOM elements
      try {
        var o = {},
            func = isNative(func = Object.defineProperty) && func,
            result = func(o, o, o) && func;
      } catch(e) { }
      return result;
    }());

    /* Native method shortcuts for methods with the same name as other `lodash` methods */
    var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
        nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
        nativeIsFinite = context.isFinite,
        nativeIsNaN = context.isNaN,
        nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random;

    /** Used to lookup a built-in constructor by [[Class]] */
    var ctorByClass = {};
    ctorByClass[arrayClass] = Array;
    ctorByClass[boolClass] = Boolean;
    ctorByClass[dateClass] = Date;
    ctorByClass[funcClass] = Function;
    ctorByClass[objectClass] = Object;
    ctorByClass[numberClass] = Number;
    ctorByClass[regexpClass] = RegExp;
    ctorByClass[stringClass] = String;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object which wraps the given value to enable intuitive
     * method chaining.
     *
     * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
     * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
     * and `unshift`
     *
     * Chaining is supported in custom builds as long as the `value` method is
     * implicitly or explicitly included in the build.
     *
     * The chainable wrapper functions are:
     * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
     * `compose`, `concat`, `countBy`, `create`, `createCallback`, `curry`,
     * `debounce`, `defaults`, `defer`, `delay`, `difference`, `filter`, `flatten`,
     * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
     * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
     * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
     * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `pull`, `push`,
     * `range`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
     * `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`, `transform`,
     * `union`, `uniq`, `unshift`, `unzip`, `values`, `where`, `without`, `wrap`,
     * and `zip`
     *
     * The non-chainable wrapper functions are:
     * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `findIndex`,
     * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `has`, `identity`,
     * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
     * `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`,
     * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`,
     * `lastIndexOf`, `mixin`, `noConflict`, `parseInt`, `pop`, `random`, `reduce`,
     * `reduceRight`, `result`, `shift`, `size`, `some`, `sortedIndex`, `runInContext`,
     * `template`, `unescape`, `uniqueId`, and `value`
     *
     * The wrapper functions `first` and `last` return wrapped values when `n` is
     * provided, otherwise they return unwrapped values.
     *
     * Explicit chaining can be enabled by using the `_.chain` method.
     *
     * @name _
     * @constructor
     * @category Chaining
     * @param {*} value The value to wrap in a `lodash` instance.
     * @returns {Object} Returns a `lodash` instance.
     * @example
     *
     * var wrapped = _([1, 2, 3]);
     *
     * // returns an unwrapped value
     * wrapped.reduce(function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * // returns a wrapped value
     * var squares = wrapped.map(function(num) {
     *   return num * num;
     * });
     *
     * _.isArray(squares);
     * // => false
     *
     * _.isArray(squares.value());
     * // => true
     */
    function lodash(value) {
      // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
      return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
       ? value
       : new lodashWrapper(value);
    }

    /**
     * A fast path for creating `lodash` wrapper objects.
     *
     * @private
     * @param {*} value The value to wrap in a `lodash` instance.
     * @param {boolean} chainAll A flag to enable chaining for all methods
     * @returns {Object} Returns a `lodash` instance.
     */
    function lodashWrapper(value, chainAll) {
      this.__chain__ = !!chainAll;
      this.__wrapped__ = value;
    }
    // ensure `new lodashWrapper` is an instance of `lodash`
    lodashWrapper.prototype = lodash.prototype;

    /**
     * An object used to flag environments features.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    var support = lodash.support = {};

    /**
     * Detect if functions can be decompiled by `Function#toString`
     * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcDecomp = !isNative(context.WinRTError) && reThis.test(runInContext);

    /**
     * Detect if `Function#name` is supported (all but IE).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcNames = typeof Function.name == 'string';

    /**
     * By default, the template delimiters used by Lo-Dash are similar to those in
     * embedded Ruby (ERB). Change the following template settings to use alternative
     * delimiters.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    lodash.templateSettings = {

      /**
       * Used to detect `data` property values to be HTML-escaped.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'escape': /<%-([\s\S]+?)%>/g,

      /**
       * Used to detect code to be evaluated.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'evaluate': /<%([\s\S]+?)%>/g,

      /**
       * Used to detect `data` property values to inject.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'interpolate': reInterpolate,

      /**
       * Used to reference the data object in the template text.
       *
       * @memberOf _.templateSettings
       * @type string
       */
      'variable': '',

      /**
       * Used to import variables into the compiled template.
       *
       * @memberOf _.templateSettings
       * @type Object
       */
      'imports': {

        /**
         * A reference to the `lodash` function.
         *
         * @memberOf _.templateSettings.imports
         * @type Function
         */
        '_': lodash
      }
    };

    /*--------------------------------------------------------------------------*/

    /**
     * The base implementation of `_.bind` that creates the bound function and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new bound function.
     */
    function baseBind(bindData) {
      var func = bindData[0],
          partialArgs = bindData[2],
          thisArg = bindData[4];

      function bound() {
        // `Function#bind` spec
        // http://es5.github.io/#x15.3.4.5
        if (partialArgs) {
          // avoid `arguments` object deoptimizations by using `slice` instead
          // of `Array.prototype.slice.call` and not assigning `arguments` to a
          // variable as a ternary expression
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        // mimic the constructor's `return` behavior
        // http://es5.github.io/#x13.2.2
        if (this instanceof bound) {
          // ensure `new bound` is an instance of `func`
          var thisBinding = baseCreate(func.prototype),
              result = func.apply(thisBinding, args || arguments);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisArg, args || arguments);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.clone` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates clones with source counterparts.
     * @returns {*} Returns the cloned value.
     */
    function baseClone(value, isDeep, callback, stackA, stackB) {
      if (callback) {
        var result = callback(value);
        if (typeof result != 'undefined') {
          return result;
        }
      }
      // inspect [[Class]]
      var isObj = isObject(value);
      if (isObj) {
        var className = toString.call(value);
        if (!cloneableClasses[className]) {
          return value;
        }
        var ctor = ctorByClass[className];
        switch (className) {
          case boolClass:
          case dateClass:
            return new ctor(+value);

          case numberClass:
          case stringClass:
            return new ctor(value);

          case regexpClass:
            result = ctor(value.source, reFlags.exec(value));
            result.lastIndex = value.lastIndex;
            return result;
        }
      } else {
        return value;
      }
      var isArr = isArray(value);
      if (isDeep) {
        // check for circular references and return corresponding clone
        var initedStack = !stackA;
        stackA || (stackA = getArray());
        stackB || (stackB = getArray());

        var length = stackA.length;
        while (length--) {
          if (stackA[length] == value) {
            return stackB[length];
          }
        }
        result = isArr ? ctor(value.length) : {};
      }
      else {
        result = isArr ? slice(value) : assign({}, value);
      }
      // add array properties assigned by `RegExp#exec`
      if (isArr) {
        if (hasOwnProperty.call(value, 'index')) {
          result.index = value.index;
        }
        if (hasOwnProperty.call(value, 'input')) {
          result.input = value.input;
        }
      }
      // exit for shallow clone
      if (!isDeep) {
        return result;
      }
      // add the source value to the stack of traversed objects
      // and associate it with its clone
      stackA.push(value);
      stackB.push(result);

      // recursively populate clone (susceptible to call stack limits)
      (isArr ? forEach : forOwn)(value, function(objValue, key) {
        result[key] = baseClone(objValue, isDeep, callback, stackA, stackB);
      });

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.create` without support for assigning
     * properties to the created object.
     *
     * @private
     * @param {Object} prototype The object to inherit from.
     * @returns {Object} Returns the new object.
     */
    function baseCreate(prototype, properties) {
      return isObject(prototype) ? nativeCreate(prototype) : {};
    }
    // fallback for browsers without `Object.create`
    if (!nativeCreate) {
      baseCreate = (function() {
        function Object() {}
        return function(prototype) {
          if (isObject(prototype)) {
            Object.prototype = prototype;
            var result = new Object;
            Object.prototype = null;
          }
          return result || context.Object();
        };
      }());
    }

    /**
     * The base implementation of `_.createCallback` without support for creating
     * "_.pluck" or "_.where" style callbacks.
     *
     * @private
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     */
    function baseCreateCallback(func, thisArg, argCount) {
      if (typeof func != 'function') {
        return identity;
      }
      // exit early for no `thisArg` or already bound by `Function#bind`
      if (typeof thisArg == 'undefined' || !('prototype' in func)) {
        return func;
      }
      var bindData = func.__bindData__;
      if (typeof bindData == 'undefined') {
        if (support.funcNames) {
          bindData = !func.name;
        }
        bindData = bindData || !support.funcDecomp;
        if (!bindData) {
          var source = fnToString.call(func);
          if (!support.funcNames) {
            bindData = !reFuncName.test(source);
          }
          if (!bindData) {
            // checks if `func` references the `this` keyword and stores the result
            bindData = reThis.test(source);
            setBindData(func, bindData);
          }
        }
      }
      // exit early if there are no `this` references or `func` is bound
      if (bindData === false || (bindData !== true && bindData[1] & 1)) {
        return func;
      }
      switch (argCount) {
        case 1: return function(value) {
          return func.call(thisArg, value);
        };
        case 2: return function(a, b) {
          return func.call(thisArg, a, b);
        };
        case 3: return function(value, index, collection) {
          return func.call(thisArg, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(thisArg, accumulator, value, index, collection);
        };
      }
      return bind(func, thisArg);
    }

    /**
     * The base implementation of `createWrapper` that creates the wrapper and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new function.
     */
    function baseCreateWrapper(bindData) {
      var func = bindData[0],
          bitmask = bindData[1],
          partialArgs = bindData[2],
          partialRightArgs = bindData[3],
          thisArg = bindData[4],
          arity = bindData[5];

      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          key = func;

      function bound() {
        var thisBinding = isBind ? thisArg : this;
        if (partialArgs) {
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        if (partialRightArgs || isCurry) {
          args || (args = slice(arguments));
          if (partialRightArgs) {
            push.apply(args, partialRightArgs);
          }
          if (isCurry && args.length < arity) {
            bitmask |= 16 & ~32;
            return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
          }
        }
        args || (args = arguments);
        if (isBindKey) {
          func = thisBinding[key];
        }
        if (this instanceof bound) {
          thisBinding = baseCreate(func.prototype);
          var result = func.apply(thisBinding, args);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisBinding, args);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.difference` that accepts a single array
     * of values to exclude.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {Array} [values] The array of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     */
    function baseDifference(array, values) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          isLarge = length >= largeArraySize && indexOf === baseIndexOf,
          result = [];

      if (isLarge) {
        var cache = createCache(values);
        if (cache) {
          indexOf = cacheIndexOf;
          values = cache;
        } else {
          isLarge = false;
        }
      }
      while (++index < length) {
        var value = array[index];
        if (indexOf(values, value) < 0) {
          result.push(value);
        }
      }
      if (isLarge) {
        releaseObject(values);
      }
      return result;
    }

    /**
     * The base implementation of `_.flatten` without support for callback
     * shorthands or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {boolean} [isStrict=false] A flag to restrict flattening to arrays and `arguments` objects.
     * @param {number} [fromIndex=0] The index to start from.
     * @returns {Array} Returns a new flattened array.
     */
    function baseFlatten(array, isShallow, isStrict, fromIndex) {
      var index = (fromIndex || 0) - 1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];

        if (value && typeof value == 'object' && typeof value.length == 'number'
            && (isArray(value) || isArguments(value))) {
          // recursively flatten arrays (susceptible to call stack limits)
          if (!isShallow) {
            value = baseFlatten(value, isShallow, isStrict);
          }
          var valIndex = -1,
              valLength = value.length,
              resIndex = result.length;

          result.length += valLength;
          while (++valIndex < valLength) {
            result[resIndex++] = value[valIndex];
          }
        } else if (!isStrict) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * The base implementation of `_.isEqual`, without support for `thisArg` binding,
     * that allows partial "_.where" style comparisons.
     *
     * @private
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
     * @param {Array} [stackA=[]] Tracks traversed `a` objects.
     * @param {Array} [stackB=[]] Tracks traversed `b` objects.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     */
    function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
      // used to indicate that when comparing objects, `a` has at least the properties of `b`
      if (callback) {
        var result = callback(a, b);
        if (typeof result != 'undefined') {
          return !!result;
        }
      }
      // exit early for identical values
      if (a === b) {
        // treat `+0` vs. `-0` as not equal
        return a !== 0 || (1 / a == 1 / b);
      }
      var type = typeof a,
          otherType = typeof b;

      // exit early for unlike primitive values
      if (a === a &&
          !(a && objectTypes[type]) &&
          !(b && objectTypes[otherType])) {
        return false;
      }
      // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
      // http://es5.github.io/#x15.3.4.4
      if (a == null || b == null) {
        return a === b;
      }
      // compare [[Class]] names
      var className = toString.call(a),
          otherClass = toString.call(b);

      if (className == argsClass) {
        className = objectClass;
      }
      if (otherClass == argsClass) {
        otherClass = objectClass;
      }
      if (className != otherClass) {
        return false;
      }
      switch (className) {
        case boolClass:
        case dateClass:
          // coerce dates and booleans to numbers, dates to milliseconds and booleans
          // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
          return +a == +b;

        case numberClass:
          // treat `NaN` vs. `NaN` as equal
          return (a != +a)
            ? b != +b
            // but treat `+0` vs. `-0` as not equal
            : (a == 0 ? (1 / a == 1 / b) : a == +b);

        case regexpClass:
        case stringClass:
          // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
          // treat string primitives and their corresponding object instances as equal
          return a == String(b);
      }
      var isArr = className == arrayClass;
      if (!isArr) {
        // unwrap any `lodash` wrapped values
        var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
            bWrapped = hasOwnProperty.call(b, '__wrapped__');

        if (aWrapped || bWrapped) {
          return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
        }
        // exit for functions and DOM nodes
        if (className != objectClass) {
          return false;
        }
        // in older versions of Opera, `arguments` objects have `Array` constructors
        var ctorA = a.constructor,
            ctorB = b.constructor;

        // non `Object` object instances with different constructors are not equal
        if (ctorA != ctorB &&
              !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
              ('constructor' in a && 'constructor' in b)
            ) {
          return false;
        }
      }
      // assume cyclic structures are equal
      // the algorithm for detecting cyclic structures is adapted from ES 5.1
      // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
      var initedStack = !stackA;
      stackA || (stackA = getArray());
      stackB || (stackB = getArray());

      var length = stackA.length;
      while (length--) {
        if (stackA[length] == a) {
          return stackB[length] == b;
        }
      }
      var size = 0;
      result = true;

      // add `a` and `b` to the stack of traversed objects
      stackA.push(a);
      stackB.push(b);

      // recursively compare objects and arrays (susceptible to call stack limits)
      if (isArr) {
        // compare lengths to determine if a deep comparison is necessary
        length = a.length;
        size = b.length;
        result = size == length;

        if (result || isWhere) {
          // deep compare the contents, ignoring non-numeric properties
          while (size--) {
            var index = length,
                value = b[size];

            if (isWhere) {
              while (index--) {
                if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                  break;
                }
              }
            } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
              break;
            }
          }
        }
      }
      else {
        // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
        // which, in this case, is more costly
        forIn(b, function(value, key, b) {
          if (hasOwnProperty.call(b, key)) {
            // count the number of properties.
            size++;
            // deep compare each property value.
            return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
          }
        });

        if (result && !isWhere) {
          // ensure both objects have the same number of properties
          forIn(a, function(value, key, a) {
            if (hasOwnProperty.call(a, key)) {
              // `size` will be `-1` if `a` has more properties than `b`
              return (result = --size > -1);
            }
          });
        }
      }
      stackA.pop();
      stackB.pop();

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.merge` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {Object} object The destination object.
     * @param {Object} source The source object.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates values with source counterparts.
     */
    function baseMerge(object, source, callback, stackA, stackB) {
      (isArray(source) ? forEach : forOwn)(source, function(source, key) {
        var found,
            isArr,
            result = source,
            value = object[key];

        if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
          // avoid merging previously merged cyclic sources
          var stackLength = stackA.length;
          while (stackLength--) {
            if ((found = stackA[stackLength] == source)) {
              value = stackB[stackLength];
              break;
            }
          }
          if (!found) {
            var isShallow;
            if (callback) {
              result = callback(value, source);
              if ((isShallow = typeof result != 'undefined')) {
                value = result;
              }
            }
            if (!isShallow) {
              value = isArr
                ? (isArray(value) ? value : [])
                : (isPlainObject(value) ? value : {});
            }
            // add `source` and associated `value` to the stack of traversed objects
            stackA.push(source);
            stackB.push(value);

            // recursively merge objects and arrays (susceptible to call stack limits)
            if (!isShallow) {
              baseMerge(value, source, callback, stackA, stackB);
            }
          }
        }
        else {
          if (callback) {
            result = callback(value, source);
            if (typeof result == 'undefined') {
              result = source;
            }
          }
          if (typeof result != 'undefined') {
            value = result;
          }
        }
        object[key] = value;
      });
    }

    /**
     * The base implementation of `_.random` without argument juggling or support
     * for returning floating-point numbers.
     *
     * @private
     * @param {number} min The minimum possible value.
     * @param {number} max The maximum possible value.
     * @returns {number} Returns a random number.
     */
    function baseRandom(min, max) {
      return min + floor(nativeRandom() * (max - min + 1));
    }

    /**
     * The base implementation of `_.uniq` without support for callback shorthands
     * or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function} [callback] The function called per iteration.
     * @returns {Array} Returns a duplicate-value-free array.
     */
    function baseUniq(array, isSorted, callback) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          result = [];

      var isLarge = !isSorted && length >= largeArraySize && indexOf === baseIndexOf,
          seen = (callback || isLarge) ? getArray() : result;

      if (isLarge) {
        var cache = createCache(seen);
        indexOf = cacheIndexOf;
        seen = cache;
      }
      while (++index < length) {
        var value = array[index],
            computed = callback ? callback(value, index, array) : value;

        if (isSorted
              ? !index || seen[seen.length - 1] !== computed
              : indexOf(seen, computed) < 0
            ) {
          if (callback || isLarge) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      if (isLarge) {
        releaseArray(seen.array);
        releaseObject(seen);
      } else if (callback) {
        releaseArray(seen);
      }
      return result;
    }

    /**
     * Creates a function that aggregates a collection, creating an object composed
     * of keys generated from the results of running each element of the collection
     * through a callback. The given `setter` function sets the keys and values
     * of the composed object.
     *
     * @private
     * @param {Function} setter The setter function.
     * @returns {Function} Returns the new aggregator function.
     */
    function createAggregator(setter) {
      return function(collection, callback, thisArg) {
        var result = {};
        callback = lodash.createCallback(callback, thisArg, 3);

        var index = -1,
            length = collection ? collection.length : 0;

        if (typeof length == 'number') {
          while (++index < length) {
            var value = collection[index];
            setter(result, value, callback(value, index, collection), collection);
          }
        } else {
          forOwn(collection, function(value, key, collection) {
            setter(result, value, callback(value, key, collection), collection);
          });
        }
        return result;
      };
    }

    /**
     * Creates a function that, when called, either curries or invokes `func`
     * with an optional `this` binding and partially applied arguments.
     *
     * @private
     * @param {Function|string} func The function or method name to reference.
     * @param {number} bitmask The bitmask of method flags to compose.
     *  The bitmask may be composed of the following flags:
     *  1 - `_.bind`
     *  2 - `_.bindKey`
     *  4 - `_.curry`
     *  8 - `_.curry` (bound)
     *  16 - `_.partial`
     *  32 - `_.partialRight`
     * @param {Array} [partialArgs] An array of arguments to prepend to those
     *  provided to the new function.
     * @param {Array} [partialRightArgs] An array of arguments to append to those
     *  provided to the new function.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {number} [arity] The arity of `func`.
     * @returns {Function} Returns the new function.
     */
    function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          isPartial = bitmask & 16,
          isPartialRight = bitmask & 32;

      if (!isBindKey && !isFunction(func)) {
        throw new TypeError;
      }
      if (isPartial && !partialArgs.length) {
        bitmask &= ~16;
        isPartial = partialArgs = false;
      }
      if (isPartialRight && !partialRightArgs.length) {
        bitmask &= ~32;
        isPartialRight = partialRightArgs = false;
      }
      var bindData = func && func.__bindData__;
      if (bindData && bindData !== true) {
        // clone `bindData`
        bindData = slice(bindData);
        if (bindData[2]) {
          bindData[2] = slice(bindData[2]);
        }
        if (bindData[3]) {
          bindData[3] = slice(bindData[3]);
        }
        // set `thisBinding` is not previously bound
        if (isBind && !(bindData[1] & 1)) {
          bindData[4] = thisArg;
        }
        // set if previously bound but not currently (subsequent curried functions)
        if (!isBind && bindData[1] & 1) {
          bitmask |= 8;
        }
        // set curried arity if not yet set
        if (isCurry && !(bindData[1] & 4)) {
          bindData[5] = arity;
        }
        // append partial left arguments
        if (isPartial) {
          push.apply(bindData[2] || (bindData[2] = []), partialArgs);
        }
        // append partial right arguments
        if (isPartialRight) {
          unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
        }
        // merge flags
        bindData[1] |= bitmask;
        return createWrapper.apply(null, bindData);
      }
      // fast path for `_.bind`
      var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
      return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
    }

    /**
     * Used by `escape` to convert characters to HTML entities.
     *
     * @private
     * @param {string} match The matched character to escape.
     * @returns {string} Returns the escaped character.
     */
    function escapeHtmlChar(match) {
      return htmlEscapes[match];
    }

    /**
     * Gets the appropriate "indexOf" function. If the `_.indexOf` method is
     * customized, this method returns the custom method, otherwise it returns
     * the `baseIndexOf` function.
     *
     * @private
     * @returns {Function} Returns the "indexOf" function.
     */
    function getIndexOf() {
      var result = (result = lodash.indexOf) === indexOf ? baseIndexOf : result;
      return result;
    }

    /**
     * Checks if `value` is a native function.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
     */
    function isNative(value) {
      return typeof value == 'function' && reNative.test(value);
    }

    /**
     * Sets `this` binding data on a given function.
     *
     * @private
     * @param {Function} func The function to set data on.
     * @param {Array} value The data array to set.
     */
    var setBindData = !defineProperty ? noop : function(func, value) {
      descriptor.value = value;
      defineProperty(func, '__bindData__', descriptor);
    };

    /**
     * A fallback implementation of `isPlainObject` which checks if a given value
     * is an object created by the `Object` constructor, assuming objects created
     * by the `Object` constructor have no inherited enumerable properties and that
     * there are no `Object.prototype` extensions.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     */
    function shimIsPlainObject(value) {
      var ctor,
          result;

      // avoid non Object objects, `arguments` objects, and DOM elements
      if (!(value && toString.call(value) == objectClass) ||
          (ctor = value.constructor, isFunction(ctor) && !(ctor instanceof ctor))) {
        return false;
      }
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      forIn(value, function(value, key) {
        result = key;
      });
      return typeof result == 'undefined' || hasOwnProperty.call(value, result);
    }

    /**
     * Used by `unescape` to convert HTML entities to characters.
     *
     * @private
     * @param {string} match The matched character to unescape.
     * @returns {string} Returns the unescaped character.
     */
    function unescapeHtmlChar(match) {
      return htmlUnescapes[match];
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Checks if `value` is an `arguments` object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
     * @example
     *
     * (function() { return _.isArguments(arguments); })(1, 2, 3);
     * // => true
     *
     * _.isArguments([1, 2, 3]);
     * // => false
     */
    function isArguments(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == argsClass || false;
    }

    /**
     * Checks if `value` is an array.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
     * @example
     *
     * (function() { return _.isArray(arguments); })();
     * // => false
     *
     * _.isArray([1, 2, 3]);
     * // => true
     */
    var isArray = nativeIsArray || function(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == arrayClass || false;
    };

    /**
     * A fallback implementation of `Object.keys` which produces an array of the
     * given object's own enumerable property names.
     *
     * @private
     * @type Function
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     */
    var shimKeys = function(object) {
      var index, iterable = object, result = [];
      if (!iterable) return result;
      if (!(objectTypes[typeof object])) return result;
        for (index in iterable) {
          if (hasOwnProperty.call(iterable, index)) {
            result.push(index);
          }
        }
      return result
    };

    /**
     * Creates an array composed of the own enumerable property names of an object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     * @example
     *
     * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
     * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
     */
    var keys = !nativeKeys ? shimKeys : function(object) {
      if (!isObject(object)) {
        return [];
      }
      return nativeKeys(object);
    };

    /**
     * Used to convert characters to HTML entities:
     *
     * Though the `>` character is escaped for symmetry, characters like `>` and `/`
     * don't require escaping in HTML and have no special meaning unless they're part
     * of a tag or an unquoted attribute value.
     * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
     */
    var htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    /** Used to convert HTML entities to characters */
    var htmlUnescapes = invert(htmlEscapes);

    /** Used to match HTML entities and HTML characters */
    var reEscapedHtml = RegExp('(' + keys(htmlUnescapes).join('|') + ')', 'g'),
        reUnescapedHtml = RegExp('[' + keys(htmlEscapes).join('') + ']', 'g');

    /*--------------------------------------------------------------------------*/

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object. Subsequent sources will overwrite property assignments of previous
     * sources. If a callback is provided it will be executed to produce the
     * assigned values. The callback is bound to `thisArg` and invoked with two
     * arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @type Function
     * @alias extend
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize assigning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * _.assign({ 'name': 'fred' }, { 'employer': 'slate' });
     * // => { 'name': 'fred', 'employer': 'slate' }
     *
     * var defaults = _.partialRight(_.assign, function(a, b) {
     *   return typeof a == 'undefined' ? b : a;
     * });
     *
     * var object = { 'name': 'barney' };
     * defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var assign = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {
        var callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
      } else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {
        callback = args[--argsLength];
      }
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
        }
        }
      }
      return result
    };

    /**
     * Creates a clone of `value`. If `isDeep` is `true` nested objects will also
     * be cloned, otherwise they will be assigned by reference. If a callback
     * is provided it will be executed to produce the cloned values. If the
     * callback returns `undefined` cloning will be handled by the method instead.
     * The callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var shallow = _.clone(characters);
     * shallow[0] === characters[0];
     * // => true
     *
     * var deep = _.clone(characters, true);
     * deep[0] === characters[0];
     * // => false
     *
     * _.mixin({
     *   'clone': _.partialRight(_.clone, function(value) {
     *     return _.isElement(value) ? value.cloneNode(false) : undefined;
     *   })
     * });
     *
     * var clone = _.clone(document.body);
     * clone.childNodes.length;
     * // => 0
     */
    function clone(value, isDeep, callback, thisArg) {
      // allows working with "Collections" methods without using their `index`
      // and `collection` arguments for `isDeep` and `callback`
      if (typeof isDeep != 'boolean' && isDeep != null) {
        thisArg = callback;
        callback = isDeep;
        isDeep = false;
      }
      return baseClone(value, isDeep, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates a deep clone of `value`. If a callback is provided it will be
     * executed to produce the cloned values. If the callback returns `undefined`
     * cloning will be handled by the method instead. The callback is bound to
     * `thisArg` and invoked with one argument; (value).
     *
     * Note: This method is loosely based on the structured clone algorithm. Functions
     * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
     * objects created by constructors other than `Object` are cloned to plain `Object` objects.
     * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the deep cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var deep = _.cloneDeep(characters);
     * deep[0] === characters[0];
     * // => false
     *
     * var view = {
     *   'label': 'docs',
     *   'node': element
     * };
     *
     * var clone = _.cloneDeep(view, function(value) {
     *   return _.isElement(value) ? value.cloneNode(true) : undefined;
     * });
     *
     * clone.node == view.node;
     * // => false
     */
    function cloneDeep(value, callback, thisArg) {
      return baseClone(value, true, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates an object that inherits from the given `prototype` object. If a
     * `properties` object is provided its own enumerable properties are assigned
     * to the created object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} prototype The object to inherit from.
     * @param {Object} [properties] The properties to assign to the object.
     * @returns {Object} Returns the new object.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * function Circle() {
     *   Shape.call(this);
     * }
     *
     * Circle.prototype = _.create(Shape.prototype, { 'constructor': Circle });
     *
     * var circle = new Circle;
     * circle instanceof Circle;
     * // => true
     *
     * circle instanceof Shape;
     * // => true
     */
    function create(prototype, properties) {
      var result = baseCreate(prototype);
      return properties ? assign(result, properties) : result;
    }

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object for all destination properties that resolve to `undefined`. Once a
     * property is set, additional defaults of the same property will be ignored.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param- {Object} [guard] Allows working with `_.reduce` without using its
     *  `key` and `object` arguments as sources.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var object = { 'name': 'barney' };
     * _.defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var defaults = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (typeof result[index] == 'undefined') result[index] = iterable[index];
        }
        }
      }
      return result
    };

    /**
     * This method is like `_.findIndex` except that it returns the key of the
     * first element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': false },
     *   'fred': {    'age': 40, 'blocked': true },
     *   'pebbles': { 'age': 1,  'blocked': false }
     * };
     *
     * _.findKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => 'barney' (property order is not guaranteed across environments)
     *
     * // using "_.where" callback shorthand
     * _.findKey(characters, { 'age': 1 });
     * // => 'pebbles'
     *
     * // using "_.pluck" callback shorthand
     * _.findKey(characters, 'blocked');
     * // => 'fred'
     */
    function findKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwn(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * This method is like `_.findKey` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': true },
     *   'fred': {    'age': 40, 'blocked': false },
     *   'pebbles': { 'age': 1,  'blocked': true }
     * };
     *
     * _.findLastKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => returns `pebbles`, assuming `_.findKey` returns `barney`
     *
     * // using "_.where" callback shorthand
     * _.findLastKey(characters, { 'age': 40 });
     * // => 'fred'
     *
     * // using "_.pluck" callback shorthand
     * _.findLastKey(characters, 'blocked');
     * // => 'pebbles'
     */
    function findLastKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwnRight(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over own and inherited enumerable properties of an object,
     * executing the callback for each property. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, key, object). Callbacks may exit
     * iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forIn(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
     */
    var forIn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        for (index in iterable) {
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forIn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forInRight(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'move', 'y', and 'x' assuming `_.forIn ` logs 'x', 'y', and 'move'
     */
    function forInRight(object, callback, thisArg) {
      var pairs = [];

      forIn(object, function(value, key) {
        pairs.push(key, value);
      });

      var length = pairs.length;
      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(pairs[length--], pairs[length], object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Iterates over own enumerable properties of an object, executing the callback
     * for each property. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, key, object). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
     */
    var forOwn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forOwn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwnRight({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs 'length', '1', and '0' assuming `_.forOwn` logs '0', '1', and 'length'
     */
    function forOwnRight(object, callback, thisArg) {
      var props = keys(object),
          length = props.length;

      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        var key = props[length];
        if (callback(object[key], key, object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Creates a sorted array of property names of all enumerable properties,
     * own and inherited, of `object` that have function values.
     *
     * @static
     * @memberOf _
     * @alias methods
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names that have function values.
     * @example
     *
     * _.functions(_);
     * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
     */
    function functions(object) {
      var result = [];
      forIn(object, function(value, key) {
        if (isFunction(value)) {
          result.push(key);
        }
      });
      return result.sort();
    }

    /**
     * Checks if the specified property name exists as a direct property of `object`,
     * instead of an inherited property.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to check.
     * @returns {boolean} Returns `true` if key is a direct property, else `false`.
     * @example
     *
     * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
     * // => true
     */
    function has(object, key) {
      return object ? hasOwnProperty.call(object, key) : false;
    }

    /**
     * Creates an object composed of the inverted keys and values of the given object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to invert.
     * @returns {Object} Returns the created inverted object.
     * @example
     *
     * _.invert({ 'first': 'fred', 'second': 'barney' });
     * // => { 'fred': 'first', 'barney': 'second' }
     */
    function invert(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = {};

      while (++index < length) {
        var key = props[index];
        result[object[key]] = key;
      }
      return result;
    }

    /**
     * Checks if `value` is a boolean value.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a boolean value, else `false`.
     * @example
     *
     * _.isBoolean(null);
     * // => false
     */
    function isBoolean(value) {
      return value === true || value === false ||
        value && typeof value == 'object' && toString.call(value) == boolClass || false;
    }

    /**
     * Checks if `value` is a date.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a date, else `false`.
     * @example
     *
     * _.isDate(new Date);
     * // => true
     */
    function isDate(value) {
      return value && typeof value == 'object' && toString.call(value) == dateClass || false;
    }

    /**
     * Checks if `value` is a DOM element.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a DOM element, else `false`.
     * @example
     *
     * _.isElement(document.body);
     * // => true
     */
    function isElement(value) {
      return value && value.nodeType === 1 || false;
    }

    /**
     * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
     * length of `0` and objects with no own enumerable properties are considered
     * "empty".
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object|string} value The value to inspect.
     * @returns {boolean} Returns `true` if the `value` is empty, else `false`.
     * @example
     *
     * _.isEmpty([1, 2, 3]);
     * // => false
     *
     * _.isEmpty({});
     * // => true
     *
     * _.isEmpty('');
     * // => true
     */
    function isEmpty(value) {
      var result = true;
      if (!value) {
        return result;
      }
      var className = toString.call(value),
          length = value.length;

      if ((className == arrayClass || className == stringClass || className == argsClass ) ||
          (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
        return !length;
      }
      forOwn(value, function() {
        return (result = false);
      });
      return result;
    }

    /**
     * Performs a deep comparison between two values to determine if they are
     * equivalent to each other. If a callback is provided it will be executed
     * to compare values. If the callback returns `undefined` comparisons will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (a, b).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var copy = { 'name': 'fred' };
     *
     * object == copy;
     * // => false
     *
     * _.isEqual(object, copy);
     * // => true
     *
     * var words = ['hello', 'goodbye'];
     * var otherWords = ['hi', 'goodbye'];
     *
     * _.isEqual(words, otherWords, function(a, b) {
     *   var reGreet = /^(?:hello|hi)$/i,
     *       aGreet = _.isString(a) && reGreet.test(a),
     *       bGreet = _.isString(b) && reGreet.test(b);
     *
     *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
     * });
     * // => true
     */
    function isEqual(a, b, callback, thisArg) {
      return baseIsEqual(a, b, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 2));
    }

    /**
     * Checks if `value` is, or can be coerced to, a finite number.
     *
     * Note: This is not the same as native `isFinite` which will return true for
     * booleans and empty strings. See http://es5.github.io/#x15.1.2.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is finite, else `false`.
     * @example
     *
     * _.isFinite(-101);
     * // => true
     *
     * _.isFinite('10');
     * // => true
     *
     * _.isFinite(true);
     * // => false
     *
     * _.isFinite('');
     * // => false
     *
     * _.isFinite(Infinity);
     * // => false
     */
    function isFinite(value) {
      return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
    }

    /**
     * Checks if `value` is a function.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
     * @example
     *
     * _.isFunction(_);
     * // => true
     */
    function isFunction(value) {
      return typeof value == 'function';
    }

    /**
     * Checks if `value` is the language type of Object.
     * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(1);
     * // => false
     */
    function isObject(value) {
      // check if the value is the ECMAScript language type of Object
      // http://es5.github.io/#x8
      // and avoid a V8 bug
      // http://code.google.com/p/v8/issues/detail?id=2291
      return !!(value && objectTypes[typeof value]);
    }

    /**
     * Checks if `value` is `NaN`.
     *
     * Note: This is not the same as native `isNaN` which will return `true` for
     * `undefined` and other non-numeric values. See http://es5.github.io/#x15.1.2.4.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `NaN`, else `false`.
     * @example
     *
     * _.isNaN(NaN);
     * // => true
     *
     * _.isNaN(new Number(NaN));
     * // => true
     *
     * isNaN(undefined);
     * // => true
     *
     * _.isNaN(undefined);
     * // => false
     */
    function isNaN(value) {
      // `NaN` as a primitive is the only value that is not equal to itself
      // (perform the [[Class]] check first to avoid errors with some host objects in IE)
      return isNumber(value) && value != +value;
    }

    /**
     * Checks if `value` is `null`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `null`, else `false`.
     * @example
     *
     * _.isNull(null);
     * // => true
     *
     * _.isNull(undefined);
     * // => false
     */
    function isNull(value) {
      return value === null;
    }

    /**
     * Checks if `value` is a number.
     *
     * Note: `NaN` is considered a number. See http://es5.github.io/#x8.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a number, else `false`.
     * @example
     *
     * _.isNumber(8.4 * 5);
     * // => true
     */
    function isNumber(value) {
      return typeof value == 'number' ||
        value && typeof value == 'object' && toString.call(value) == numberClass || false;
    }

    /**
     * Checks if `value` is an object created by the `Object` constructor.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * _.isPlainObject(new Shape);
     * // => false
     *
     * _.isPlainObject([1, 2, 3]);
     * // => false
     *
     * _.isPlainObject({ 'x': 0, 'y': 0 });
     * // => true
     */
    var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
      if (!(value && toString.call(value) == objectClass)) {
        return false;
      }
      var valueOf = value.valueOf,
          objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

      return objProto
        ? (value == objProto || getPrototypeOf(value) == objProto)
        : shimIsPlainObject(value);
    };

    /**
     * Checks if `value` is a regular expression.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a regular expression, else `false`.
     * @example
     *
     * _.isRegExp(/fred/);
     * // => true
     */
    function isRegExp(value) {
      return value && typeof value == 'object' && toString.call(value) == regexpClass || false;
    }

    /**
     * Checks if `value` is a string.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
     * @example
     *
     * _.isString('fred');
     * // => true
     */
    function isString(value) {
      return typeof value == 'string' ||
        value && typeof value == 'object' && toString.call(value) == stringClass || false;
    }

    /**
     * Checks if `value` is `undefined`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `undefined`, else `false`.
     * @example
     *
     * _.isUndefined(void 0);
     * // => true
     */
    function isUndefined(value) {
      return typeof value == 'undefined';
    }

    /**
     * Creates an object with the same keys as `object` and values generated by
     * running each own enumerable property of `object` through the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new object with values of the results of each `callback` execution.
     * @example
     *
     * _.mapValues({ 'a': 1, 'b': 2, 'c': 3} , function(num) { return num * 3; });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     *
     * var characters = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // using "_.pluck" callback shorthand
     * _.mapValues(characters, 'age');
     * // => { 'fred': 40, 'pebbles': 1 }
     */
    function mapValues(object, callback, thisArg) {
      var result = {};
      callback = lodash.createCallback(callback, thisArg, 3);

      forOwn(object, function(value, key, object) {
        result[key] = callback(value, key, object);
      });
      return result;
    }

    /**
     * Recursively merges own enumerable properties of the source object(s), that
     * don't resolve to `undefined` into the destination object. Subsequent sources
     * will overwrite property assignments of previous sources. If a callback is
     * provided it will be executed to produce the merged values of the destination
     * and source properties. If the callback returns `undefined` merging will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var names = {
     *   'characters': [
     *     { 'name': 'barney' },
     *     { 'name': 'fred' }
     *   ]
     * };
     *
     * var ages = {
     *   'characters': [
     *     { 'age': 36 },
     *     { 'age': 40 }
     *   ]
     * };
     *
     * _.merge(names, ages);
     * // => { 'characters': [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred', 'age': 40 }] }
     *
     * var food = {
     *   'fruits': ['apple'],
     *   'vegetables': ['beet']
     * };
     *
     * var otherFood = {
     *   'fruits': ['banana'],
     *   'vegetables': ['carrot']
     * };
     *
     * _.merge(food, otherFood, function(a, b) {
     *   return _.isArray(a) ? a.concat(b) : undefined;
     * });
     * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
     */
    function merge(object) {
      var args = arguments,
          length = 2;

      if (!isObject(object)) {
        return object;
      }
      // allows working with `_.reduce` and `_.reduceRight` without using
      // their `index` and `collection` arguments
      if (typeof args[2] != 'number') {
        length = args.length;
      }
      if (length > 3 && typeof args[length - 2] == 'function') {
        var callback = baseCreateCallback(args[--length - 1], args[length--], 2);
      } else if (length > 2 && typeof args[length - 1] == 'function') {
        callback = args[--length];
      }
      var sources = slice(arguments, 1, length),
          index = -1,
          stackA = getArray(),
          stackB = getArray();

      while (++index < length) {
        baseMerge(object, sources[index], callback, stackA, stackB);
      }
      releaseArray(stackA);
      releaseArray(stackB);
      return object;
    }

    /**
     * Creates a shallow clone of `object` excluding the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` omitting the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The properties to omit or the
     *  function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object without the omitted properties.
     * @example
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, 'age');
     * // => { 'name': 'fred' }
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, function(value) {
     *   return typeof value == 'number';
     * });
     * // => { 'name': 'fred' }
     */
    function omit(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var props = [];
        forIn(object, function(value, key) {
          props.push(key);
        });
        props = baseDifference(props, baseFlatten(arguments, true, false, 1));

        var index = -1,
            length = props.length;

        while (++index < length) {
          var key = props[index];
          result[key] = object[key];
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (!callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * Creates a two dimensional array of an object's key-value pairs,
     * i.e. `[[key1, value1], [key2, value2]]`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns new array of key-value pairs.
     * @example
     *
     * _.pairs({ 'barney': 36, 'fred': 40 });
     * // => [['barney', 36], ['fred', 40]] (property order is not guaranteed across environments)
     */
    function pairs(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        var key = props[index];
        result[index] = [key, object[key]];
      }
      return result;
    }

    /**
     * Creates a shallow clone of `object` composed of the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` picking the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The function called per
     *  iteration or property names to pick, specified as individual property
     *  names or arrays of property names.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object composed of the picked properties.
     * @example
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, 'name');
     * // => { 'name': 'fred' }
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, function(value, key) {
     *   return key.charAt(0) != '_';
     * });
     * // => { 'name': 'fred' }
     */
    function pick(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var index = -1,
            props = baseFlatten(arguments, true, false, 1),
            length = isObject(object) ? props.length : 0;

        while (++index < length) {
          var key = props[index];
          if (key in object) {
            result[key] = object[key];
          }
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * An alternative to `_.reduce` this method transforms `object` to a new
     * `accumulator` object which is the result of running each of its own
     * enumerable properties through a callback, with each callback execution
     * potentially mutating the `accumulator` object. The callback is bound to
     * `thisArg` and invoked with four arguments; (accumulator, value, key, object).
     * Callbacks may exit iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] The custom accumulator value.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var squares = _.transform([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function(result, num) {
     *   num *= num;
     *   if (num % 2) {
     *     return result.push(num) < 3;
     *   }
     * });
     * // => [1, 9, 25]
     *
     * var mapped = _.transform({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     * });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function transform(object, callback, accumulator, thisArg) {
      var isArr = isArray(object);
      if (accumulator == null) {
        if (isArr) {
          accumulator = [];
        } else {
          var ctor = object && object.constructor,
              proto = ctor && ctor.prototype;

          accumulator = baseCreate(proto);
        }
      }
      if (callback) {
        callback = lodash.createCallback(callback, thisArg, 4);
        (isArr ? forEach : forOwn)(object, function(value, index, object) {
          return callback(accumulator, value, index, object);
        });
      }
      return accumulator;
    }

    /**
     * Creates an array composed of the own enumerable property values of `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property values.
     * @example
     *
     * _.values({ 'one': 1, 'two': 2, 'three': 3 });
     * // => [1, 2, 3] (property order is not guaranteed across environments)
     */
    function values(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        result[index] = object[props[index]];
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array of elements from the specified indexes, or keys, of the
     * `collection`. Indexes may be specified as individual arguments or as arrays
     * of indexes.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {...(number|number[]|string|string[])} [index] The indexes of `collection`
     *   to retrieve, specified as individual indexes or arrays of indexes.
     * @returns {Array} Returns a new array of elements corresponding to the
     *  provided indexes.
     * @example
     *
     * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
     * // => ['a', 'c', 'e']
     *
     * _.at(['fred', 'barney', 'pebbles'], 0, 2);
     * // => ['fred', 'pebbles']
     */
    function at(collection) {
      var args = arguments,
          index = -1,
          props = baseFlatten(args, true, false, 1),
          length = (args[2] && args[2][args[1]] === collection) ? 1 : props.length,
          result = Array(length);

      while(++index < length) {
        result[index] = collection[props[index]];
      }
      return result;
    }

    /**
     * Checks if a given value is present in a collection using strict equality
     * for comparisons, i.e. `===`. If `fromIndex` is negative, it is used as the
     * offset from the end of the collection.
     *
     * @static
     * @memberOf _
     * @alias include
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {*} target The value to check for.
     * @param {number} [fromIndex=0] The index to search from.
     * @returns {boolean} Returns `true` if the `target` element is found, else `false`.
     * @example
     *
     * _.contains([1, 2, 3], 1);
     * // => true
     *
     * _.contains([1, 2, 3], 1, 2);
     * // => false
     *
     * _.contains({ 'name': 'fred', 'age': 40 }, 'fred');
     * // => true
     *
     * _.contains('pebbles', 'eb');
     * // => true
     */
    function contains(collection, target, fromIndex) {
      var index = -1,
          indexOf = getIndexOf(),
          length = collection ? collection.length : 0,
          result = false;

      fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
      if (isArray(collection)) {
        result = indexOf(collection, target, fromIndex) > -1;
      } else if (typeof length == 'number') {
        result = (isString(collection) ? collection.indexOf(target, fromIndex) : indexOf(collection, target, fromIndex)) > -1;
      } else {
        forOwn(collection, function(value) {
          if (++index >= fromIndex) {
            return !(result = value === target);
          }
        });
      }
      return result;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of `collection` through the callback. The corresponding value
     * of each key is the number of times the key was returned by the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy(['one', 'two', 'three'], 'length');
     * // => { '3': 2, '5': 1 }
     */
    var countBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
    });

    /**
     * Checks if the given callback returns truey value for **all** elements of
     * a collection. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias all
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if all elements passed the callback check,
     *  else `false`.
     * @example
     *
     * _.every([true, 1, null, 'yes']);
     * // => false
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.every(characters, 'age');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.every(characters, { 'age': 36 });
     * // => false
     */
    function every(collection, callback, thisArg) {
      var result = true;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if (!(result = !!callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return (result = !!callback(value, index, collection));
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning an array of all elements
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias select
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that passed the callback check.
     * @example
     *
     * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [2, 4, 6]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.filter(characters, 'blocked');
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     *
     * // using "_.where" callback shorthand
     * _.filter(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     */
    function filter(collection, callback, thisArg) {
      var result = [];
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            result.push(value);
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result.push(value);
          }
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning the first element that
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias detect, findWhere
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.find(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => { 'name': 'barney', 'age': 36, 'blocked': false }
     *
     * // using "_.where" callback shorthand
     * _.find(characters, { 'age': 1 });
     * // =>  { 'name': 'pebbles', 'age': 1, 'blocked': false }
     *
     * // using "_.pluck" callback shorthand
     * _.find(characters, 'blocked');
     * // => { 'name': 'fred', 'age': 40, 'blocked': true }
     */
    function find(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            return value;
          }
        }
      } else {
        var result;
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result = value;
            return false;
          }
        });
        return result;
      }
    }

    /**
     * This method is like `_.find` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * _.findLast([1, 2, 3, 4], function(num) {
     *   return num % 2 == 1;
     * });
     * // => 3
     */
    function findLast(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forEachRight(collection, function(value, index, collection) {
        if (callback(value, index, collection)) {
          result = value;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over elements of a collection, executing the callback for each
     * element. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * Note: As with other "Collections" methods, objects with a `length` property
     * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
     * may be used for object iteration.
     *
     * @static
     * @memberOf _
     * @alias each
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
     * // => logs each number and returns '1,2,3'
     *
     * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
     * // => logs each number and returns the object (property order is not guaranteed across environments)
     */
    function forEach(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (++index < length) {
          if (callback(collection[index], index, collection) === false) {
            break;
          }
        }
      } else {
        forOwn(collection, callback);
      }
      return collection;
    }

    /**
     * This method is like `_.forEach` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias eachRight
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEachRight(function(num) { console.log(num); }).join(',');
     * // => logs each number from right to left and returns '3,2,1'
     */
    function forEachRight(collection, callback, thisArg) {
      var length = collection ? collection.length : 0;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (length--) {
          if (callback(collection[length], length, collection) === false) {
            break;
          }
        }
      } else {
        var props = keys(collection);
        length = props.length;
        forOwn(collection, function(value, key, collection) {
          key = props ? props[--length] : --length;
          return callback(collection[key], key, collection);
        });
      }
      return collection;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of a collection through the callback. The corresponding value
     * of each key is an array of the elements responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * // using "_.pluck" callback shorthand
     * _.groupBy(['one', 'two', 'three'], 'length');
     * // => { '3': ['one', 'two'], '5': ['three'] }
     */
    var groupBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
    });

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of the collection through the given callback. The corresponding
     * value of each key is the last element responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * var keys = [
     *   { 'dir': 'left', 'code': 97 },
     *   { 'dir': 'right', 'code': 100 }
     * ];
     *
     * _.indexBy(keys, 'dir');
     * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(keys, function(key) { return String.fromCharCode(key.code); });
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(characters, function(key) { this.fromCharCode(key.code); }, String);
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     */
    var indexBy = createAggregator(function(result, value, key) {
      result[key] = value;
    });

    /**
     * Invokes the method named by `methodName` on each element in the `collection`
     * returning an array of the results of each invoked method. Additional arguments
     * will be provided to each invoked method. If `methodName` is a function it
     * will be invoked for, and `this` bound to, each element in the `collection`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|string} methodName The name of the method to invoke or
     *  the function invoked per iteration.
     * @param {...*} [arg] Arguments to invoke the method with.
     * @returns {Array} Returns a new array of the results of each invoked method.
     * @example
     *
     * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
     * // => [[1, 5, 7], [1, 2, 3]]
     *
     * _.invoke([123, 456], String.prototype.split, '');
     * // => [['1', '2', '3'], ['4', '5', '6']]
     */
    function invoke(collection, methodName) {
      var args = slice(arguments, 2),
          index = -1,
          isFunc = typeof methodName == 'function',
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
      });
      return result;
    }

    /**
     * Creates an array of values by running each element in the collection
     * through the callback. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias collect
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of the results of each `callback` execution.
     * @example
     *
     * _.map([1, 2, 3], function(num) { return num * 3; });
     * // => [3, 6, 9]
     *
     * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
     * // => [3, 6, 9] (property order is not guaranteed across environments)
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(characters, 'name');
     * // => ['barney', 'fred']
     */
    function map(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        var result = Array(length);
        while (++index < length) {
          result[index] = callback(collection[index], index, collection);
        }
      } else {
        result = [];
        forOwn(collection, function(value, key, collection) {
          result[++index] = callback(value, key, collection);
        });
      }
      return result;
    }

    /**
     * Retrieves the maximum value of a collection. If the collection is empty or
     * falsey `-Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the maximum value.
     * @example
     *
     * _.max([4, 2, 8, 6]);
     * // => 8
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.max(characters, function(chr) { return chr.age; });
     * // => { 'name': 'fred', 'age': 40 };
     *
     * // using "_.pluck" callback shorthand
     * _.max(characters, 'age');
     * // => { 'name': 'fred', 'age': 40 };
     */
    function max(collection, callback, thisArg) {
      var computed = -Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value > result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current > computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the minimum value of a collection. If the collection is empty or
     * falsey `Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the minimum value.
     * @example
     *
     * _.min([4, 2, 8, 6]);
     * // => 2
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.min(characters, function(chr) { return chr.age; });
     * // => { 'name': 'barney', 'age': 36 };
     *
     * // using "_.pluck" callback shorthand
     * _.min(characters, 'age');
     * // => { 'name': 'barney', 'age': 36 };
     */
    function min(collection, callback, thisArg) {
      var computed = Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value < result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current < computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the value of a specified property from all elements in the collection.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {string} property The name of the property to pluck.
     * @returns {Array} Returns a new array of property values.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.pluck(characters, 'name');
     * // => ['barney', 'fred']
     */
    var pluck = map;

    /**
     * Reduces a collection to a value which is the accumulated result of running
     * each element in the collection through the callback, where each successive
     * callback execution consumes the return value of the previous execution. If
     * `accumulator` is not provided the first element of the collection will be
     * used as the initial `accumulator` value. The callback is bound to `thisArg`
     * and invoked with four arguments; (accumulator, value, index|key, collection).
     *
     * @static
     * @memberOf _
     * @alias foldl, inject
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var sum = _.reduce([1, 2, 3], function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     *   return result;
     * }, {});
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function reduce(collection, callback, accumulator, thisArg) {
      if (!collection) return accumulator;
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);

      var index = -1,
          length = collection.length;

      if (typeof length == 'number') {
        if (noaccum) {
          accumulator = collection[++index];
        }
        while (++index < length) {
          accumulator = callback(accumulator, collection[index], index, collection);
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          accumulator = noaccum
            ? (noaccum = false, value)
            : callback(accumulator, value, index, collection)
        });
      }
      return accumulator;
    }

    /**
     * This method is like `_.reduce` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias foldr
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var list = [[0, 1], [2, 3], [4, 5]];
     * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
     * // => [4, 5, 2, 3, 0, 1]
     */
    function reduceRight(collection, callback, accumulator, thisArg) {
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);
      forEachRight(collection, function(value, index, collection) {
        accumulator = noaccum
          ? (noaccum = false, value)
          : callback(accumulator, value, index, collection);
      });
      return accumulator;
    }

    /**
     * The opposite of `_.filter` this method returns the elements of a
     * collection that the callback does **not** return truey for.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that failed the callback check.
     * @example
     *
     * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [1, 3, 5]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.reject(characters, 'blocked');
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     *
     * // using "_.where" callback shorthand
     * _.reject(characters, { 'age': 36 });
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     */
    function reject(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);
      return filter(collection, function(value, index, collection) {
        return !callback(value, index, collection);
      });
    }

    /**
     * Retrieves a random element or `n` random elements from a collection.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to sample.
     * @param {number} [n] The number of elements to sample.
     * @param- {Object} [guard] Allows working with functions like `_.map`
     *  without using their `index` arguments as `n`.
     * @returns {Array} Returns the random sample(s) of `collection`.
     * @example
     *
     * _.sample([1, 2, 3, 4]);
     * // => 2
     *
     * _.sample([1, 2, 3, 4], 2);
     * // => [3, 1]
     */
    function sample(collection, n, guard) {
      if (collection && typeof collection.length != 'number') {
        collection = values(collection);
      }
      if (n == null || guard) {
        return collection ? collection[baseRandom(0, collection.length - 1)] : undefined;
      }
      var result = shuffle(collection);
      result.length = nativeMin(nativeMax(0, n), result.length);
      return result;
    }

    /**
     * Creates an array of shuffled values, using a version of the Fisher-Yates
     * shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to shuffle.
     * @returns {Array} Returns a new shuffled collection.
     * @example
     *
     * _.shuffle([1, 2, 3, 4, 5, 6]);
     * // => [4, 1, 6, 3, 5, 2]
     */
    function shuffle(collection) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        var rand = baseRandom(0, ++index);
        result[index] = result[rand];
        result[rand] = value;
      });
      return result;
    }

    /**
     * Gets the size of the `collection` by returning `collection.length` for arrays
     * and array-like objects or the number of own enumerable properties for objects.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to inspect.
     * @returns {number} Returns `collection.length` or number of own enumerable properties.
     * @example
     *
     * _.size([1, 2]);
     * // => 2
     *
     * _.size({ 'one': 1, 'two': 2, 'three': 3 });
     * // => 3
     *
     * _.size('pebbles');
     * // => 7
     */
    function size(collection) {
      var length = collection ? collection.length : 0;
      return typeof length == 'number' ? length : keys(collection).length;
    }

    /**
     * Checks if the callback returns a truey value for **any** element of a
     * collection. The function returns as soon as it finds a passing value and
     * does not iterate over the entire collection. The callback is bound to
     * `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias any
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if any element passed the callback check,
     *  else `false`.
     * @example
     *
     * _.some([null, 0, 'yes', false], Boolean);
     * // => true
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.some(characters, 'blocked');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.some(characters, { 'age': 1 });
     * // => false
     */
    function some(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if ((result = callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return !(result = callback(value, index, collection));
        });
      }
      return !!result;
    }

    /**
     * Creates an array of elements, sorted in ascending order by the results of
     * running each element in a collection through the callback. This method
     * performs a stable sort, that is, it will preserve the original sort order
     * of equal elements. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an array of property names is provided for `callback` the collection
     * will be sorted by each property value.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Array|Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of sorted elements.
     * @example
     *
     * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
     * // => [3, 1, 2]
     *
     * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
     * // => [3, 1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'barney',  'age': 26 },
     *   { 'name': 'fred',    'age': 30 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(_.sortBy(characters, 'age'), _.values);
     * // => [['barney', 26], ['fred', 30], ['barney', 36], ['fred', 40]]
     *
     * // sorting by multiple properties
     * _.map(_.sortBy(characters, ['name', 'age']), _.values);
     * // = > [['barney', 26], ['barney', 36], ['fred', 30], ['fred', 40]]
     */
    function sortBy(collection, callback, thisArg) {
      var index = -1,
          isArr = isArray(callback),
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      if (!isArr) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      forEach(collection, function(value, key, collection) {
        var object = result[++index] = getObject();
        if (isArr) {
          object.criteria = map(callback, function(key) { return value[key]; });
        } else {
          (object.criteria = getArray())[0] = callback(value, key, collection);
        }
        object.index = index;
        object.value = value;
      });

      length = result.length;
      result.sort(compareAscending);
      while (length--) {
        var object = result[length];
        result[length] = object.value;
        if (!isArr) {
          releaseArray(object.criteria);
        }
        releaseObject(object);
      }
      return result;
    }

    /**
     * Converts the `collection` to an array.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to convert.
     * @returns {Array} Returns the new converted array.
     * @example
     *
     * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
     * // => [2, 3, 4]
     */
    function toArray(collection) {
      if (collection && typeof collection.length == 'number') {
        return slice(collection);
      }
      return values(collection);
    }

    /**
     * Performs a deep comparison of each element in a `collection` to the given
     * `properties` object, returning an array of all elements that have equivalent
     * property values.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Object} props The object of property values to filter by.
     * @returns {Array} Returns a new array of elements that have the given properties.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * _.where(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'pets': ['hoppy'] }]
     *
     * _.where(characters, { 'pets': ['dino'] });
     * // => [{ 'name': 'fred', 'age': 40, 'pets': ['baby puss', 'dino'] }]
     */
    var where = filter;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array with all falsey values removed. The values `false`, `null`,
     * `0`, `""`, `undefined`, and `NaN` are all falsey.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to compact.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.compact([0, 1, false, 2, '', 3]);
     * // => [1, 2, 3]
     */
    function compact(array) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];
        if (value) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Creates an array excluding all values of the provided arrays using strict
     * equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {...Array} [values] The arrays of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
     * // => [1, 3, 4]
     */
    function difference(array) {
      return baseDifference(array, baseFlatten(arguments, true, true, 1));
    }

    /**
     * This method is like `_.find` except that it returns the index of the first
     * element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.findIndex(characters, function(chr) {
     *   return chr.age < 20;
     * });
     * // => 2
     *
     * // using "_.where" callback shorthand
     * _.findIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findIndex(characters, 'blocked');
     * // => 1
     */
    function findIndex(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        if (callback(array[index], index, array)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * This method is like `_.findIndex` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': true },
     *   { 'name': 'fred',    'age': 40, 'blocked': false },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': true }
     * ];
     *
     * _.findLastIndex(characters, function(chr) {
     *   return chr.age > 30;
     * });
     * // => 1
     *
     * // using "_.where" callback shorthand
     * _.findLastIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findLastIndex(characters, 'blocked');
     * // => 2
     */
    function findLastIndex(array, callback, thisArg) {
      var length = array ? array.length : 0;
      callback = lodash.createCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(array[length], length, array)) {
          return length;
        }
      }
      return -1;
    }

    /**
     * Gets the first element or first `n` elements of an array. If a callback
     * is provided elements at the beginning of the array are returned as long
     * as the callback returns truey. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias head, take
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the first element(s) of `array`.
     * @example
     *
     * _.first([1, 2, 3]);
     * // => 1
     *
     * _.first([1, 2, 3], 2);
     * // => [1, 2]
     *
     * _.first([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false, 'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.first(characters, 'blocked');
     * // => [{ 'name': 'barney', 'blocked': true, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.first(characters, { 'employer': 'slate' }), 'name');
     * // => ['barney', 'fred']
     */
    function first(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = -1;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[0] : undefined;
        }
      }
      return slice(array, 0, nativeMin(nativeMax(0, n), length));
    }

    /**
     * Flattens a nested array (the nesting can be to any depth). If `isShallow`
     * is truey, the array will only be flattened a single level. If a callback
     * is provided each element of the array is passed through the callback before
     * flattening. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new flattened array.
     * @example
     *
     * _.flatten([1, [2], [3, [[4]]]]);
     * // => [1, 2, 3, 4];
     *
     * _.flatten([1, [2], [3, [[4]]]], true);
     * // => [1, 2, 3, [[4]]];
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 30, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.flatten(characters, 'pets');
     * // => ['hoppy', 'baby puss', 'dino']
     */
    function flatten(array, isShallow, callback, thisArg) {
      // juggle arguments
      if (typeof isShallow != 'boolean' && isShallow != null) {
        thisArg = callback;
        callback = (typeof isShallow != 'function' && thisArg && thisArg[isShallow] === array) ? null : isShallow;
        isShallow = false;
      }
      if (callback != null) {
        array = map(array, callback, thisArg);
      }
      return baseFlatten(array, isShallow);
    }

    /**
     * Gets the index at which the first occurrence of `value` is found using
     * strict equality for comparisons, i.e. `===`. If the array is already sorted
     * providing `true` for `fromIndex` will run a faster binary search.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {boolean|number} [fromIndex=0] The index to search from or `true`
     *  to perform a binary search on a sorted array.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 1
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 4
     *
     * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
     * // => 2
     */
    function indexOf(array, value, fromIndex) {
      if (typeof fromIndex == 'number') {
        var length = array ? array.length : 0;
        fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0);
      } else if (fromIndex) {
        var index = sortedIndex(array, value);
        return array[index] === value ? index : -1;
      }
      return baseIndexOf(array, value, fromIndex);
    }

    /**
     * Gets all but the last element or last `n` elements of an array. If a
     * callback is provided elements at the end of the array are excluded from
     * the result as long as the callback returns truey. The callback is bound
     * to `thisArg` and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.initial([1, 2, 3]);
     * // => [1, 2]
     *
     * _.initial([1, 2, 3], 2);
     * // => [1]
     *
     * _.initial([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [1]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.initial(characters, 'blocked');
     * // => [{ 'name': 'barney',  'blocked': false, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.initial(characters, { 'employer': 'na' }), 'name');
     * // => ['barney', 'fred']
     */
    function initial(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : callback || n;
      }
      return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
    }

    /**
     * Creates an array of unique values present in all provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of shared values.
     * @example
     *
     * _.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2]
     */
    function intersection() {
      var args = [],
          argsIndex = -1,
          argsLength = arguments.length,
          caches = getArray(),
          indexOf = getIndexOf(),
          trustIndexOf = indexOf === baseIndexOf,
          seen = getArray();

      while (++argsIndex < argsLength) {
        var value = arguments[argsIndex];
        if (isArray(value) || isArguments(value)) {
          args.push(value);
          caches.push(trustIndexOf && value.length >= largeArraySize &&
            createCache(argsIndex ? args[argsIndex] : seen));
        }
      }
      var array = args[0],
          index = -1,
          length = array ? array.length : 0,
          result = [];

      outer:
      while (++index < length) {
        var cache = caches[0];
        value = array[index];

        if ((cache ? cacheIndexOf(cache, value) : indexOf(seen, value)) < 0) {
          argsIndex = argsLength;
          (cache || seen).push(value);
          while (--argsIndex) {
            cache = caches[argsIndex];
            if ((cache ? cacheIndexOf(cache, value) : indexOf(args[argsIndex], value)) < 0) {
              continue outer;
            }
          }
          result.push(value);
        }
      }
      while (argsLength--) {
        cache = caches[argsLength];
        if (cache) {
          releaseObject(cache);
        }
      }
      releaseArray(caches);
      releaseArray(seen);
      return result;
    }

    /**
     * Gets the last element or last `n` elements of an array. If a callback is
     * provided elements at the end of the array are returned as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the last element(s) of `array`.
     * @example
     *
     * _.last([1, 2, 3]);
     * // => 3
     *
     * _.last([1, 2, 3], 2);
     * // => [2, 3]
     *
     * _.last([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [2, 3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.last(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.last(characters, { 'employer': 'na' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function last(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[length - 1] : undefined;
        }
      }
      return slice(array, nativeMax(0, length - n));
    }

    /**
     * Gets the index at which the last occurrence of `value` is found using strict
     * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
     * as the offset from the end of the collection.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {number} [fromIndex=array.length-1] The index to search from.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 4
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 1
     */
    function lastIndexOf(array, value, fromIndex) {
      var index = array ? array.length : 0;
      if (typeof fromIndex == 'number') {
        index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
      }
      while (index--) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Removes all provided values from the given array using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {...*} [value] The values to remove.
     * @returns {Array} Returns `array`.
     * @example
     *
     * var array = [1, 2, 3, 1, 2, 3];
     * _.pull(array, 2, 3);
     * console.log(array);
     * // => [1, 1]
     */
    function pull(array) {
      var args = arguments,
          argsIndex = 0,
          argsLength = args.length,
          length = array ? array.length : 0;

      while (++argsIndex < argsLength) {
        var index = -1,
            value = args[argsIndex];
        while (++index < length) {
          if (array[index] === value) {
            splice.call(array, index--, 1);
            length--;
          }
        }
      }
      return array;
    }

    /**
     * Creates an array of numbers (positive and/or negative) progressing from
     * `start` up to but not including `end`. If `start` is less than `stop` a
     * zero-length range is created unless a negative `step` is specified.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {number} [start=0] The start of the range.
     * @param {number} end The end of the range.
     * @param {number} [step=1] The value to increment or decrement by.
     * @returns {Array} Returns a new range array.
     * @example
     *
     * _.range(4);
     * // => [0, 1, 2, 3]
     *
     * _.range(1, 5);
     * // => [1, 2, 3, 4]
     *
     * _.range(0, 20, 5);
     * // => [0, 5, 10, 15]
     *
     * _.range(0, -4, -1);
     * // => [0, -1, -2, -3]
     *
     * _.range(1, 4, 0);
     * // => [1, 1, 1]
     *
     * _.range(0);
     * // => []
     */
    function range(start, end, step) {
      start = +start || 0;
      step = typeof step == 'number' ? step : (+step || 1);

      if (end == null) {
        end = start;
        start = 0;
      }
      // use `Array(length)` so engines like Chakra and V8 avoid slower modes
      // http://youtu.be/XAqIpGU8ZZk#t=17m25s
      var index = -1,
          length = nativeMax(0, ceil((end - start) / (step || 1))),
          result = Array(length);

      while (++index < length) {
        result[index] = start;
        start += step;
      }
      return result;
    }

    /**
     * Removes all elements from an array that the callback returns truey for
     * and returns an array of removed elements. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of removed elements.
     * @example
     *
     * var array = [1, 2, 3, 4, 5, 6];
     * var evens = _.remove(array, function(num) { return num % 2 == 0; });
     *
     * console.log(array);
     * // => [1, 3, 5]
     *
     * console.log(evens);
     * // => [2, 4, 6]
     */
    function remove(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        var value = array[index];
        if (callback(value, index, array)) {
          result.push(value);
          splice.call(array, index--, 1);
          length--;
        }
      }
      return result;
    }

    /**
     * The opposite of `_.initial` this method gets all but the first element or
     * first `n` elements of an array. If a callback function is provided elements
     * at the beginning of the array are excluded from the result as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias drop, tail
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.rest([1, 2, 3]);
     * // => [2, 3]
     *
     * _.rest([1, 2, 3], 2);
     * // => [3]
     *
     * _.rest([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true, 'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.rest(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.rest(characters, { 'employer': 'slate' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function rest(array, callback, thisArg) {
      if (typeof callback != 'number' && callback != null) {
        var n = 0,
            index = -1,
            length = array ? array.length : 0;

        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
      }
      return slice(array, n);
    }

    /**
     * Uses a binary search to determine the smallest index at which a value
     * should be inserted into a given sorted array in order to maintain the sort
     * order of the array. If a callback is provided it will be executed for
     * `value` and each element of `array` to compute their sort ranking. The
     * callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to inspect.
     * @param {*} value The value to evaluate.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index at which `value` should be inserted
     *  into `array`.
     * @example
     *
     * _.sortedIndex([20, 30, 50], 40);
     * // => 2
     *
     * // using "_.pluck" callback shorthand
     * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
     * // => 2
     *
     * var dict = {
     *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
     * };
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return dict.wordToNumber[word];
     * });
     * // => 2
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return this.wordToNumber[word];
     * }, dict);
     * // => 2
     */
    function sortedIndex(array, value, callback, thisArg) {
      var low = 0,
          high = array ? array.length : low;

      // explicitly reference `identity` for better inlining in Firefox
      callback = callback ? lodash.createCallback(callback, thisArg, 1) : identity;
      value = callback(value);

      while (low < high) {
        var mid = (low + high) >>> 1;
        (callback(array[mid]) < value)
          ? low = mid + 1
          : high = mid;
      }
      return low;
    }

    /**
     * Creates an array of unique values, in order, of the provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of combined values.
     * @example
     *
     * _.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2, 3, 5, 4]
     */
    function union() {
      return baseUniq(baseFlatten(arguments, true, true));
    }

    /**
     * Creates a duplicate-value-free version of an array using strict equality
     * for comparisons, i.e. `===`. If the array is sorted, providing
     * `true` for `isSorted` will use a faster algorithm. If a callback is provided
     * each element of `array` is passed through the callback before uniqueness
     * is computed. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias unique
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a duplicate-value-free array.
     * @example
     *
     * _.uniq([1, 2, 1, 3, 1]);
     * // => [1, 2, 3]
     *
     * _.uniq([1, 1, 2, 2, 3], true);
     * // => [1, 2, 3]
     *
     * _.uniq(['A', 'b', 'C', 'a', 'B', 'c'], function(letter) { return letter.toLowerCase(); });
     * // => ['A', 'b', 'C']
     *
     * _.uniq([1, 2.5, 3, 1.5, 2, 3.5], function(num) { return this.floor(num); }, Math);
     * // => [1, 2.5, 3]
     *
     * // using "_.pluck" callback shorthand
     * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    function uniq(array, isSorted, callback, thisArg) {
      // juggle arguments
      if (typeof isSorted != 'boolean' && isSorted != null) {
        thisArg = callback;
        callback = (typeof isSorted != 'function' && thisArg && thisArg[isSorted] === array) ? null : isSorted;
        isSorted = false;
      }
      if (callback != null) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      return baseUniq(array, isSorted, callback);
    }

    /**
     * Creates an array excluding all provided values using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to filter.
     * @param {...*} [value] The values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
     * // => [2, 3, 4]
     */
    function without(array) {
      return baseDifference(array, slice(arguments, 1));
    }

    /**
     * Creates an array that is the symmetric difference of the provided arrays.
     * See http://en.wikipedia.org/wiki/Symmetric_difference.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of values.
     * @example
     *
     * _.xor([1, 2, 3], [5, 2, 1, 4]);
     * // => [3, 5, 4]
     *
     * _.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);
     * // => [1, 4, 5]
     */
    function xor() {
      var index = -1,
          length = arguments.length;

      while (++index < length) {
        var array = arguments[index];
        if (isArray(array) || isArguments(array)) {
          var result = result
            ? baseUniq(baseDifference(result, array).concat(baseDifference(array, result)))
            : array;
        }
      }
      return result || [];
    }

    /**
     * Creates an array of grouped elements, the first of which contains the first
     * elements of the given arrays, the second of which contains the second
     * elements of the given arrays, and so on.
     *
     * @static
     * @memberOf _
     * @alias unzip
     * @category Arrays
     * @param {...Array} [array] Arrays to process.
     * @returns {Array} Returns a new array of grouped elements.
     * @example
     *
     * _.zip(['fred', 'barney'], [30, 40], [true, false]);
     * // => [['fred', 30, true], ['barney', 40, false]]
     */
    function zip() {
      var array = arguments.length > 1 ? arguments : arguments[0],
          index = -1,
          length = array ? max(pluck(array, 'length')) : 0,
          result = Array(length < 0 ? 0 : length);

      while (++index < length) {
        result[index] = pluck(array, index);
      }
      return result;
    }

    /**
     * Creates an object composed from arrays of `keys` and `values`. Provide
     * either a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`
     * or two arrays, one of `keys` and one of corresponding `values`.
     *
     * @static
     * @memberOf _
     * @alias object
     * @category Arrays
     * @param {Array} keys The array of keys.
     * @param {Array} [values=[]] The array of values.
     * @returns {Object} Returns an object composed of the given keys and
     *  corresponding values.
     * @example
     *
     * _.zipObject(['fred', 'barney'], [30, 40]);
     * // => { 'fred': 30, 'barney': 40 }
     */
    function zipObject(keys, values) {
      var index = -1,
          length = keys ? keys.length : 0,
          result = {};

      if (!values && length && !isArray(keys[0])) {
        values = [];
      }
      while (++index < length) {
        var key = keys[index];
        if (values) {
          result[key] = values[index];
        } else if (key) {
          result[key[0]] = key[1];
        }
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that executes `func`, with  the `this` binding and
     * arguments of the created function, only after being called `n` times.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {number} n The number of times the function must be called before
     *  `func` is executed.
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var saves = ['profile', 'settings'];
     *
     * var done = _.after(saves.length, function() {
     *   console.log('Done saving!');
     * });
     *
     * _.forEach(saves, function(type) {
     *   asyncSave({ 'type': type, 'complete': done });
     * });
     * // => logs 'Done saving!', after all saves have completed
     */
    function after(n, func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (--n < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with the `this`
     * binding of `thisArg` and prepends any additional `bind` arguments to those
     * provided to the bound function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to bind.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var func = function(greeting) {
     *   return greeting + ' ' + this.name;
     * };
     *
     * func = _.bind(func, { 'name': 'fred' }, 'hi');
     * func();
     * // => 'hi fred'
     */
    function bind(func, thisArg) {
      return arguments.length > 2
        ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
        : createWrapper(func, 1, null, null, thisArg);
    }

    /**
     * Binds methods of an object to the object itself, overwriting the existing
     * method. Method names may be specified as individual arguments or as arrays
     * of method names. If no method names are provided all the function properties
     * of `object` will be bound.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object to bind and assign the bound methods to.
     * @param {...string} [methodName] The object method names to
     *  bind, specified as individual method names or arrays of method names.
     * @returns {Object} Returns `object`.
     * @example
     *
     * var view = {
     *   'label': 'docs',
     *   'onClick': function() { console.log('clicked ' + this.label); }
     * };
     *
     * _.bindAll(view);
     * jQuery('#docs').on('click', view.onClick);
     * // => logs 'clicked docs', when the button is clicked
     */
    function bindAll(object) {
      var funcs = arguments.length > 1 ? baseFlatten(arguments, true, false, 1) : functions(object),
          index = -1,
          length = funcs.length;

      while (++index < length) {
        var key = funcs[index];
        object[key] = createWrapper(object[key], 1, null, null, object);
      }
      return object;
    }

    /**
     * Creates a function that, when called, invokes the method at `object[key]`
     * and prepends any additional `bindKey` arguments to those provided to the bound
     * function. This method differs from `_.bind` by allowing bound functions to
     * reference methods that will be redefined or don't yet exist.
     * See http://michaux.ca/articles/lazy-function-definition-pattern.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object the method belongs to.
     * @param {string} key The key of the method.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var object = {
     *   'name': 'fred',
     *   'greet': function(greeting) {
     *     return greeting + ' ' + this.name;
     *   }
     * };
     *
     * var func = _.bindKey(object, 'greet', 'hi');
     * func();
     * // => 'hi fred'
     *
     * object.greet = function(greeting) {
     *   return greeting + 'ya ' + this.name + '!';
     * };
     *
     * func();
     * // => 'hiya fred!'
     */
    function bindKey(object, key) {
      return arguments.length > 2
        ? createWrapper(key, 19, slice(arguments, 2), null, object)
        : createWrapper(key, 3, null, null, object);
    }

    /**
     * Creates a function that is the composition of the provided functions,
     * where each function consumes the return value of the function that follows.
     * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
     * Each function is executed with the `this` binding of the composed function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {...Function} [func] Functions to compose.
     * @returns {Function} Returns the new composed function.
     * @example
     *
     * var realNameMap = {
     *   'pebbles': 'penelope'
     * };
     *
     * var format = function(name) {
     *   name = realNameMap[name.toLowerCase()] || name;
     *   return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
     * };
     *
     * var greet = function(formatted) {
     *   return 'Hiya ' + formatted + '!';
     * };
     *
     * var welcome = _.compose(greet, format);
     * welcome('pebbles');
     * // => 'Hiya Penelope!'
     */
    function compose() {
      var funcs = arguments,
          length = funcs.length;

      while (length--) {
        if (!isFunction(funcs[length])) {
          throw new TypeError;
        }
      }
      return function() {
        var args = arguments,
            length = funcs.length;

        while (length--) {
          args = [funcs[length].apply(this, args)];
        }
        return args[0];
      };
    }

    /**
     * Creates a function which accepts one or more arguments of `func` that when
     * invoked either executes `func` returning its result, if all `func` arguments
     * have been provided, or returns a function that accepts one or more of the
     * remaining `func` arguments, and so on. The arity of `func` can be specified
     * if `func.length` is not sufficient.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to curry.
     * @param {number} [arity=func.length] The arity of `func`.
     * @returns {Function} Returns the new curried function.
     * @example
     *
     * var curried = _.curry(function(a, b, c) {
     *   console.log(a + b + c);
     * });
     *
     * curried(1)(2)(3);
     * // => 6
     *
     * curried(1, 2)(3);
     * // => 6
     *
     * curried(1, 2, 3);
     * // => 6
     */
    function curry(func, arity) {
      arity = typeof arity == 'number' ? arity : (+arity || func.length);
      return createWrapper(func, 4, null, null, null, arity);
    }

    /**
     * Creates a function that will delay the execution of `func` until after
     * `wait` milliseconds have elapsed since the last time it was invoked.
     * Provide an options object to indicate that `func` should be invoked on
     * the leading and/or trailing edge of the `wait` timeout. Subsequent calls
     * to the debounced function will return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the debounced function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to debounce.
     * @param {number} wait The number of milliseconds to delay.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=false] Specify execution on the leading edge of the timeout.
     * @param {number} [options.maxWait] The maximum time `func` is allowed to be delayed before it's called.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // avoid costly calculations while the window size is in flux
     * var lazyLayout = _.debounce(calculateLayout, 150);
     * jQuery(window).on('resize', lazyLayout);
     *
     * // execute `sendMail` when the click event is fired, debouncing subsequent calls
     * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * });
     *
     * // ensure `batchLog` is executed once after 1 second of debounced calls
     * var source = new EventSource('/stream');
     * source.addEventListener('message', _.debounce(batchLog, 250, {
     *   'maxWait': 1000
     * }, false);
     */
    function debounce(func, wait, options) {
      var args,
          maxTimeoutId,
          result,
          stamp,
          thisArg,
          timeoutId,
          trailingCall,
          lastCalled = 0,
          maxWait = false,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      wait = nativeMax(0, wait) || 0;
      if (options === true) {
        var leading = true;
        trailing = false;
      } else if (isObject(options)) {
        leading = options.leading;
        maxWait = 'maxWait' in options && (nativeMax(wait, options.maxWait) || 0);
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      var delayed = function() {
        var remaining = wait - (now() - stamp);
        if (remaining <= 0) {
          if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
          }
          var isCalled = trailingCall;
          maxTimeoutId = timeoutId = trailingCall = undefined;
          if (isCalled) {
            lastCalled = now();
            result = func.apply(thisArg, args);
            if (!timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
          }
        } else {
          timeoutId = setTimeout(delayed, remaining);
        }
      };

      var maxDelayed = function() {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        maxTimeoutId = timeoutId = trailingCall = undefined;
        if (trailing || (maxWait !== wait)) {
          lastCalled = now();
          result = func.apply(thisArg, args);
          if (!timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
        }
      };

      return function() {
        args = arguments;
        stamp = now();
        thisArg = this;
        trailingCall = trailing && (timeoutId || !leading);

        if (maxWait === false) {
          var leadingCall = leading && !timeoutId;
        } else {
          if (!maxTimeoutId && !leading) {
            lastCalled = stamp;
          }
          var remaining = maxWait - (stamp - lastCalled),
              isCalled = remaining <= 0;

          if (isCalled) {
            if (maxTimeoutId) {
              maxTimeoutId = clearTimeout(maxTimeoutId);
            }
            lastCalled = stamp;
            result = func.apply(thisArg, args);
          }
          else if (!maxTimeoutId) {
            maxTimeoutId = setTimeout(maxDelayed, remaining);
          }
        }
        if (isCalled && timeoutId) {
          timeoutId = clearTimeout(timeoutId);
        }
        else if (!timeoutId && wait !== maxWait) {
          timeoutId = setTimeout(delayed, wait);
        }
        if (leadingCall) {
          isCalled = true;
          result = func.apply(thisArg, args);
        }
        if (isCalled && !timeoutId && !maxTimeoutId) {
          args = thisArg = null;
        }
        return result;
      };
    }

    /**
     * Defers executing the `func` function until the current call stack has cleared.
     * Additional arguments will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to defer.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.defer(function(text) { console.log(text); }, 'deferred');
     * // logs 'deferred' after one or more milliseconds
     */
    function defer(func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 1);
      return setTimeout(function() { func.apply(undefined, args); }, 1);
    }

    /**
     * Executes the `func` function after `wait` milliseconds. Additional arguments
     * will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to delay.
     * @param {number} wait The number of milliseconds to delay execution.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.delay(function(text) { console.log(text); }, 1000, 'later');
     * // => logs 'later' after one second
     */
    function delay(func, wait) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 2);
      return setTimeout(function() { func.apply(undefined, args); }, wait);
    }

    /**
     * Creates a function that memoizes the result of `func`. If `resolver` is
     * provided it will be used to determine the cache key for storing the result
     * based on the arguments provided to the memoized function. By default, the
     * first argument provided to the memoized function is used as the cache key.
     * The `func` is executed with the `this` binding of the memoized function.
     * The result cache is exposed as the `cache` property on the memoized function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to have its output memoized.
     * @param {Function} [resolver] A function used to resolve the cache key.
     * @returns {Function} Returns the new memoizing function.
     * @example
     *
     * var fibonacci = _.memoize(function(n) {
     *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
     * });
     *
     * fibonacci(9)
     * // => 34
     *
     * var data = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // modifying the result cache
     * var get = _.memoize(function(name) { return data[name]; }, _.identity);
     * get('pebbles');
     * // => { 'name': 'pebbles', 'age': 1 }
     *
     * get.cache.pebbles.name = 'penelope';
     * get('pebbles');
     * // => { 'name': 'penelope', 'age': 1 }
     */
    function memoize(func, resolver) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var memoized = function() {
        var cache = memoized.cache,
            key = resolver ? resolver.apply(this, arguments) : keyPrefix + arguments[0];

        return hasOwnProperty.call(cache, key)
          ? cache[key]
          : (cache[key] = func.apply(this, arguments));
      }
      memoized.cache = {};
      return memoized;
    }

    /**
     * Creates a function that is restricted to execute `func` once. Repeat calls to
     * the function will return the value of the first call. The `func` is executed
     * with the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var initialize = _.once(createApplication);
     * initialize();
     * initialize();
     * // `initialize` executes `createApplication` once
     */
    function once(func) {
      var ran,
          result;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (ran) {
          return result;
        }
        ran = true;
        result = func.apply(this, arguments);

        // clear the `func` variable so the function may be garbage collected
        func = null;
        return result;
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with any additional
     * `partial` arguments prepended to those provided to the new function. This
     * method is similar to `_.bind` except it does **not** alter the `this` binding.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var greet = function(greeting, name) { return greeting + ' ' + name; };
     * var hi = _.partial(greet, 'hi');
     * hi('fred');
     * // => 'hi fred'
     */
    function partial(func) {
      return createWrapper(func, 16, slice(arguments, 1));
    }

    /**
     * This method is like `_.partial` except that `partial` arguments are
     * appended to those provided to the new function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var defaultsDeep = _.partialRight(_.merge, _.defaults);
     *
     * var options = {
     *   'variable': 'data',
     *   'imports': { 'jq': $ }
     * };
     *
     * defaultsDeep(options, _.templateSettings);
     *
     * options.variable
     * // => 'data'
     *
     * options.imports
     * // => { '_': _, 'jq': $ }
     */
    function partialRight(func) {
      return createWrapper(func, 32, null, slice(arguments, 1));
    }

    /**
     * Creates a function that, when executed, will only call the `func` function
     * at most once per every `wait` milliseconds. Provide an options object to
     * indicate that `func` should be invoked on the leading and/or trailing edge
     * of the `wait` timeout. Subsequent calls to the throttled function will
     * return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the throttled function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to throttle.
     * @param {number} wait The number of milliseconds to throttle executions to.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=true] Specify execution on the leading edge of the timeout.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * // avoid excessively updating the position while scrolling
     * var throttled = _.throttle(updatePosition, 100);
     * jQuery(window).on('scroll', throttled);
     *
     * // execute `renewToken` when the click event is fired, but not more than once every 5 minutes
     * jQuery('.interactive').on('click', _.throttle(renewToken, 300000, {
     *   'trailing': false
     * }));
     */
    function throttle(func, wait, options) {
      var leading = true,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      if (options === false) {
        leading = false;
      } else if (isObject(options)) {
        leading = 'leading' in options ? options.leading : leading;
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      debounceOptions.leading = leading;
      debounceOptions.maxWait = wait;
      debounceOptions.trailing = trailing;

      return debounce(func, wait, debounceOptions);
    }

    /**
     * Creates a function that provides `value` to the wrapper function as its
     * first argument. Additional arguments provided to the function are appended
     * to those provided to the wrapper function. The wrapper is executed with
     * the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {*} value The value to wrap.
     * @param {Function} wrapper The wrapper function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var p = _.wrap(_.escape, function(func, text) {
     *   return '<p>' + func(text) + '</p>';
     * });
     *
     * p('Fred, Wilma, & Pebbles');
     * // => '<p>Fred, Wilma, &amp; Pebbles</p>'
     */
    function wrap(value, wrapper) {
      return createWrapper(wrapper, 16, [value]);
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that returns `value`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value The value to return from the new function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var getter = _.constant(object);
     * getter() === object;
     * // => true
     */
    function constant(value) {
      return function() {
        return value;
      };
    }

    /**
     * Produces a callback bound to an optional `thisArg`. If `func` is a property
     * name the created callback will return the property value for a given element.
     * If `func` is an object the created callback will return `true` for elements
     * that contain the equivalent object properties, otherwise it will return `false`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // wrap to create custom callback shorthands
     * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
     *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
     *   return !match ? func(callback, thisArg) : function(object) {
     *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
     *   };
     * });
     *
     * _.filter(characters, 'age__gt38');
     * // => [{ 'name': 'fred', 'age': 40 }]
     */
    function createCallback(func, thisArg, argCount) {
      var type = typeof func;
      if (func == null || type == 'function') {
        return baseCreateCallback(func, thisArg, argCount);
      }
      // handle "_.pluck" style callback shorthands
      if (type != 'object') {
        return property(func);
      }
      var props = keys(func),
          key = props[0],
          a = func[key];

      // handle "_.where" style callback shorthands
      if (props.length == 1 && a === a && !isObject(a)) {
        // fast path the common case of providing an object with a single
        // property containing a primitive value
        return function(object) {
          var b = object[key];
          return a === b && (a !== 0 || (1 / a == 1 / b));
        };
      }
      return function(object) {
        var length = props.length,
            result = false;

        while (length--) {
          if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
            break;
          }
        }
        return result;
      };
    }

    /**
     * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
     * corresponding HTML entities.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to escape.
     * @returns {string} Returns the escaped string.
     * @example
     *
     * _.escape('Fred, Wilma, & Pebbles');
     * // => 'Fred, Wilma, &amp; Pebbles'
     */
    function escape(string) {
      return string == null ? '' : String(string).replace(reUnescapedHtml, escapeHtmlChar);
    }

    /**
     * This method returns the first argument provided to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value Any value.
     * @returns {*} Returns `value`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.identity(object) === object;
     * // => true
     */
    function identity(value) {
      return value;
    }

    /**
     * Adds function properties of a source object to the destination object.
     * If `object` is a function methods will be added to its prototype as well.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Function|Object} [object=lodash] object The destination object.
     * @param {Object} source The object of functions to add.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.chain=true] Specify whether the functions added are chainable.
     * @example
     *
     * function capitalize(string) {
     *   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
     * }
     *
     * _.mixin({ 'capitalize': capitalize });
     * _.capitalize('fred');
     * // => 'Fred'
     *
     * _('fred').capitalize().value();
     * // => 'Fred'
     *
     * _.mixin({ 'capitalize': capitalize }, { 'chain': false });
     * _('fred').capitalize();
     * // => 'Fred'
     */
    function mixin(object, source, options) {
      var chain = true,
          methodNames = source && functions(source);

      if (!source || (!options && !methodNames.length)) {
        if (options == null) {
          options = source;
        }
        ctor = lodashWrapper;
        source = object;
        object = lodash;
        methodNames = functions(source);
      }
      if (options === false) {
        chain = false;
      } else if (isObject(options) && 'chain' in options) {
        chain = options.chain;
      }
      var ctor = object,
          isFunc = isFunction(ctor);

      forEach(methodNames, function(methodName) {
        var func = object[methodName] = source[methodName];
        if (isFunc) {
          ctor.prototype[methodName] = function() {
            var chainAll = this.__chain__,
                value = this.__wrapped__,
                args = [value];

            push.apply(args, arguments);
            var result = func.apply(object, args);
            if (chain || chainAll) {
              if (value === result && isObject(result)) {
                return this;
              }
              result = new ctor(result);
              result.__chain__ = chainAll;
            }
            return result;
          };
        }
      });
    }

    /**
     * Reverts the '_' variable to its previous value and returns a reference to
     * the `lodash` function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @returns {Function} Returns the `lodash` function.
     * @example
     *
     * var lodash = _.noConflict();
     */
    function noConflict() {
      context._ = oldDash;
      return this;
    }

    /**
     * A no-operation function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.noop(object) === undefined;
     * // => true
     */
    function noop() {
      // no operation performed
    }

    /**
     * Gets the number of milliseconds that have elapsed since the Unix epoch
     * (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var stamp = _.now();
     * _.defer(function() { console.log(_.now() - stamp); });
     * // => logs the number of milliseconds it took for the deferred function to be called
     */
    var now = isNative(now = Date.now) && now || function() {
      return new Date().getTime();
    };

    /**
     * Converts the given value into an integer of the specified radix.
     * If `radix` is `undefined` or `0` a `radix` of `10` is used unless the
     * `value` is a hexadecimal, in which case a `radix` of `16` is used.
     *
     * Note: This method avoids differences in native ES3 and ES5 `parseInt`
     * implementations. See http://es5.github.io/#E.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} value The value to parse.
     * @param {number} [radix] The radix used to interpret the value to parse.
     * @returns {number} Returns the new integer value.
     * @example
     *
     * _.parseInt('08');
     * // => 8
     */
    var parseInt = nativeParseInt(whitespace + '08') == 8 ? nativeParseInt : function(value, radix) {
      // Firefox < 21 and Opera < 15 follow the ES3 specified implementation of `parseInt`
      return nativeParseInt(isString(value) ? value.replace(reLeadingSpacesAndZeros, '') : value, radix || 0);
    };

    /**
     * Creates a "_.pluck" style function, which returns the `key` value of a
     * given object.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} key The name of the property to retrieve.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var characters = [
     *   { 'name': 'fred',   'age': 40 },
     *   { 'name': 'barney', 'age': 36 }
     * ];
     *
     * var getName = _.property('name');
     *
     * _.map(characters, getName);
     * // => ['barney', 'fred']
     *
     * _.sortBy(characters, getName);
     * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
     */
    function property(key) {
      return function(object) {
        return object[key];
      };
    }

    /**
     * Produces a random number between `min` and `max` (inclusive). If only one
     * argument is provided a number between `0` and the given number will be
     * returned. If `floating` is truey or either `min` or `max` are floats a
     * floating-point number will be returned instead of an integer.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} [min=0] The minimum possible value.
     * @param {number} [max=1] The maximum possible value.
     * @param {boolean} [floating=false] Specify returning a floating-point number.
     * @returns {number} Returns a random number.
     * @example
     *
     * _.random(0, 5);
     * // => an integer between 0 and 5
     *
     * _.random(5);
     * // => also an integer between 0 and 5
     *
     * _.random(5, true);
     * // => a floating-point number between 0 and 5
     *
     * _.random(1.2, 5.2);
     * // => a floating-point number between 1.2 and 5.2
     */
    function random(min, max, floating) {
      var noMin = min == null,
          noMax = max == null;

      if (floating == null) {
        if (typeof min == 'boolean' && noMax) {
          floating = min;
          min = 1;
        }
        else if (!noMax && typeof max == 'boolean') {
          floating = max;
          noMax = true;
        }
      }
      if (noMin && noMax) {
        max = 1;
      }
      min = +min || 0;
      if (noMax) {
        max = min;
        min = 0;
      } else {
        max = +max || 0;
      }
      if (floating || min % 1 || max % 1) {
        var rand = nativeRandom();
        return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand +'').length - 1)))), max);
      }
      return baseRandom(min, max);
    }

    /**
     * Resolves the value of property `key` on `object`. If `key` is a function
     * it will be invoked with the `this` binding of `object` and its result returned,
     * else the property value is returned. If `object` is falsey then `undefined`
     * is returned.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to resolve.
     * @returns {*} Returns the resolved value.
     * @example
     *
     * var object = {
     *   'cheese': 'crumpets',
     *   'stuff': function() {
     *     return 'nonsense';
     *   }
     * };
     *
     * _.result(object, 'cheese');
     * // => 'crumpets'
     *
     * _.result(object, 'stuff');
     * // => 'nonsense'
     */
    function result(object, key) {
      if (object) {
        var value = object[key];
        return isFunction(value) ? object[key]() : value;
      }
    }

    /**
     * A micro-templating method that handles arbitrary delimiters, preserves
     * whitespace, and correctly escapes quotes within interpolated code.
     *
     * Note: In the development build, `_.template` utilizes sourceURLs for easier
     * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
     *
     * For more information on precompiling templates see:
     * http://lodash.com/custom-builds
     *
     * For more information on Chrome extension sandboxes see:
     * http://developer.chrome.com/stable/extensions/sandboxingEval.html
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} text The template text.
     * @param {Object} data The data object used to populate the text.
     * @param {Object} [options] The options object.
     * @param {RegExp} [options.escape] The "escape" delimiter.
     * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
     * @param {Object} [options.imports] An object to import into the template as local variables.
     * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
     * @param {string} [sourceURL] The sourceURL of the template's compiled source.
     * @param {string} [variable] The data object variable name.
     * @returns {Function|string} Returns a compiled function when no `data` object
     *  is given, else it returns the interpolated text.
     * @example
     *
     * // using the "interpolate" delimiter to create a compiled template
     * var compiled = _.template('hello <%= name %>');
     * compiled({ 'name': 'fred' });
     * // => 'hello fred'
     *
     * // using the "escape" delimiter to escape HTML in data property values
     * _.template('<b><%- value %></b>', { 'value': '<script>' });
     * // => '<b>&lt;script&gt;</b>'
     *
     * // using the "evaluate" delimiter to generate HTML
     * var list = '<% _.forEach(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
     * _.template('hello ${ name }', { 'name': 'pebbles' });
     * // => 'hello pebbles'
     *
     * // using the internal `print` function in "evaluate" delimiters
     * _.template('<% print("hello " + name); %>!', { 'name': 'barney' });
     * // => 'hello barney!'
     *
     * // using a custom template delimiters
     * _.templateSettings = {
     *   'interpolate': /{{([\s\S]+?)}}/g
     * };
     *
     * _.template('hello {{ name }}!', { 'name': 'mustache' });
     * // => 'hello mustache!'
     *
     * // using the `imports` option to import jQuery
     * var list = '<% jq.each(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] }, { 'imports': { 'jq': jQuery } });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the `sourceURL` option to specify a custom sourceURL for the template
     * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
     * compiled(data);
     * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
     *
     * // using the `variable` option to ensure a with-statement isn't used in the compiled template
     * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
     * compiled.source;
     * // => function(data) {
     *   var __t, __p = '', __e = _.escape;
     *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
     *   return __p;
     * }
     *
     * // using the `source` property to inline compiled templates for meaningful
     * // line numbers in error messages and a stack trace
     * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
     *   var JST = {\
     *     "main": ' + _.template(mainText).source + '\
     *   };\
     * ');
     */
    function template(text, data, options) {
      // based on John Resig's `tmpl` implementation
      // http://ejohn.org/blog/javascript-micro-templating/
      // and Laura Doktorova's doT.js
      // https://github.com/olado/doT
      var settings = lodash.templateSettings;
      text = String(text || '');

      // avoid missing dependencies when `iteratorTemplate` is not defined
      options = defaults({}, options, settings);

      var imports = defaults({}, options.imports, settings.imports),
          importsKeys = keys(imports),
          importsValues = values(imports);

      var isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

      // compile the regexp to match each delimiter
      var reDelimiters = RegExp(
        (options.escape || reNoMatch).source + '|' +
        interpolate.source + '|' +
        (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
        (options.evaluate || reNoMatch).source + '|$'
      , 'g');

      text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        interpolateValue || (interpolateValue = esTemplateValue);

        // escape characters that cannot be included in string literals
        source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

        // replace delimiters with snippets
        if (escapeValue) {
          source += "' +\n__e(" + escapeValue + ") +\n'";
        }
        if (evaluateValue) {
          isEvaluating = true;
          source += "';\n" + evaluateValue + ";\n__p += '";
        }
        if (interpolateValue) {
          source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
        }
        index = offset + match.length;

        // the JS engine embedded in Adobe products requires returning the `match`
        // string in order to produce the correct `offset` value
        return match;
      });

      source += "';\n";

      // if `variable` is not specified, wrap a with-statement around the generated
      // code to add the data object to the top of the scope chain
      var variable = options.variable,
          hasVariable = variable;

      if (!hasVariable) {
        variable = 'obj';
        source = 'with (' + variable + ') {\n' + source + '\n}\n';
      }
      // cleanup code by stripping empty strings
      source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
        .replace(reEmptyStringMiddle, '$1')
        .replace(reEmptyStringTrailing, '$1;');

      // frame code as the function body
      source = 'function(' + variable + ') {\n' +
        (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
        "var __t, __p = '', __e = _.escape" +
        (isEvaluating
          ? ', __j = Array.prototype.join;\n' +
            "function print() { __p += __j.call(arguments, '') }\n"
          : ';\n'
        ) +
        source +
        'return __p\n}';

      // Use a sourceURL for easier debugging.
      // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
      var sourceURL = '\n/*\n//# sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

      try {
        var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
      } catch(e) {
        e.source = source;
        throw e;
      }
      if (data) {
        return result(data);
      }
      // provide the compiled function's source by its `toString` method, in
      // supported environments, or the `source` property as a convenience for
      // inlining compiled templates during the build process
      result.source = source;
      return result;
    }

    /**
     * Executes the callback `n` times, returning an array of the results
     * of each callback execution. The callback is bound to `thisArg` and invoked
     * with one argument; (index).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} n The number of times to execute the callback.
     * @param {Function} callback The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns an array of the results of each `callback` execution.
     * @example
     *
     * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
     * // => [3, 6, 4]
     *
     * _.times(3, function(n) { mage.castSpell(n); });
     * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
     *
     * _.times(3, function(n) { this.cast(n); }, mage);
     * // => also calls `mage.castSpell(n)` three times
     */
    function times(n, callback, thisArg) {
      n = (n = +n) > -1 ? n : 0;
      var index = -1,
          result = Array(n);

      callback = baseCreateCallback(callback, thisArg, 1);
      while (++index < n) {
        result[index] = callback(index);
      }
      return result;
    }

    /**
     * The inverse of `_.escape` this method converts the HTML entities
     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
     * corresponding characters.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to unescape.
     * @returns {string} Returns the unescaped string.
     * @example
     *
     * _.unescape('Fred, Barney &amp; Pebbles');
     * // => 'Fred, Barney & Pebbles'
     */
    function unescape(string) {
      return string == null ? '' : String(string).replace(reEscapedHtml, unescapeHtmlChar);
    }

    /**
     * Generates a unique ID. If `prefix` is provided the ID will be appended to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} [prefix] The value to prefix the ID with.
     * @returns {string} Returns the unique ID.
     * @example
     *
     * _.uniqueId('contact_');
     * // => 'contact_104'
     *
     * _.uniqueId();
     * // => '105'
     */
    function uniqueId(prefix) {
      var id = ++idCounter;
      return String(prefix == null ? '' : prefix) + id;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object that wraps the given value with explicit
     * method chaining enabled.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to wrap.
     * @returns {Object} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'pebbles', 'age': 1 }
     * ];
     *
     * var youngest = _.chain(characters)
     *     .sortBy('age')
     *     .map(function(chr) { return chr.name + ' is ' + chr.age; })
     *     .first()
     *     .value();
     * // => 'pebbles is 1'
     */
    function chain(value) {
      value = new lodashWrapper(value);
      value.__chain__ = true;
      return value;
    }

    /**
     * Invokes `interceptor` with the `value` as the first argument and then
     * returns `value`. The purpose of this method is to "tap into" a method
     * chain in order to perform operations on intermediate results within
     * the chain.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to provide to `interceptor`.
     * @param {Function} interceptor The function to invoke.
     * @returns {*} Returns `value`.
     * @example
     *
     * _([1, 2, 3, 4])
     *  .tap(function(array) { array.pop(); })
     *  .reverse()
     *  .value();
     * // => [3, 2, 1]
     */
    function tap(value, interceptor) {
      interceptor(value);
      return value;
    }

    /**
     * Enables explicit method chaining on the wrapper object.
     *
     * @name chain
     * @memberOf _
     * @category Chaining
     * @returns {*} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // without explicit chaining
     * _(characters).first();
     * // => { 'name': 'barney', 'age': 36 }
     *
     * // with explicit chaining
     * _(characters).chain()
     *   .first()
     *   .pick('age')
     *   .value();
     * // => { 'age': 36 }
     */
    function wrapperChain() {
      this.__chain__ = true;
      return this;
    }

    /**
     * Produces the `toString` result of the wrapped value.
     *
     * @name toString
     * @memberOf _
     * @category Chaining
     * @returns {string} Returns the string result.
     * @example
     *
     * _([1, 2, 3]).toString();
     * // => '1,2,3'
     */
    function wrapperToString() {
      return String(this.__wrapped__);
    }

    /**
     * Extracts the wrapped value.
     *
     * @name valueOf
     * @memberOf _
     * @alias value
     * @category Chaining
     * @returns {*} Returns the wrapped value.
     * @example
     *
     * _([1, 2, 3]).valueOf();
     * // => [1, 2, 3]
     */
    function wrapperValueOf() {
      return this.__wrapped__;
    }

    /*--------------------------------------------------------------------------*/

    // add functions that return wrapped values when chaining
    lodash.after = after;
    lodash.assign = assign;
    lodash.at = at;
    lodash.bind = bind;
    lodash.bindAll = bindAll;
    lodash.bindKey = bindKey;
    lodash.chain = chain;
    lodash.compact = compact;
    lodash.compose = compose;
    lodash.constant = constant;
    lodash.countBy = countBy;
    lodash.create = create;
    lodash.createCallback = createCallback;
    lodash.curry = curry;
    lodash.debounce = debounce;
    lodash.defaults = defaults;
    lodash.defer = defer;
    lodash.delay = delay;
    lodash.difference = difference;
    lodash.filter = filter;
    lodash.flatten = flatten;
    lodash.forEach = forEach;
    lodash.forEachRight = forEachRight;
    lodash.forIn = forIn;
    lodash.forInRight = forInRight;
    lodash.forOwn = forOwn;
    lodash.forOwnRight = forOwnRight;
    lodash.functions = functions;
    lodash.groupBy = groupBy;
    lodash.indexBy = indexBy;
    lodash.initial = initial;
    lodash.intersection = intersection;
    lodash.invert = invert;
    lodash.invoke = invoke;
    lodash.keys = keys;
    lodash.map = map;
    lodash.mapValues = mapValues;
    lodash.max = max;
    lodash.memoize = memoize;
    lodash.merge = merge;
    lodash.min = min;
    lodash.omit = omit;
    lodash.once = once;
    lodash.pairs = pairs;
    lodash.partial = partial;
    lodash.partialRight = partialRight;
    lodash.pick = pick;
    lodash.pluck = pluck;
    lodash.property = property;
    lodash.pull = pull;
    lodash.range = range;
    lodash.reject = reject;
    lodash.remove = remove;
    lodash.rest = rest;
    lodash.shuffle = shuffle;
    lodash.sortBy = sortBy;
    lodash.tap = tap;
    lodash.throttle = throttle;
    lodash.times = times;
    lodash.toArray = toArray;
    lodash.transform = transform;
    lodash.union = union;
    lodash.uniq = uniq;
    lodash.values = values;
    lodash.where = where;
    lodash.without = without;
    lodash.wrap = wrap;
    lodash.xor = xor;
    lodash.zip = zip;
    lodash.zipObject = zipObject;

    // add aliases
    lodash.collect = map;
    lodash.drop = rest;
    lodash.each = forEach;
    lodash.eachRight = forEachRight;
    lodash.extend = assign;
    lodash.methods = functions;
    lodash.object = zipObject;
    lodash.select = filter;
    lodash.tail = rest;
    lodash.unique = uniq;
    lodash.unzip = zip;

    // add functions to `lodash.prototype`
    mixin(lodash);

    /*--------------------------------------------------------------------------*/

    // add functions that return unwrapped values when chaining
    lodash.clone = clone;
    lodash.cloneDeep = cloneDeep;
    lodash.contains = contains;
    lodash.escape = escape;
    lodash.every = every;
    lodash.find = find;
    lodash.findIndex = findIndex;
    lodash.findKey = findKey;
    lodash.findLast = findLast;
    lodash.findLastIndex = findLastIndex;
    lodash.findLastKey = findLastKey;
    lodash.has = has;
    lodash.identity = identity;
    lodash.indexOf = indexOf;
    lodash.isArguments = isArguments;
    lodash.isArray = isArray;
    lodash.isBoolean = isBoolean;
    lodash.isDate = isDate;
    lodash.isElement = isElement;
    lodash.isEmpty = isEmpty;
    lodash.isEqual = isEqual;
    lodash.isFinite = isFinite;
    lodash.isFunction = isFunction;
    lodash.isNaN = isNaN;
    lodash.isNull = isNull;
    lodash.isNumber = isNumber;
    lodash.isObject = isObject;
    lodash.isPlainObject = isPlainObject;
    lodash.isRegExp = isRegExp;
    lodash.isString = isString;
    lodash.isUndefined = isUndefined;
    lodash.lastIndexOf = lastIndexOf;
    lodash.mixin = mixin;
    lodash.noConflict = noConflict;
    lodash.noop = noop;
    lodash.now = now;
    lodash.parseInt = parseInt;
    lodash.random = random;
    lodash.reduce = reduce;
    lodash.reduceRight = reduceRight;
    lodash.result = result;
    lodash.runInContext = runInContext;
    lodash.size = size;
    lodash.some = some;
    lodash.sortedIndex = sortedIndex;
    lodash.template = template;
    lodash.unescape = unescape;
    lodash.uniqueId = uniqueId;

    // add aliases
    lodash.all = every;
    lodash.any = some;
    lodash.detect = find;
    lodash.findWhere = find;
    lodash.foldl = reduce;
    lodash.foldr = reduceRight;
    lodash.include = contains;
    lodash.inject = reduce;

    mixin(function() {
      var source = {}
      forOwn(lodash, function(func, methodName) {
        if (!lodash.prototype[methodName]) {
          source[methodName] = func;
        }
      });
      return source;
    }(), false);

    /*--------------------------------------------------------------------------*/

    // add functions capable of returning wrapped and unwrapped values when chaining
    lodash.first = first;
    lodash.last = last;
    lodash.sample = sample;

    // add aliases
    lodash.take = first;
    lodash.head = first;

    forOwn(lodash, function(func, methodName) {
      var callbackable = methodName !== 'sample';
      if (!lodash.prototype[methodName]) {
        lodash.prototype[methodName]= function(n, guard) {
          var chainAll = this.__chain__,
              result = func(this.__wrapped__, n, guard);

          return !chainAll && (n == null || (guard && !(callbackable && typeof n == 'function')))
            ? result
            : new lodashWrapper(result, chainAll);
        };
      }
    });

    /*--------------------------------------------------------------------------*/

    /**
     * The semantic version number.
     *
     * @static
     * @memberOf _
     * @type string
     */
    lodash.VERSION = '2.4.1';

    // add "Chaining" functions to the wrapper
    lodash.prototype.chain = wrapperChain;
    lodash.prototype.toString = wrapperToString;
    lodash.prototype.value = wrapperValueOf;
    lodash.prototype.valueOf = wrapperValueOf;

    // add `Array` functions that return unwrapped values
    forEach(['join', 'pop', 'shift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        var chainAll = this.__chain__,
            result = func.apply(this.__wrapped__, arguments);

        return chainAll
          ? new lodashWrapper(result, chainAll)
          : result;
      };
    });

    // add `Array` functions that return the existing wrapped value
    forEach(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        func.apply(this.__wrapped__, arguments);
        return this;
      };
    });

    // add `Array` functions that return new wrapped values
    forEach(['concat', 'slice', 'splice'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        return new lodashWrapper(func.apply(this.__wrapped__, arguments), this.__chain__);
      };
    });

    return lodash;
  }

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  var _ = runInContext();

  // some AMD build optimizers like r.js check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash is loaded with a RequireJS shim config.
    // See http://requirejs.org/docs/api.html#config-shim
    root._ = _;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return _;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && freeModule) {
    // in Node.js or RingoJS
    if (moduleExports) {
      (freeModule.exports = _)._ = _;
    }
    // in Narwhal or Rhino -require
    else {
      freeExports._ = _;
    }
  }
  else {
    // in a browser or Rhino
    root._ = _;
  }
}.call(this));

},{}],35:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        throw TypeError('Uncaught, unspecified "error" event.');
      }
      return false;
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      console.trace();
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}]},{},[3])