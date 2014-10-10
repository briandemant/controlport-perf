= playdoh-perf =

Lives in a service and provides an http endpoint for retrieving performance metrics

To use, require into your project:

```
var perf = require('playdoh-perf');
perf().listen(3202);
```

Then, you can use the CLI to pull out a leaderboard or heapdump:

```
$ playdoh perf -h localhost:3202 -t 3 leaderboard
$ playdoh perf -h localhost:3202 heapdump
```

The `-t` parameter is used to specity the amount of time (in seconds) that we're
profiling for.

`heapdump` will copy the heapdump into the directory it's run from. You can
load these into the chrome developer tools to inspect it.

These commands can be run from a remote host. Everything goes thru ssh:

```
$ playdoh perf -h rf.dev:3202 heapdump
```
