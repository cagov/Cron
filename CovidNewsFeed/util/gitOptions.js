const authheader = require('./authheader.js');

module.exports = function defaultoptions() {
  return {method: 'GET', headers:authheader() };
};
