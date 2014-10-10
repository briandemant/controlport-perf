var test = require('tape');
var request = require('request');
var fs = require('fs');

var playdohPerf = require('../index.js');

test('profiler /profile route', function (assert) {
  var server = playdohPerf().listen(4123);

  request.post({
    url: 'http://localhost:4123/perf-profile',
    json: {time: 200}
  }, function (err, res, body) {
    assert.equal(body.message, "started profiling");
    assert.equal(res.statusCode, 200, "http status is 200");

    setTimeout(function () {
      request('http://localhost:4123/perf-profile', function (err, res, body) {
        body = JSON.parse(body);
        assert.equal(res.statusCode, 200, "http status is 200");
        assert.equal(typeof body.head, "object", "profile has head object");
        assert.ok(Array.isArray(body.head.children), "profile head has children");

        server.close();
        assert.end();
      });
    }, 400);
  });
});

test('profiler /heap route', function (assert) {
  var tmpdir = require('os').tmpDir();

  var server = playdohPerf({path: tmpdir}).listen(4123);

  request.get('http://localhost:4123/perf-heap', function (err, res, body) {
    body = JSON.parse(body);
    var reg = new RegExp("^" + tmpdir + "/node\\." + process.pid + "\\.[0-9]*\\.heapsnapshot$");
    assert.ok(reg.test(body.path), "path looks correct");

    setTimeout(function () {
      fs.stat(body.path, function (err, stat) {
        assert.ok(!err, "successful stat on path");

        server.close();
        assert.end();
      });
    }, 200);

  });
});

test('profiler /invalid route', function (assert) {
  var server = playdohPerf().listen(4124);

  request.get('http://localhost:4124/invalid', function (err, res, body) {
    assert.equal(res.statusCode, 404);

    server.close();
    assert.end();
  });
});

