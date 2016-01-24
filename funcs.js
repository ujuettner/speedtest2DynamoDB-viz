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
        callback(data, config.timeDataFieldName, config.valueDataFieldName);
      }
    });
  };
})(typeof exports === "undefined"? this["funcs"] = {} : exports);
