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

  exports.calculateQuantiles = function(data) {
    var values = data.map(function(item) { return item[config.valueDataFieldName]; })
          .sort(function(a, b) {return a - b});
    return {
      mean: ss.mean(values),
      q50: ss.quantileSorted(values, 0.5),
      q80: ss.quantileSorted(values, 0.8)
    }
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
          dataItem[config.timeDataFieldName] = Number(item.timestamp.N * 1000);
          dataItem[config.valueDataFieldName] = Number(item.download_bit_per_second.N);
          data.push(dataItem);
        });
        callback(data, exports.calculateQuantiles(data));
      }
    });
  };

  exports.drawChart = function(data, quantiles) {
    data.forEach(function(d) {
      d[config.timeDataFieldName] = +d[config.timeDataFieldName];
      d[config.valueDataFieldName] = +d[config.valueDataFieldName];
    });

    var margin = {top: 10, right: 120, bottom: 150, left: 60},
        width = 1600 - margin.left - margin.right,
        height = 800 - margin.top - margin.bottom;
    var barWidth = Math.max.apply(Math, [3, width / data.length]);

    var formatDatetime = d3.time.format("%a, %Y-%m-%d %H:%M:%S");
    var formatDatetimeTooltip = d3.time.format("%Y-%m-%d %H:%M");
    var formatValue = d3.format("4.4s");

    var x = d3.time.scale()
      .range([0, width]);

    var y = d3.scale.linear()
      .range([height, 0]);

    var xAxis = d3.svg.axis()
      .scale(x)
      .tickFormat(formatDatetime)
      .orient("bottom");

    var yAxis = d3.svg.axis()
      .scale(y)
      .tickFormat(formatValue)
      .orient("left");

    var body = d3.select("body");

    var div = body.append("div")
      .attr("class", "tooltip")
      .style("opacity", 0);

    var svg = body.append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("g")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    x.domain(d3.extent(data, function(d) { return d[config.timeDataFieldName]; }));
    y.domain([0, d3.max(data, function(d) { return d[config.valueDataFieldName]; })]);

    svg.append("g")
      .attr("class", "x axis")
      .attr("transform", "translate(0," + height + ")")
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("dx", "-10px")
      .attr("dy", "-2px")
      .attr("transform", function(d) {
        return "rotate(-65)";
      });

    svg.append("g")
      .attr("class", "y axis")
      .call(yAxis);

    svg.selectAll(".bar")
      .data(data)
      .enter().append("rect")
      .attr("class", "bar")
      .attr("x", function(d) {
        return x(d[config.timeDataFieldName]) - barWidth/2;
      })
      .attr("y", function(d) {
        return y(d[config.valueDataFieldName]);
      })
      .attr("height", function(d) {
        return height - y(d[config.valueDataFieldName]);
      })
      .attr("width", barWidth - 1)
      .attr("fill", function(d) {
        return (quantiles["mean"] && d[config.valueDataFieldName] < quantiles["mean"]) ? "red" : "green";
      })
      .attr("opacity", "0.3")
      .on("mouseover", function(d) {
        div.transition()
        .duration(200)
        .style("opacity", 0.9);
        div.text(formatDatetimeTooltip(new Date(d[config.timeDataFieldName])) + ": " + formatValue(d[config.valueDataFieldName]))
        .style("left", (d3.event.pageX) + "px")
        .style("top", (d3.event.pageY) + "px");
      })
      .on("mouseout", function(d) {
        div.transition()
        .duration(400)
        .style("opacity", 0);
      });

    var x1 = x(d3.min(data, function(d) { return d[config.timeDataFieldName]; }));
    var x2 = x(d3.max(data, function(d) { return d[config.timeDataFieldName]; }));
    for (var key in quantiles) {
      svg.append("line")
        .attr("x1", x1)
        .attr("y1", y(quantiles[key]))
        .attr("x2", x2 + barWidth/2)
        .attr("y2", y(quantiles[key]))
        .style("stroke", "gray");

      svg.append("text")
        .attr("transform", "translate(" + (width + barWidth/2 + 5) + ", " + y(quantiles[key]) + ")")
        .style("fill", "black")
        .text(key + ": " + formatValue(+quantiles[key]));
    };
  };
})(typeof exports === "undefined"? this["funcs"] = {} : exports);
