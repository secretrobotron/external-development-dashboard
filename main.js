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

// From http://stackoverflow.com/questions/149055/how-can-i-format-numbers-as-money-in-javascript
function formatCurrencyNumber(n, c, d, t){
  var c = isNaN(c = Math.abs(c)) ? 2 : c, d = d == undefined ? "," : d, t = t == undefined ? "." : t, s = n < 0 ? "-" : "", i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "", j = (j = i.length) > 3 ? j % 3 : 0;
  return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
}

function removeAllChildren(node){
  while(node.firstChild){
    node.removeChild(node.firstChild);
  }
  return node;
}

function getJSONP(url, readyCallback){
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

function prepareData(data){
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

function renderChart(data){
  var actualData = data.actual;
  var projectedData = data.projected;
  var chartContainer = document.querySelector('.main-panel > .container');
  var chartContent = chartContainer.querySelector('.chart-content');
  var xAxis = chartContainer.querySelector('.x-axis');
  var xAxisLabels = xAxis.querySelectorAll('li');
  var dataCanvas = chartContainer.querySelector('.data-canvas');

  var chartContentRect = chartContent.getBoundingClientRect();

  dataCanvas.width = chartContentRect.width;
  dataCanvas.height = chartContentRect.height;

  var actualPoints = [];
  var projectedPoints = [];

  var montlyData = prepareData(data);

  var actualData = data.donations.actuals;
  var projectedData = data.donations.projections;

  var currentMonth = new Date(Date.now()).getMonth();

  var startX = xAxisLabels[0].offsetWidth;

  var ctx = dataCanvas.getContext('2d');

  function getPositionVector(index) {
    return [
      startX + chartContentRect.width / xAxisLabels.length * index,
      chartContentRect.height * montlyData[index] / MAX_Y
    ];
  }

  function calculatePoints(){
    var points = [];
    for (var i = 0; i <= 12; ++i) {
      points.push(getPositionVector(i));
    }
    return points;
  }

  function stampOutRadialDataPointBackground(point, radius, offset) {
    offset = offset || 0;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(point[0], dataCanvas.height - point[1] + offset, GRAPH_POINT_RADIUS, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }

  function alignMonthLabel(index, x){
    var label = xAxisLabels[index];
    label.style.left = x - label.offsetWidth / 2 + 'px';
  }

  function plotEvents (points) {
    var nextEvent;
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

    removeAllChildren(dataPointContainer);
    removeAllChildren(eventsBox);

    for (var i = 0; i < 12; ++i) {
      alignMonthLabel(i, points[i][0]);
      if (i >= currentMonth) {
        if (monthsWithEvents[i]) {
          monthsWithEvents[i].forEach(function(eventData, eventIndex){
            var eventBoxContent = createEventBoxContent(eventData);
            eventsBox.appendChild(eventBoxContent);

            var offset = 0;
            var radius = GRAPH_POINT_RADIUS;

            var dataPoint = document.createElement('div');
            dataPoint.classList.add('data-point');
            dataPoint.classList.add('on');
            dataPointContainer.appendChild(dataPoint);

            if (i === currentMonth) {
              offset = GRAPH_POINT_RADIUS * 2.5;
              radius = GRAPH_POINT_RADIUS_SMALL * 2.5;
              dataPoint.classList.add('small');
            }

            stampOutRadialDataPointBackground(points[i], radius, offset);
            dataPoint.style.left = points[i][0] + 'px';
            dataPoint.style.top = chartContentRect.height
              - points[i][1]
              + eventIndex * radius * 1.8
              - (monthsWithEvents[i].length - 1) / 2 * radius * 1.8
              + offset
              + 'px';

            dataPoint.onmouseover = function(e) {
              Array.prototype.forEach.call(eventsBox.childNodes, function(child) {
                child.hidden = true;
              });
              eventBoxContent.hidden = false;
            };
            dataPoint.onmouseout = function(e) {
              eventBoxContent.hidden = true;
              if (nextEvent) {
                nextEvent.hidden = false;
              }
            };

            eventBoxContent.hidden = true;

            nextEvent = nextEvent || eventBoxContent;
          });
        }
      }
    }

    if (nextEvent) {
      nextEvent.hidden = false; 
    }

  }

  function drawActuals(points){
    var pair = points[0];
    var i, p;
    var thisPair, nextPair;

    ctx.lineCap = 'round';

    if(ctx.setLineDash){
      ctx.setLineDash(0);
    }

    ctx.fillStyle = GRAPH_FILL_STYLE;

    ctx.moveTo(pair[0], dataCanvas.height - pair[1]);
    ctx.beginPath();

    for (i = 1; i <= currentMonth; ++i) {
      pair = points[i];
      ctx.lineTo(pair[0], dataCanvas.height - pair[1]);
    }

    pair = points[currentMonth];

    ctx.lineTo(pair[0], dataCanvas.height);
    ctx.lineTo(startX, dataCanvas.height);
    ctx.lineTo(startX, dataCanvas.height - points[0][1]);

    ctx.fill();

    ctx.fillStyle = 'rgba(1, 0, 0, 1.0)';
    ctx.strokeStyle = GRAPH_LINE_STYLE;
    ctx.lineWidth = ACTUAL_LINE_WIDTH;
    ctx.lineCap = 'round';

    drawLine(points, 0, currentMonth);

    var a = -Math.atan((points[currentMonth][1] - points[currentMonth-1][1]) / (points[currentMonth][0] - points[currentMonth-1][0])) + Math.PI / 2;
    
    ctx.lineCap = 'butt';
    ctx.save();
    ctx.translate(points[currentMonth][0], dataCanvas.height - points[currentMonth][1]);
    ctx.scale(2, 2);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(1, 0);
    ctx.lineTo(0, -1.5);
    ctx.lineTo(-1, 0);
    ctx.lineTo(1, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawProjections(points, startPoint){
    ctx.lineWidth = PROJECTION_LINE_WIDTH;
    ctx.lineCap = 'round';

    if(ctx.setLineDash){
      ctx.setLineDash([1, 4]);
      ctx.strokeStyle = '#222';
    }
    else {
      ctx.strokeStyle = '#aaa';
    }

    drawLine(points, currentMonth, 12);
  }

  function drawLine(points, startIndex, stopIndex) {
    ctx.beginPath();
    ctx.moveTo(points[startIndex][0], dataCanvas.height - points[startIndex][1]);
    for(var i = startIndex; i <= stopIndex; ++i){
      ctx.lineTo(points[i][0], dataCanvas.height - points[i][1]);
    }
    ctx.stroke();
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

function setup(data){
  renderChart(data);
  window.addEventListener('resize', function(e){
    renderChart(data);
  }, false);

  document.querySelector('.side-panel .num-users').innerHTML = formatCurrencyNumber(data.donations.contributorCount, 0, '.', ',');

  var funderContainer = document.querySelector('.funder-container');
  var funderList = funderContainer.querySelector('ul');
  
  function funderListLoop (funderList) {
    var y = 0;
    var startTime = Date.now();
    var height = funderList.offsetTop + funderList.offsetHeight + funderContainer.offsetHeight;

    function iterate () {
      var time = Date.now();
      var y = -height * (((time - startTime) % 20000) / 20000);
      var transformString = 'translate(0px,' + y + 'px)';

      funderList.style.transform = transformString;
      funderList.style.webkitTransform = transformString;
      funderList.style.MozTransform = transformString;
      funderList.style.msTransform = transformString;
      funderList.style.OTransform = transformString;

      requestAnimFrame(iterate);
    }

    requestAnimFrame(iterate);
  }
  
  funderListLoop(funderList);
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