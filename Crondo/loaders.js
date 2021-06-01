const { queryDataset } = require('../common/snowflakeQuery');
const sqlLoaderRoot = '/../common/SQL/Crondo/';
const fs = require('fs');

const getSqlWork = sqlFullPath => {
  const JsonOutput = [];

  for (const connection of fs.readdirSync(sqlFullPath,{withFileTypes:true}).filter(f=>f.isDirectory())) {
    const conndata = {connectionName:connection.name,files:{}};

    for (const sqlFile of fs.readdirSync(`${sqlFullPath}/${connection.name}`,{withFileTypes:true}).filter(f=>f.isFile()&&f.name.endsWith('.sql'))) {
      const sqlPath = `${sqlFullPath}/${connection.name}/${sqlFile.name}`;
      const fileName = sqlFile.name.replace(/\.sql$/,'');
      const SQL = fs.readFileSync(sqlPath).toString();

      conndata.files[fileName] = SQL;
    }

    JsonOutput.push(conndata);
  }

  return JsonOutput;
};


/**
 * @param {string} sqlPath 
 */
const runSqlLoader = async sqlPath => {
  const sqlFiles = getSqlWork(__dirname+sqlLoaderRoot+sqlPath);

  let allData = {};
  for (const connection of sqlFiles) {
    const newData = await queryDataset(connection.files,process.env[`SNOWFLAKE_${connection.connectionName}`]);
    allData = {...allData, ...newData};
  }

  return allData;
};

module.exports = {
  runSqlLoader
};