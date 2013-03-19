(function(){

var requestAnimFrame = (function(){
  return  window.requestAnimationFrame       ||
          window.webkitRequestAnimationFrame ||
          window.mozRequestAnimationFrame    ||
          function( callback ){
            window.setTimeout(callback, 1000 / 60);
          };
})();

var TARGET = 6500000;
var REACH_TARGET = 9000000;
var MAX_Y = 8000000;
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var GAUNTLET_DATA_URL = 'https://script.google.com/macros/s/AKfycbw8CX3mKuOpfEYNZftmJaBiMDJFygNQ0sjfpHMRqr5lAX-bF_w/exec';
var GRAPH_FILL_STYLE = 'rgba(34, 147, 209, 0.5)';
var GRAPH_LINE_STYLE = 'rgba(34, 147, 209, 1.0)';
var GRAPH_POINT_RADIUS = 10;
var GRAPH_POINT_RADIUS_SMALL = 7;
var ACTUAL_LINE_WIDTH = 7;
var PROJECTION_LINE_WIDTH = 2;
var FUNDER_SCROLL_TIME = 17000;
var META_CANVAS_WAIT_TIMEOUT = 500;

// From http://stackoverflow.com/questions/149055/how-can-i-format-numbers-as-money-in-javascript
function formatCurrencyNumber (n, c, d, t) {
  c = isNaN(c = Math.abs(c)) ? 2 : c, d = d === undefined ? "," : d, t = t === undefined ? "." : t, s = n < 0 ? "-" : "", i = parseInt(n = Math.abs(+n || 0).toFixed(c), 10) + "", j = (j = i.length) > 3 ? j % 3 : 0;
  return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
}

function removeAllChildren (node) {
  while(node.firstChild){
    node.removeChild(node.firstChild);
  }
  return node;
}

function getJSONP (url, readyCallback) {
  var script = document.createElement('script');
  var callbackName = 'jsonpCallback' + Date.now() + Math.round(Math.random() * 100000);

  script.src = url + (url.indexOf('?') === -1 ? '?' : '&') + 'jsonp=' + callbackName;

  document.head.appendChild(script);

  window[callbackName] = function(json){
    document.head.removeChild(script);
    delete window[callbackName];
    readyCallback(json);
  };
}

function prepareData (data) {
  var januaryDate = new Date('January 1, 2013').valueOf();
  var currentDate = new Date(Date.now());
  var currentMonth = currentDate.getMonth();
  var eoyDate = new Date('January 1, 2014');
  var monthsLeftInYear = new Date(eoyDate - currentDate).getMonth();
  var totalInitiatedPrior = 0;
  var donationsData = data.donations;
  var ggInitiated = data.grantsAndGifts.initiated;
  var ggUninitiated = data.grantsAndGifts.uninitiated;
  var uninitiatedMontlySpread = 0;
  var monthlyValues = [];
  var actualsData = donationsData.actuals;
  var projectionsData = donationsData.projections;

  MONTHS.forEach(function(month, index){
    monthlyValues[index] = 0;
  });

  ggInitiated.forEach(function(item){
    if(item.date < januaryDate){
      monthlyValues[0] += item.value;
    }
    else {
      monthlyValues[new Date(item.date).getMonth()] += item.value;
    }
  });

  ggUninitiated.forEach(function(item){
    if(item.date < januaryDate){
      uninitiatedMontlySpread += item.value / monthsLeftInYear;
    }
    else {
      monthlyValues[new Date(item.date).getMonth()] += item.value;
    }
  });

  var previousValue = 0;

  MONTHS.forEach(function(month, index){
    previousValue = monthlyValues[index] =  monthlyValues[index] + 
                                            uninitiatedMontlySpread +
                                            previousValue +
                                            actualsData[index] +
                                            projectionsData[index];
  });

  return monthlyValues;
}

function renderChart (data) {
  var chartContainer = document.querySelector('.main-panel > .container');
  var chartContent = chartContainer.querySelector('.chart-content');
  var xAxis = chartContainer.querySelector('.x-axis');
  var xAxisLabels = xAxis.querySelectorAll('li');
  var dataCanvas = chartContainer.querySelector('.data-canvas');
  var metaCanvas = chartContainer.querySelector('.meta-canvas');
  var eventsContainer = document.querySelector('.events');

  var chartContentRect = chartContent.getBoundingClientRect();

  dataCanvas.width = chartContentRect.width;
  dataCanvas.height = chartContentRect.height;
  metaCanvas.width = chartContentRect.width;
  metaCanvas.height = chartContentRect.height;

  var actualPoints = [];
  var projectedPoints = [];

  var montlyData = prepareData(data);

  var actualData = data.donations.actuals;
  var projectedData = data.donations.projections;

  var currentMonth = new Date(Date.now()).getMonth();

  var startX = xAxisLabels[0].offsetWidth;

  var dataCtx = dataCanvas.getContext('2d');

  var metaCanvasWaitTimeout = null;

  function getPositionVector (index) {
    return [
      startX + chartContentRect.width / xAxisLabels.length * index,
      chartContentRect.height * montlyData[index] / MAX_Y
    ];
  }

  function calculatePoints () {
    var points = [];
    for (var i = 0; i <= 12; ++i) {
      points.push(getPositionVector(i));
    }
    return points;
  }

  function stampOutRadialDataPointBackground (x, y, radius, offset, ctx) {
    ctx = ctx || dataCtx;
    var previousCompositeOperation = ctx.globalCompositeOperation;
    offset = offset || 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y + offset, GRAPH_POINT_RADIUS, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.globalCompositeOperation = previousCompositeOperation;
  }

  function alignMonthLabel (index, x) {
    var label = xAxisLabels[index];
    label.style.left = x - label.offsetWidth / 2 + 'px';
  }

  function drawMetaCanvasProjectionBoxFromDataPoint (dataPoint) {
    drawMetaCanvasProjectionBoxTo(dataPoint.offsetLeft + dataPoint.offsetWidth / 2, dataPoint.offsetTop + dataPoint.offsetHeight / 2);
  }

  function drawMetaCanvasProjectionBoxTo (x, y) {
    var ctx = metaCanvas.getContext('2d');
    var eventsRect = eventsContainer.getBoundingClientRect();
    ctx.fillStyle = 'rgba(239, 73, 34, 1.0)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    if (x > eventsContainer.offsetLeft) {
      ctx.lineTo(eventsContainer.offsetLeft + eventsContainer.clientLeft * 2, eventsContainer.offsetTop + eventsContainer.clientLeft * 2);
    }
    else {
      ctx.lineTo(eventsContainer.offsetLeft + eventsContainer.clientLeft * 2, eventsContainer.offsetTop + eventsContainer.offsetHeight);
    }
    ctx.lineTo(eventsContainer.offsetLeft + eventsContainer.offsetWidth, eventsContainer.offsetTop + eventsContainer.clientLeft * 2);
    ctx.closePath();
    ctx.fill();

    stampOutRadialDataPointBackground(x, y, GRAPH_POINT_RADIUS, 0, ctx);

    if (metaCanvasWaitTimeout) {
      clearTimeout(metaCanvasWaitTimeout);
      metaCanvasWaitTimeout = null;
    }
  }

  function waitAndDrawMetaCanvasProjectionFromDataPoint (dataPoint) {
    waitAndDrawMetaCanvasProjection(dataPoint.offsetLeft + dataPoint.offsetWidth / 2, dataPoint.offsetTop + dataPoint.offsetHeight / 2);
  }

  function waitAndDrawMetaCanvasProjection (x, y) {
    if (metaCanvasWaitTimeout) {
      clearTimeout(metaCanvasWaitTimeout);
    }
    metaCanvasWaitTimeout = setTimeout(function(){
      clearTimeout(metaCanvasWaitTimeout);
      metaCanvasWaitTimeout = null;
      clearMetaCanvasProjection();
      drawMetaCanvasProjectionBoxTo(x, y);
    }, META_CANVAS_WAIT_TIMEOUT);
  }

  function clearMetaCanvasProjection () {
    var ctx = metaCanvas.getContext('2d');
    ctx.clearRect(0, 0, metaCanvas.width, metaCanvas.height);

    if (metaCanvasWaitTimeout) {
      clearTimeout(metaCanvasWaitTimeout);
      metaCanvasWaitTimeout = null;
    }
  }

  function plotEvents (points) {
    var nextEvent, nextEventDataPoint, nextEventPosition;
    var eventsBox = document.querySelector('.events');
    var dataPointContainer = document.querySelector('.data-points');

    function createEventBoxContent (eventData) {
      var li = document.createElement('li');
      var h = document.createElement('h4');
      var p = document.createElement('p');
      li.classList.add('event');
      p.classList.add('description');
      h.classList.add('title');
      p.appendChild(document.createTextNode(eventData.description));
      h.appendChild(document.createTextNode(eventData.name));
      li.appendChild(h);
      li.appendChild(p);
      return li;
    }

    function plotMonth (month, monthIndex) {
      month.forEach(function(eventData, eventIndex){
        var eventBoxContent = createEventBoxContent(eventData);
        eventsBox.appendChild(eventBoxContent);

        var offset = 0;
        var radius = GRAPH_POINT_RADIUS;

        var dataPoint = document.createElement('div');
        dataPoint.classList.add('data-point');
        dataPoint.classList.add('on');
        dataPointContainer.appendChild(dataPoint);

        if (monthIndex === currentMonth) {
          offset = GRAPH_POINT_RADIUS * 2.5;
          radius = GRAPH_POINT_RADIUS_SMALL * 2.5;
          dataPoint.classList.add('small');
        }

        var x = points[monthIndex][0];
        var y = chartContentRect.height -
          points[monthIndex][1] +
          eventIndex * radius * 1.8 -
          (monthsWithEvents[monthIndex].length - 1) / 2 * radius * 1.8 +
          offset;

        stampOutRadialDataPointBackground(points[monthIndex][0], dataCanvas.height - points[monthIndex][1], radius, offset);
        dataPoint.style.left = x + 'px';
        dataPoint.style.top = y + 'px';

        dataPoint.onmouseover = function(e) {
          Array.prototype.forEach.call(eventsBox.childNodes, function(child) {
            child.hidden = true;
          });
          eventBoxContent.hidden = false;
          clearMetaCanvasProjection();
          drawMetaCanvasProjectionBoxFromDataPoint(dataPoint);
        };

        dataPoint.onmouseout = function(e) {
          eventBoxContent.hidden = true;
          clearMetaCanvasProjection();
          if (nextEvent) {
            nextEvent.hidden = false;
            if (dataPoint === nextEventDataPoint) {
              drawMetaCanvasProjectionBoxFromDataPoint(dataPoint);
            }
            else {
              waitAndDrawMetaCanvasProjectionFromDataPoint(nextEventDataPoint);
            }
          }
        };

        eventBoxContent.hidden = true;

        nextEvent = nextEvent || eventBoxContent;
        nextEventDataPoint = nextEventDataPoint || dataPoint;
        nextEventPosition = nextEventPosition || [x, y];
      });
    }

    removeAllChildren(dataPointContainer);
    removeAllChildren(eventsBox);

    for (var i = 0; i < 12; ++i) {
      alignMonthLabel(i, points[i][0]);
      if (i >= currentMonth) {
        if (monthsWithEvents[i]) {
          plotMonth(monthsWithEvents[i], i);
        }
      }
    }

    if (nextEvent) {
      waitAndDrawMetaCanvasProjection(nextEventPosition[0], nextEventPosition[1]);
      nextEvent.hidden = false; 
    }

  }

  function drawActuals (points) {
    var currentDate = new Date(Date.now());
    var daysInCurrentMonth = new Date(currentDate.getYear(), currentDate.getMonth()+1, 0).getDate();

    var pair = points[0];
    var i, p;
    var thisPair, nextPair;

    dataCtx.lineCap = 'round';

    if(dataCtx.setLineDash){
      dataCtx.setLineDash(0);
    }

    dataCtx.fillStyle = GRAPH_FILL_STYLE;

    dataCtx.moveTo(pair[0], dataCanvas.height - pair[1]);
    dataCtx.beginPath();

    for (i = 1; i <= currentMonth; ++i) {
      pair = points[i];
      dataCtx.lineTo(pair[0], dataCanvas.height - pair[1]);
    }

    pair = points[currentMonth];

    dataCtx.lineTo(pair[0], dataCanvas.height);
    dataCtx.lineTo(startX, dataCanvas.height);
    dataCtx.lineTo(startX, dataCanvas.height - points[0][1]);

    dataCtx.fill();

    dataCtx.fillStyle = 'rgba(1, 0, 0, 1.0)';
    dataCtx.strokeStyle = GRAPH_LINE_STYLE;
    dataCtx.lineWidth = ACTUAL_LINE_WIDTH;
    dataCtx.lineCap = 'round';

    drawLine(points, 0, currentMonth);

    if (currentMonth < 12) {
      var dateMultiplier = currentDate.getDate() / daysInCurrentMonth;
      var dist = [points[currentMonth+1][0] - points[currentMonth][0], points[currentMonth+1][1] - points[currentMonth][1]];
      var lastPoint = [points[currentMonth][0] + dist[0]*dateMultiplier, dataCanvas.height - points[currentMonth][1] - dist[1]*dateMultiplier];
      var a = -Math.atan((dist[1]) / (dist[0])) + Math.PI / 2;

      dataCtx.beginPath();
      dataCtx.moveTo(points[currentMonth][0], dataCanvas.height - points[currentMonth][1]);
      dataCtx.lineTo(lastPoint[0], lastPoint[1]);
      dataCtx.stroke();
    
      dataCtx.lineCap = 'butt';
      dataCtx.save();
      dataCtx.translate(lastPoint[0], lastPoint[1]);
      dataCtx.scale(2, 2);
      dataCtx.rotate(a);
      dataCtx.beginPath();
      dataCtx.moveTo(-1, 0);
      dataCtx.lineTo(1, 0);
      dataCtx.lineTo(0, -1.5);
      dataCtx.lineTo(-1, 0);
      dataCtx.lineTo(1, 0);
      dataCtx.stroke();
      dataCtx.restore();
    }
  }

  function drawProjections (points, startPoint) {
    dataCtx.lineWidth = PROJECTION_LINE_WIDTH;
    dataCtx.lineCap = 'round';

    if(dataCtx.setLineDash){
      dataCtx.setLineDash([1, 4]);
      dataCtx.strokeStyle = '#222';
    }
    else {
      dataCtx.strokeStyle = '#aaa';
    }

    drawLine(points, currentMonth, 12);
  }

  function drawLine (points, startIndex, stopIndex) {
    dataCtx.beginPath();
    dataCtx.moveTo(points[startIndex][0], dataCanvas.height - points[startIndex][1]);
    for(var i = startIndex; i <= stopIndex; ++i){
      dataCtx.lineTo(points[i][0], dataCanvas.height - points[i][1]);
    }
    dataCtx.stroke();
  }

  var yMarkers = document.querySelectorAll('.y-axis > .y-marker');
  Array.prototype.forEach.call(yMarkers, function(marker, index){
    var value = MAX_Y - ( index / yMarkers.length * MAX_Y );
    var y = chartContentRect.height - chartContentRect.height * value / MAX_Y;
    marker.querySelector('.dollar-value').innerHTML = '$' + formatCurrencyNumber(value, 0, '.', ',');
    marker.style.top = y + 'px';
  });

  var eventsData = data.donations.events;
  var monthsWithEvents = [];

  Object.keys(eventsData).forEach(function(eventName){
    var eventData = eventsData[eventName];
    eventData.dates.forEach(function(month, index){
      monthsWithEvents[month] = monthsWithEvents[month] || [];
      monthsWithEvents[month].push({name: eventName, description: eventData.description});
    });
  });

  var targetContainer = document.querySelector('.target');
  targetContainer.style.top = chartContentRect.height - chartContentRect.height * TARGET / MAX_Y - targetContainer.offsetHeight / 2 + 'px';
  removeAllChildren(targetContainer.querySelector('.value')).appendChild(document.createTextNode('$' + formatCurrencyNumber(TARGET, 0, '.', ',')));

  var points = calculatePoints();
  drawProjections(points);
  drawActuals(points);
  plotEvents(points);
}

function setup (data) {
  var resizeTimeout = null;

  renderChart(data);

  window.addEventListener('resize', function (e) {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    resizeTimeout = setTimeout(function(){
      clearTimeout(resizeTimeout);
      resizeTimeout = null;
      renderChart(data);
    }, 250);
  }, false);

  document.querySelector('.side-panel .num-users').innerHTML = formatCurrencyNumber(data.donations.contributorCount, 0, '.', ',');

  var funderContainer = document.querySelector('.funder-container');
  var funderList = funderContainer.querySelector('ul');
  var funderListClone = funderList.cloneNode(true);

  function funderListLoop (funderList, offset) {
    var y = 0;
    var startTime;
    var lastTime = Date.now();
    offset = offset || 0;

    var introHeight = funderContainer.offsetHeight;

    function iterate () {
      var time = Date.now();

      // height is retrieved in iterate() to lazily correct for inaccurate measures while page is loading fully
      var height = funderList.offsetHeight;

      var y;

      if (introHeight > 0) {
        // be careful when altering this code. it is assumed that the pixel heights of the <li> elements won't change.
        // if they do, this distance calculation will be innacurate.
        y = introHeight + offset * height;
        introHeight -= (height / FUNDER_SCROLL_TIME) * (time - lastTime);
        startTime = time;
      }
      else {
        y = -height * (((time - startTime) % FUNDER_SCROLL_TIME) / FUNDER_SCROLL_TIME) + offset * height;
      }
      
      var transformString = 'translate(0px,' + y + 'px)';

      funderList.style.transform = transformString;
      funderList.style.webkitTransform = transformString;
      funderList.style.MozTransform = transformString;
      funderList.style.msTransform = transformString;
      funderList.style.OTransform = transformString;

      lastTime = time;

      requestAnimFrame(iterate);
    }

    requestAnimFrame(iterate);
  }
  
  funderListLoop(funderList);
  funderContainer.appendChild(funderListClone);
  funderListLoop(funderListClone, 1);
}

document.addEventListener('DOMContentLoaded', function(e){
  if(window.location.search.indexOf('test') > -1){
    var xhr = new XMLHttpRequest();
    xhr.onload = function(){
      setup(JSON.parse(xhr.response));
    };
    xhr.open('GET', 'test.json', false);
    xhr.send();
  }
  else{
    getJSONP(GAUNTLET_DATA_URL, function(json){
      // console.log(JSON.stringify(json));
      setup(json);
    });
  }
}, false);

})();