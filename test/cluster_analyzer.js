var test = require('tape');
var ClusterAnalyzer = require('../cluster_analyzer');
var EventEmitter = require('events').EventEmitter;

function noop () {}

function makeSimpleMockAnalyzerConstructor (config) {
  function SimpleMockAnalyzer () {}
  SimpleMockAnalyzer.prototype.heapDump = function () {
    return config.heapDumpPath;
  };

  return SimpleMockAnalyzer;
}

test('cluster analyzer passes messages to correct worker', function (assert) {
  var logger = {
    info: noop, error: noop
  };

  var masterClusterModule = {
    isMaster: true,
    workers: {}
  };

  var worker = new EventEmitter();
  worker.process = {
    pid: 100
  };
  masterClusterModule.workers.someguid = worker;

  var masterClusterAnalyzer = new ClusterAnalyzer({
    cluster: masterClusterModule,
    Analyzer: makeSimpleMockAnalyzerConstructor({
      heapDumpPath: "/path/to/master/heap.dump"
    }),
    logger: logger
  });

  var workerClusterModule = {isWorker: true};


  var workerClusterAnalyzer = new ClusterAnalyzer({
    cluster: workerClusterModule,
    Analyzer: makeSimpleMockAnalyzerConstructor({
      heapDumpPath: "/path/to/worker/heap.dump"
    }),
    process: new EventEmitter(),
    logger: logger
  });

  workerClusterAnalyzer.process.send = function (msg) {
    assert.equal(msg.type, "perf_analyzer_method_return");
    assert.equal(msg.method, "heapDump");
    assert.equal(msg.result, "/path/to/worker/heap.dump");
    worker.emit('message', msg);
  };

  worker.send = function (msg) {
    assert.equal(msg.type, "perf_analyzer_method");
    assert.equal(msg.method, "heapDump");
    workerClusterAnalyzer.process.emit('message', msg);
  };

  var done = 0;

  masterClusterAnalyzer.heapDump(100, function (err, data) {
    assert.equal(err, null);
    assert.equal(data, "/path/to/worker/heap.dump");

    done += 1;
    if (done === 2) assert.end();
  });

  masterClusterAnalyzer.heapDump(-1, function (err, data) {
    assert.equal(err, null);
    assert.equal(data, "/path/to/master/heap.dump");

    done += 1;
    if (done === 2) assert.end();
  });
});
