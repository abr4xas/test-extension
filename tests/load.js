// Runs an extension script the way the browser does (a plain script, not a module) in a fresh
// context and returns that context's globals.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

module.exports = function load(file, globals = {}) {
  const context = vm.createContext({ ...globals });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
  return context;
};
