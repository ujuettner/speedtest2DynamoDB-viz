if (typeof exports !== "undefined") {
  var AWS = require("aws-sdk");
  var ss = require("simple-statistics");
  var config = require("./config.js");
}

(function(exports){
  exports.calculateBackinTimeSeconds = function(backInTimeLabel) {
    var unit = "d";
    var amount = 1;
    var oneDayInSeconds = 24 * 60 * 60;
    var baseSecondsPerUnit = oneDayInSeconds;

    if (backInTimeLabel) {
      unit = backInTimeLabel.slice(-1);
      amount = Math.abs(parseInt(backInTimeLabel.slice(0, -1)));
    }

    switch(unit) {
      case "w":
        baseSecondsPerUnit = 7 * oneDayInSeconds;
        break;
      case "m":
        baseSecondsPerUnit = 30 * oneDayInSeconds;
        break;
      case "y":
        baseSecondsPerUnit = 365 * oneDayInSeconds;
        break;
      default:
        baseSecondsPerUnit = oneDayInSeconds;
        break;
    }

    return amount * baseSecondsPerUnit;
  };

  exports.fetchDataFromDynamoDB = function(backInTimeSeconds, callback) {
    var nowInSeconds = new Date().getTime() / 1000;
    var newerThan = nowInSeconds - backInTimeSeconds;

    AWS.config.update({
      accessKeyId: config.awsAccessKeyId,
      secretAccessKey: config.awsSecretAccessKey
    });
    AWS.config.region = config.awsRegion;
    var dynamoDb = new AWS.DynamoDB();

    var scanParams = {};
    scanParams.TableName = "speedtestresults";
    scanParams.FilterExpression = "#timeField >= :oldest";
    scanParams.ExpressionAttributeNames = {
      "#timeField": "timestamp"
    };
    scanParams.ExpressionAttributeValues = {
      ":oldest": { "N": newerThan.toString() }
    };

    var data = [];
    dynamoDb.scan(params = scanParams, function(err, fetchedData) {
      if (err) {
        callback(JSON.stringify(err, null, 2))
      } else {
        fetchedData = fetchedData.Items;
        fetchedData.forEach(function(item){
          var dataItem = {};
          // in JavaScript epoch time is in milliseconds, not seconds:
          dataItem["timestamp"] = Number(item.timestamp.N * 1000);
          dataItem["download_bit_per_second"] = Number(item.download_bit_per_second.N);
          data.push(dataItem);
        });
        var values = data.map(function(item) { return item[config.valueDataFieldName]; }).
          sort(function(a, b) {return a -b});
        var mean = ss.mean(values);
        var q50 = ss.quantileSorted(values, 0.5);
        var q80 = ss.quantileSorted(values, 0.8);
        data = data.map(function(item) {
          item["mean"] = mean;
          item["q50"] = q50;
          item["q80"] = q80;
          return item;
        });
        callback(data);
      }
    });
  };

  exports.changeVizAttributes = function() {
    d3.selectAll(".dimple-custom-series-bar").attr("opacity", "0.3");
    d3.selectAll(".dimple-custom-series-bubble").attr("opacity", "0.9").attr("r", 2);
  }

  exports.drawChart = function(data) {
    var xDataFieldName = config.timeDataFieldName;
    var yDataFieldName = config.valueDataFieldName;
    var svg = dimple.newSvg("body", "100%", "95%");
    var chart = new dimple.chart(svg, data);
    chart.setMargins("100px", "10px", "10px", "180px");
    var x = chart.addTimeAxis("x", xDataFieldName, null, "%a, %Y-%m-%d %H:%M:%S");
    x.timePeriod = d3.time.hours;
    x.timeInterval = 3;
    var y = chart.addMeasureAxis("y", yDataFieldName);
    var yMean = chart.addMeasureAxis(y, "mean");
    var yQ50 = chart.addMeasureAxis(y, "q50");
    var yQ80 = chart.addMeasureAxis(y, "q80");
    chart.addColorAxis(yDataFieldName, ["red", "green"]);
    chart.addSeries(yDataFieldName, dimple.plot.bar);
    chart.addSeries(yDataFieldName, dimple.plot.blubble);
    chart.addSeries("mean", dimple.plot.line, [x, yMean]);
    chart.addSeries("q50", dimple.plot.line, [x, yQ50]);
    chart.addSeries("q80", dimple.plot.line, [x, yQ80]);
    chart.draw();
    exports.changeVizAttributes();
    window.onresize = function () {
      chart.draw(0, noDataChange=true);
      exports.changeVizAttributes();
    };
  };
})(typeof exports === "undefined"? this["funcs"] = {} : exports);
