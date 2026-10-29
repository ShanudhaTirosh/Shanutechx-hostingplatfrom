const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

console.log('execFileAsync type:', typeof execFileAsync);
const p = execFileAsync('node', ['-v']);
p.then(({ stdout }) => console.log('execFileAsync working, node version:', stdout.trim()))
 .catch(err => console.error('execFileAsync error:', err));
