var config = require("./config.js");
var funcs = require("./funcs.js");
var fs = require("fs");
var jsdom = require("jsdom");
var mustache = require("mustache");

exports.handler = function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  var backInTimeSeconds = funcs.calculateBackinTimeSeconds(event.backInTime);
  funcs.fetchDataFromDynamoDB(backInTimeSeconds, function(data, quantiles) {
    fs.readFile("style.css", "utf8", function(err, styledef) {
      if (event.serverRendering && JSON.parse(event.serverRendering)) {
        var htmlStub = mustache.render(
          "<html><head><style>{{{style}}}</style></head><body></body></html>",
          {style: styledef}
        );
        jsdom.env({
          features: { QuerySelector : true },
          html: htmlStub,
          done: function(errors, window) {
            var body = window.document.querySelector("body");
            funcs.drawChart(data, quantiles, body);
            context.succeed(window.document.documentElement.outerHTML);
          }
        });
      } else {
        fs.readFile("template.html", "utf8", function (err, template) {
          var bindings = {
            data: JSON.stringify(data, null, 2),
            quantiles: JSON.stringify(quantiles, null, 2),
            config: JSON.stringify({
              timeDataFieldName: config.timeDataFieldName,
              valueDataFieldName: config.valueDataFieldName
            }, null, 2),
            funcCalculateQuantiles: funcs.calculateQuantiles.toString(),
            funcDrawChart: funcs.drawChart.toString(),
            style: styledef
          };

          context.succeed(mustache.render(template, bindings));
        });
      }
    });
  });
};
