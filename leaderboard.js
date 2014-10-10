// ## leaderboard
// Generates leaderboard based on a profile object.
//
//  type Node :=  {
//    url: String,
//    lineNumber: Number,
//    selfSamplesCount: Number,
//    functionName: String,
//    children: Array<Node>
//  }
//
//  leaderboard := ({
//    head: Node
//  }) => String

function leaderboard (input) {

  var callsCombined = {};
  var callsCombinedArray = [];

  function processNode (node) {
    var id = node.url + ":" + node.lineNumber;
    if (callsCombined[id]) callsCombined[id].selfSamplesCount += node.selfSamplesCount || node.hitCount;
    else callsCombined[id] = {
      selfSamplesCount: node.selfSamplesCount || node.hitCount,
      functionName: node.functionName,
      url: node.url,
      lineNumber: node.lineNumber
    };

    if (node.children) node.children.forEach(processNode);
  }

  processNode(input.head);

  Object.keys(callsCombined).forEach(function (id) {
    var call = callsCombined[id];
    callsCombinedArray.push(call);
  });

  callsCombinedArray.sort(function (a, b) {
    return b.selfSamplesCount - a.selfSamplesCount;
  });

  var out = "";

  for (var i = 0; i < callsCombinedArray.length; i++) {
    if (callsCombinedArray[i].selfSamplesCount === 0) continue;

    out += [
      callsCombinedArray[i].selfSamplesCount,
      ": ",
      callsCombinedArray[i].functionName,
      " (",
      callsCombinedArray[i].url,
      ":",
      callsCombinedArray[i].lineNumber,
      ")",
      "\n"
    ].join('');
  }

  return out;
}

module.exports = leaderboard;
