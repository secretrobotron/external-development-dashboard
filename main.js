(function(){

var TARGET = 6500000;
var REACH_TARGET = 9000000;
var MAX_Y = 8000000;
var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var GAUNTLET_DATA_URL = 'https://script.google.com/macros/s/AKfycbw8CX3mKuOpfEYNZftmJaBiMDJFygNQ0sjfpHMRqr5lAX-bF_w/exec';
var GRAPH_FILL_STYLE = 'rgba(34, 147, 209, 0.5)';
var GRAPH_LINE_STYLE = 'rgba(34, 147, 209, 1.0)';
var GRAPH_POINT_RADIUS = 10;

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
  var dataPoints = chartContainer.querySelectorAll('.data-points > .data-point');
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

  function alignLabel(x, index){
    var label = xAxisLabels[index];
    label.style.left = x - label.offsetWidth / 2 + 'px';
  }

  function getPositionVector(index) {
    return [
      startX + chartContentRect.width / xAxisLabels.length * index,
      chartContentRect.height * montlyData[index] / MAX_Y
    ];
  }

  function positionDataPoint(dataPoint, p){
    dataPoint.style.left = p[0] + 'px';
    dataPoint.style.top = chartContentRect.height - p[1] + 'px';
  }

  function plotProjections(actualsPoints){
    var p, i, points = [];
    for (i = currentMonth + 1; i < 12; ++i) {
      p = getPositionVector(i);
      positionDataPoint(dataPoints[i], p);
      alignLabel(p[0], i);
      points.push(p);
    }
    drawProjections(points, actualsPoints);
  }

  function plotActuals(){
    var i, p, points = [];
    for (i = 0; i <= currentMonth; ++i) {
      p = getPositionVector(i);
      positionDataPoint(dataPoints[i], p);
      dataPoints[i].classList.add('actual');
      alignLabel(p[0], i);
      points.push(p);
    }
    drawActuals(points);
    return points;
  }

  function drawActuals(points){
    var pair = points[0];
    var i, p;
    var thisPair, nextPair;

    ctx.fillStyle = GRAPH_FILL_STYLE;

    ctx.moveTo(pair[0], dataCanvas.height - pair[1]);
    ctx.beginPath();

    for (i = 1; i < points.length; ++i) {
      pair = points[i];
      ctx.lineTo(pair[0], dataCanvas.height - pair[1]);
    }

    pair = points[i - 1];

    ctx.lineTo(pair[0], dataCanvas.height);
    ctx.lineTo(startX, dataCanvas.height);
    ctx.lineTo(startX, dataCanvas.height - points[0][1]);

    ctx.fill();

    ctx.fillStyle = 'rgba(1, 0, 0, 1.0)';
    ctx.strokeStyle = GRAPH_LINE_STYLE;
    ctx.lineWidth = 7;

    drawLineWithRadialNodes(points, GRAPH_POINT_RADIUS);
  }

  function drawProjections(points, actualsPoints){
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';

    if(ctx.setLineDash){
      ctx.setLineDash([1, 4]);
    }
    else {
      ctx.lineWidth = 1;
    }

    ctx.strokeStyle = '#222';
    drawLineWithRadialNodes(points, GRAPH_POINT_RADIUS, actualsPoints[actualsPoints.length - 1]);
  }

  function drawLineWithRadialNodes(points, radius, startPoint) {
    var p, thisPair, nextPair;
    
    thisPair = points[0];
    nextPair = points[1];

    if (startPoint) {
      points = points.slice();
      points.unshift(startPoint);
    }

    for(var i = 0; i < points.length - 1; ++i){
      thisPair = points[i];
      nextPair = points[i+1];
      
      p = adjustPointForRadius(thisPair[0], thisPair[1], nextPair[0], nextPair[1], radius);

      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(thisPair[0], dataCanvas.height - thisPair[1], radius, 0, Math.PI * 2, true);
      ctx.arc(nextPair[0], dataCanvas.height - nextPair[1], radius, 0, Math.PI * 2, true);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';

      ctx.beginPath();
      ctx.moveTo(p[0][0], dataCanvas.height - p[0][1]);
      ctx.lineTo(p[1][0], dataCanvas.height - p[1][1]);
      ctx.stroke();
    }
  }

  plotProjections(plotActuals());

  function adjustPointForRadius(x, y, nx, ny, r){
    var dy = ny - y;
    var dx = nx - x;

    var d = Math.sqrt(dx*dx + dy*dy);
    var s = dy / d;
    var c = dx / d;

    return [
      [x + c * r, y + s * r],
      [nx - c * r, ny - s * r]
    ];
  }

  var yMarkers = document.querySelectorAll('.y-axis > .y-marker');
  Array.prototype.forEach.call(yMarkers, function(marker, index){
    var value = MAX_Y - ( index / yMarkers.length * MAX_Y );
    var y = chartContentRect.height - chartContentRect.height * value / MAX_Y;
    marker.querySelector('.dollar-value').innerHTML = formatCurrencyNumber(value, 0, '.', ',');
    marker.style.top = y + 'px';
  });

  var eventsContainer = document.querySelector('.events');
  var eventMarker = eventsContainer.querySelector('.event');
  var eventsData = data.donations.events;

  var monthsWithEvents = [];

  Object.keys(eventsData).forEach(function(eventName){
    var eventData = eventsData[eventName];
    eventData.forEach(function(month, index){
      if (eventData[index + 1] !== month + 1) {
        monthsWithEvents[month] = monthsWithEvents[month] || [];
        monthsWithEvents[month].push(eventName);
      }
    });
  });

  removeAllChildren(eventsContainer);

  monthsWithEvents.forEach(function(events, index){
    var newEventMarker = eventMarker.cloneNode(true);
    eventsContainer.appendChild(newEventMarker);
    newEventMarker.style.left = startX + chartContentRect.width / MONTHS.length * index - eventMarker.offsetWidth / 2 + 'px';
    var titleContainer = newEventMarker.querySelector('.title');
    
    removeAllChildren(titleContainer);

    events.forEach(function(event){
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(event));
      titleContainer.appendChild(li);
    });
  });

  var targetContainer = document.querySelector('.target');
  targetContainer.style.top = chartContentRect.height - chartContentRect.height * TARGET / MAX_Y - targetContainer.offsetHeight / 2 + 'px';
  removeAllChildren(targetContainer.querySelector('.value')).appendChild(document.createTextNode(formatCurrencyNumber(TARGET, 0, '.', ',')));
}

function setup(data){
  renderChart(data);
  window.addEventListener('resize', function(e){
    renderChart(data);
  }, false);
}

document.addEventListener('DOMContentLoaded', function(e){
  if(window.location.search.indexOf('test') > -1){
    setup({"donations":{"projections":[35000,11000,111000,51000,11000,21000,21000,26000,291000,71000,21000,611000],"actuals":[33295.71,0,0,0,0,0,0,0,0,0,0,0],"events":{"Humble Bundle ":[2,8],"Manifesto v1.0":[3],"Summer Code Party":[5,6,7,8],"Mozfest Contest":[8,9],"Mozfest Tickets":[7,8,9]}},"grantsAndGifts":{"initiated":[{"value":9930,"date":1325404800000},{"value":83708,"date":1325404800000},{"value":115000,"date":1293868800000},{"value":1000000,"date":1325404800000},{"value":100000,"date":1325404800000},{"value":625387,"date":1293868800000},{"value":79705,"date":1325404800000},{"value":173000,"date":1325404800000},{"value":295000,"date":1362124800000},{"value":287500,"date":1325404800000},{"value":288800,"date":1325404800000}],"uninitiated":[{"value":15200,"date":1370070000000},{"value":95000,"date":1364799600000},{"value":12000,"date":1380610800000},{"value":22500,"date":1378018800000},{"value":90000,"date":1367391600000},{"value":100000,"date":1370070000000},{"value":12000,"date":1364799600000},{"value":9000,"date":1380610800000},{"value":20000,"date":1367391600000},{"value":180000,"date":1362124800000},{"value":249880,"date":1370070000000},{"value":1200000,"date":1370070000000},{"value":50000,"date":1370070000000},{"value":20000,"date":1370070000000},{"value":10000,"date":1370070000000},{"value":5000,"date":1370070000000},{"value":5000,"date":1370070000000},{"value":5000,"date":1370070000000},{"value":10000,"date":1375340400000},{"value":100000,"date":1372662000000},{"value":175000,"date":1372662000000},{"value":37500,"date":1383289200000},{"value":93611,"date":1346482800000},{"value":150000,"date":1367391600000},{"value":16000,"date":1378018800000},{"value":8000,"date":1370070000000},{"value":30000,"date":1372662000000},{"value":60000,"date":1367391600000},{"value":6000,"date":1380610800000},{"value":49999.99999999999,"date":1378018800000},{"value":4000,"date":1367391600000},{"value":0,"date":""}]}});
  }
  else{
    getJSONP(GAUNTLET_DATA_URL, function(json){
      //console.log(JSON.stringify(json));
      setup(json);
    });
  }

}, false);

})();