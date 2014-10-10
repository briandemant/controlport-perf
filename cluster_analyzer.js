var cluster = require('cluster');
var Analyzer = require('./analyzer');
var TypedError = require('error/typed');
var EventEmitter = require('events').EventEmitter;

// # ClusterAnalyzer
// Easy interface for analyzing a cluster of workers from the master process.
// Instantiated in each worker, but all requests for perf data get sent to
// the correct worker.
function ClusterAnalyzer (config) {
  var self = this;

  self.config = config || {};
  self.logger = self.config.logger || {info: console.log, error: console.error};
  self.cluster = self.config.cluster || cluster;
  self.Analyzer = self.config.Analyzer || Analyzer;
  self.process = self.config.process || process;

  // Process-local analyzer
  self.analyzer = new self.Analyzer(config);
  self.workerArray = [];
  self.workersByPid = {};
  self.currentCallId = 0;

  // pending callbacks from worker processes
  self.callbacks = {};

  if (self.cluster.isWorker) self.process.on('message', function (msg) {
    if (msg.type === "perf_analyzer_method") {
      var result = self.analyzer[msg.method].apply(self.analyzer, msg.args);
      self.logger.info("perf: sending result for method " + msg.method + " to master");
      self.process.send({
        type: "perf_analyzer_method_return",
        method: msg.method,
        result: result,
        id: msg.id
      });
    }
  });

  self.handleWorkerMessage = self.handleWorkerMessage.bind(self);
  if (self.cluster.isMaster) self.buildProcessMap();
}

ClusterAnalyzer.WorkerNotFoundError = TypedError({
  type: "cluster_analyzer.error.worker_not_found",
  message: "could not find worker {id} by pid or index"
});

ClusterAnalyzer.NoProfileError = TypedError({
  type: "cluster_analyzer.error.no_profile",
  message: "no profile yet or profiling not started"
});

// ## buildProcessMap
// Builds the map of worker processes. Will need to be re-run on worker death
// or new worker fork
ClusterAnalyzer.prototype.buildProcessMap = function () {
  var self = this;

  var i = 0;
  Object.keys(self.cluster.workers).forEach(function (id) {
    var worker = self.cluster.workers[id];
    self.workerArray[i] = worker;
    i += 1;

    self.workersByPid[worker.process.pid] = worker;

    worker.removeListener('message', self.handleWorkerMessage);
    worker.on('message', self.handleWorkerMessage);
  });
};

// ## handleWorkerMessage
// Handles messages coming up from workers.
ClusterAnalyzer.prototype.handleWorkerMessage = function (msg) {
  var self = this;
  if (msg.type === "perf_analyzer_method_return") {
    self.logger.info("perf: received response for method " + msg.method + " id " + msg.id);
    var callback = self.callbacks[msg.id];
    callback.call(null, msg.result);
  }
};

// ## masterStartProfiling
// Runs an analyzer method on a cluster worker
ClusterAnalyzer.prototype.analyzerMethod = function (method, pidOrId, args, cb) {
  var self = this;

  self.logger.info("perf: sending method call " + method + " to id " + pidOrId);

  var worker = self.workerArray[pidOrId] || self.workersByPid[pidOrId];

  var callId = self.currentCallId;
  self.currentCallId += 1;

  if (!worker)
    return cb(ClusterAnalyzer.WorkerNotFoundError({id: pidOrId}), null);

  self.callbacks[callId] = cb;

  worker.send({
    type: "perf_analyzer_method",
    method: method,
    args: args,
    id: callId
  });
};

// ## startProfiling
// Starts profiling a worker
ClusterAnalyzer.prototype.startProfiling = function (pidOrId, time, cb) {
  var self = this;

  if (pidOrId === "-1" || pidOrId === -1) {
    return cb(self.analyzer.startProfiling());
  }

  self.analyzerMethod('startProfiling', pidOrId, [time], cb);
};

// ## getProfile
// Gets a profile from a worker
ClusterAnalyzer.prototype.getProfile = function (pidOrId, cb) {
  var self = this;

  if (pidOrId === "-1" || pidOrId === -1) {
    var res = self.analyzer.getProfile();
    if (res === null) return cb(ClusterAnalyzer.NoProfileError(), null);
    else return cb(null, res);
  }

  self.analyzerMethod('getProfile', pidOrId, [], function (errOrData) {
    // convert to err, data callback format
    if (errOrData === null) cb(ClusterAnalyzer.NoProfileError(), null);
    else cb(null, errOrData);
  });
};

// ## heapDump
// Gets a heap dump from a worker
ClusterAnalyzer.prototype.heapDump = function (pidOrId, cb) {
  var self = this;

  if (pidOrId === "-1" || pidOrId === -1) {
    return cb(null, self.analyzer.heapDump());
  }

  self.analyzerMethod('heapDump', pidOrId, [], function (path) {
    cb(null, path);
  });
};

module.exports = ClusterAnalyzer;
