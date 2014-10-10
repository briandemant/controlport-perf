var profiler = require('v8-profiler');
var heapdump = require('heapdump');
var TypedError = require('error/typed');
var path = require('path');

function Analyzer (config) {
  this.config = config || {};
  this.config.dumpPath = this.config.path || "/var/local/controlport-perf/";
  this.currentProfile = null;
  this.profilingState = 'idle';
}

Analyzer.ProfilingStartedError = TypedError({
  type: 'profile.error.already_started',
  message: 'Profiling already started'
});

Analyzer.prototype.getProfile = function () {
  return this.currentProfile;
};

Analyzer.prototype.startProfiling = function (time) {
  var self = this;

  self.currentProfile = null;

  if (self.profilingState !== 'idle') {
    return Analyzer.ProfilingStartedError();
  }

  self.profilingState = 'profiling';
  profiler.startProfiling();
  self.currentProfile = null;

  setTimeout(function () {
    var profile = profiler.stopProfiling();
    self.currentProfile = profile;
    self.profilingState = 'idle';
  }, time);
};

Analyzer.prototype.heapDump = function () {
  var fullPath = path.join(this.config.dumpPath, [
    process.title,
    '.',
    process.pid,
    '.',
    Date.now(),
    '.heapsnapshot'
  ].join(''));
  heapdump.writeSnapshot(fullPath);

  return fullPath;
};

module.exports = Analyzer;
