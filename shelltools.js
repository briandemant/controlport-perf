var exec = require('child_process').exec;
var util = require('util');
require('colors');

// # ShellError
// Represents a shell error
function ShellError (command, shellErr, host, stdout, stderr, description) {
  Error.call(this);

  this.command = command;
  this.shellErr = shellErr;
  this.code = shellErr && shellErr.code;
  this.host = host;
  this.stdout = stdout;
  this.stderr = stderr;
  this.description = description;
}

util.inherits(ShellError, Error);

ShellError.prototype.toString = function () {
  if (this.description) return this.description;

  return [
    "Command over SSH failed:".red,
    "",
    "\t" + this.command,
    "",
    "host: " + this.host,
    "return code: " + this.code,
    "err: " + this.err,
    "shellErr: " + this.shellErr
  ].join("\n");
};

ShellError.prototype.inspect = ShellError.prototype.toString;

// ## scp
// Copies file from `host` called `remote` to `local`
function scp (host, remote, local, cb) {
  var cmd = 'scp ' + host + ':' + remote + ' ' + local;
  exec(cmd, {}, function (err, stdout, stderr) {
    if (err) return cb(new ShellError(cmd, err, host, stdout, stderr));

    cb(null, stdout, stderr);
  });
}

// ## ssh
// Runs cmd on host via ssh
function ssh (host, cmd, cb) {
  exec("ssh -o VisualHostKey\\ no " + host + " -- " + cmd, {maxBuffer: 100 * 1024 * 1024}, cb);
}

// ## curlJSON
// Curls JSON from localhost over ssh. Optional data parameter will cause
// request to be a POST
function curlJSON (host, port, path, data, cb) {
  var cmd;
  var url = "http://localhost:" + port + "/" + path;

  if (!cb && typeof data === 'function') {
    cb = data;      // data is optional
    cmd = "curl -sS " + url;
  }

  else {
    data = JSON.stringify(data).replace(/"/g, '\\"');
    cmd = "curl -sS -d '" + data + "' -X POST " + url;
  }

  ssh(host, cmd, function (err, stdout, stderr) {
    if (stderr) console.error(stderr);
    if (err) return cb(new ShellError(cmd, err, host, stdout, stderr));

    var data;
    try { data = JSON.parse(stdout); }
    catch (e) {
      return cb(new ShellError(
        cmd, err, host, stdout, stderr,
        "Could not parse JSON response for url " + url + " on remote host " +
        host + ", got invalid data: " + stdout
      ));
    }

    cb(null, data);
  });
}

function stat (host, path, cb) {
  var cmd = 'stat -c %s ' + path;
  ssh(host, cmd, function (err, stdout, stderr) {
    if (stderr) console.error(stderr);
    if (err) return cb(new ShellError(cmd, err, host, stdout, stderr));

    var num = parseInt(stdout, 10);
    if (isNaN(num)) {
      return cb(new ShellError(
        cmd, err, host, stdout, stderr,
        "Could not parse output of stat for file " + path +
        " on host " + host + ", got invalid data: " + stdout
      ));
    }

    cb(null, num);
  });
}

exports.ssh = ssh;
exports.scp = scp;
exports.curlJSON = curlJSON;
exports.stat = stat;
