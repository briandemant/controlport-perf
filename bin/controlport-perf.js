#!/usr/bin/env node

var program = require('commander');
var request = require('request');
var util = require('util');
var jsonBody = require('body/json');
var path = require('path');

var sh = require('../shelltools');
var leaderboard = require('../leaderboard');

var usage = [
  '[options] command',
  '',
  'commands:',
  '',
  'heap\t\tgrab heap dump',
  'rawprofile\tprofile process, wait for response, output raw json to stdout',
  'leaderboard\tprofiles process and generates leaderboard',
  '',
  'options:',
  '',
  '-t, --time [secs]\tprofiling time, defaults to 5s',
  '-p, --prefix [prefix]\tcontrol port command prefix',
  '-h, --host [name/ip:port(:worker)]\thost:port(:worker) where controlport-perf is running, defaults to localhost:3202 with no worker. If worker is specified, we\'ll analyze that particular worker, if supported'
].join('\n');

function parseHost (host) {
  if (!host || !/.*:[0-9]*/.test(host)) {
    console.error("must specity host and port, like -h localhost:3202");
    return false;
  }

  var parts = program.host.split(":");
  var worker = "";
  if (parts[2]) {
    worker = "/" + parts[2];
  }
  return {host: parts[0], port: parts[1], worker: worker};
}

function getHeapDump () {
  var host = parseHost(program.host);
  if (!host) return; // host parse error

  var url = program.prefix + "heap" + host.worker;

  sh.curlJSON(host.host, host.port, url, function (err, body) {
    if (err) return console.error(err);

    // body.path contains heap dump path

    var oldsize = 0;
    setTimeout(function timeout () {
      sh.stat(host.host, body.path, function (err, size) {
        if (err) return console.error(err);

        if (oldsize !== size) {
          process.stdout.write('.');
          oldsize = size;
          setTimeout(timeout, 5000);
        }

        else {
          console.log("\nCopying heap dump");
          var dest = path.basename(body.path);

          sh.scp(host.host, body.path, dest, function (err) {
            if (err) console.error(err);

            console.log("Heap dump copied to " + dest);
          });
        }
      });
    }, 5000);
  });
}

function getProfile (callback) {
  var host = parseHost(program.host);
  if (!host) return; // host parse error

  program.time *= 1000;

  var data = {time: program.time};
  var url = program.prefix + 'profile' + host.worker;
  sh.curlJSON(host.host, host.port, url, data, function (err, body) {
    if (err) return callback(err);

    if (body.message !== "started profiling")
      return callback(new Error(util.inspect(body)));

    // Wait for profile to be done, then retrieve it
    setTimeout(function () {
      sh.curlJSON(host.host, host.port, url, callback);
    }, program.time + 2000);
  });
}

function main (command) {
  program
    .version('0.0.1')
    .usage(usage)
    .option('-t, --time [secs]', '', 5)
    .option('-h, --host [name/ip]', '', 'localhost:3201')
    .option('-p, --prefix [prefix]', '', '')
    .parse(process.argv);

  // if we weren't passed a command, controlport-perf is being run in standalone
  // mode, so try to pull command from program.args; otherwise we got it
  // from minimist (args._[0] in exports below)

  if (!program.prefix) program.prefix = 'perf-';

  if (!command) {
    if (program.args[0]) {
      command = program.args[0];
    } else {
      return console.error(usage);
    }
  }

  if (!program.prefix) program.prefix = 'perf-';

  if (command === "rawprofile") {
    getProfile(function (err, data) {
      if (err) console.error(err);
      else console.log(JSON.stringify(data, false, 2));
    });
  }

  else if (command === "leaderboard") {
    getProfile(function (err, data) {
      if (err) console.error(err);
      else console.log(leaderboard(data));
    });
  }

  else if (command === "heap") getHeapDump();
  else console.log(usage);

}

if (require.main === module) {
  main();
}

else {
  module.exports = function (args) {
    if (!args._[0]) return console.error(usage);
    main(args._[0]);
  };

  module.exports.help = function () {
    console.error(usage);
  };
}
