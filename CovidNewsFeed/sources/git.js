const fetch = require('node-fetch');
const defaultoptions = require("../util/gitOptions.js");

module.exports = function(success, failure, githubBranch, githubApiUrl, fileLocation) {
  let url = `${githubApiUrl}contents/${fileLocation}?ref=${githubBranch}`;
  console.log(url);
  fetch(url,
    defaultoptions())
    .then(res => res.ok ? res.json() : success([]))
    .then(json => { 
      success(json);
    }
  )
  .catch(async () => {
    failure('wtf');
  });
};
