var http = require('http');
var jsonBody = require('body/json');
var sendJSON = require('send-data/json');
var util = require('util');
var Routes = require('routes');
var path = require('path');
var TypedError = require('error/typed');
var safeParse = require('safe-json-parse/callback');

var Analyzer = require('./analyzer');

var NotFoundError = TypedError({
  type: 'http.error.no_route',
  message: "Route not found"
});

// Hack to support attaching this router onto existing http routing logic
// that buffers the request *before* sending to our router.
function jsonBodyHack (req, callback) {
  if (req.requestBody) return safeParse(req.requestBody, callback);
  else return jsonBody(req, callback);
}

module.exports = function (config) {
  config = config || {};
  var prefix = config.prefix || "perf-";

  var router = new Routes();
  var analyzer = new Analyzer(config);

  router.addRoute('/' + prefix + 'profile', function (req, res) {
    if (req.method === "GET") {
      var result = analyzer.getProfile();


      if (!result)
        sendJSON(req, res, {
          body: {error: "no profile yet"},
          statusCode: 404
        });

      else sendJSON(req, res, result);
    }

    else if (req.method === "POST") {
      jsonBodyHack(req, function (err, data) {
        if (err) return console.error(util.inspect(err));

        var result = analyzer.startProfiling(data.time);

        if (result && result.type === Analyzer.ProfilingStartedError.type)
          return sendJSON(res, {
            body: {error: "profiling already started"},
            statusCode: 406
          });

        return sendJSON(req, res, {message: "started profiling"});
      });
    }

    else return sendJSON(req, res, {statusCode: 405});
  });

  router.addRoute('/' + prefix + 'heap', function (req, res, next) {
    if (req.method === "GET") {
      var path = analyzer.heapDump();

      sendJSON(req, res, {path: path});
    }

    else return sendJSON(req, res, {statusCode: 405});
  });

  function handler (req, res, opts, next) {
    var route = router.match(req.url);

    if (!route) next(NotFoundError());
    else route.fn.call(null, req, res);
  }

  var server = http.createServer(function (req, res) {
    handler(req, res, {}, function (err) {
      if (err && err.type === NotFoundError.type)
        sendJSON(req, res, {body: {error: "not found"}, statusCode: 404});
      else if (err)
        sendJSON(req, res, {body: {error: "unknown error"}, statusCode: 500});
    });
  });

  server.router = router;
  server.handler = handler;

  return server;
};

module.exports.Analyzer = Analyzer;
module.exports.ClusterAnalyzer = require('./cluster_analyzer');
