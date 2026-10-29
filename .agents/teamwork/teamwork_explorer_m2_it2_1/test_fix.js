const fs = require('fs');
const vm = require('vm');
const path = require('path');

const originalCode = fs.readFileSync(path.resolve(__dirname, '../../../services/node-agent/src/index.js'), 'utf8');

console.log('Original code length:', originalCode.length);

// Test Option 1: Hoist to top of file
// Add imports at top (after line 5)
let opt1 = originalCode.replace(
  "const crypto = require('crypto');\n",
  "const crypto = require('crypto');\nconst { execFile } = require('child_process');\nconst { promisify } = require('util');\nconst execFileAsync = promisify(execFile);\n"
);
// Remove from line 527-529
opt1 = opt1.replace(
  "const { execFile: execFileCb } = require('child_process');\nconst util = require('util');\nconst execFileAsync = util.promisify(execFileCb);\n",
  ""
);
// Remove from line 2017-2019
opt1 = opt1.replace(
  "const { execFile } = require('child_process');\nconst { promisify } = require('util');\nconst execFileAsync = promisify(execFile);\n",
  ""
);

try {
  new vm.Script(opt1, { filename: 'opt1-index.js' });
  console.log('Option 1 Syntax check: PASSED');
} catch (e) {
  console.error('Option 1 Syntax check: FAILED', e);
}

// Test Option 2: Keep at line 527-529, remove duplicate at line 2017-2019
let opt2 = originalCode.replace(
  "const { execFile: execFileCb } = require('child_process');\nconst util = require('util');\nconst execFileAsync = util.promisify(execFileCb);",
  "const { execFile } = require('child_process');\nconst { promisify } = require('util');\nconst execFileAsync = promisify(execFile);"
);
opt2 = opt2.replace(
  "const { execFile } = require('child_process');\nconst { promisify } = require('util');\nconst execFileAsync = promisify(execFile);\n",
  ""
);

try {
  new vm.Script(opt2, { filename: 'opt2-index.js' });
  console.log('Option 2 Syntax check: PASSED');
} catch (e) {
  console.error('Option 2 Syntax check: FAILED', e);
}
