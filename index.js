var funcs = require("./funcs.js");

exports.handler = function(event, context) {
  console.log('Received event:', JSON.stringify(event, null, 2));
  var backInTimeSeconds = funcs.calculateBackinTimeSeconds(event.backInTime);
  funcs.fetchDataFromDynamoDB(backInTimeSeconds, function(data) {
    context.succeed(data);
  });
};
