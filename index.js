var funcs = require("./funcs.js");
var fs = require("fs");
var mustache = require("mustache");

exports.handler = function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));

  var backInTimeSeconds = funcs.calculateBackinTimeSeconds(event.backInTime);
  funcs.fetchDataFromDynamoDB(backInTimeSeconds, function(data) {
    fs.readFile("template.html", "utf8", function (err, template) {
      var bindings = {
        data: JSON.stringify(data, null, 2)
      };
      context.succeed(mustache.render(template, bindings));
    });
  });
};
