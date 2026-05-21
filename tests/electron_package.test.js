const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const mainJs = fs.readFileSync('main.js', 'utf8');

test('Electron package keeps the app identity as timer', () => {
  assert.equal(packageJson.name, 'timer');
  assert.equal(packageJson.build.productName, 'timer');
  assert.equal(packageJson.build.executableName, 'timer');
  assert.equal(packageJson.scripts.start, 'electron .');
  assert.match(packageJson.scripts.test, /node --test/);
});

test('main process sets a stable window title and handles renderer load failures', () => {
  assert.match(mainJs, /app\.setName\('timer'\)/);
  assert.match(mainJs, /title:\s*'timer'/);
  assert.match(mainJs, /loadFile\(rendererPath\)\.catch/);
  assert.match(mainJs, /did-fail-load/);
  assert.match(mainJs, /render-process-gone/);
});
