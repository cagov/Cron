const fs = require('fs');
const path = `${__dirname}/SQL/`;
const folders = fs.readdirSync(path);

const result = {};

folders.forEach(subpath=>{
  const files = fs.readdirSync(path+subpath);
  const container = {};

  files.forEach(f => {
    container[f.split('.')[0]]=fs.readFileSync(`${path}${subpath}/${f}`).toString();
  });

  result[subpath] = container;
});

/**
 * Read all the SQL files and return them in a JSON structure by folder
 */
module.exports = result;