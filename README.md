# speedtest2DynamoDB-viz

SVG to visualize the data gathered by [speedtest2DynamoDB](https://github.com/ujuettner/speedtest2DynamoDB) using [D3](http://d3js.org/) and [dimple](http://dimplejs.org/).

## In a browser

* Copy `config.js.sample` to `config.js` and change the configuration values accordingly.
* Open `index.html` in a browser (actually only tested with Google Chrome).

## [AWS Lambda](https://aws.amazon.com/lambda/)

Credits go to [this Grunt plugin](https://github.com/Tim-B/grunt-aws-lambda).

* Install the dependencies: `npm install`
* Copy `Gruntfile.js.sample` to `Gruntfile.js` and change the function ARN accordingly. So, you have to have a previously created function in AWS Lambda!
* Check whether a valid HTML is returned without errors: `grunt lambda_invoke`
  * Optionally, save the HTML output to a local file and open that file in a browser to check whether everything gets rendered nicely.
* Bundle and upload to AWS Lambda: `grunt lambda_package lambda_deploy`
