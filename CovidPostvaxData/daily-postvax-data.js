const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');

const path = 'data/dashboard/postvax/california.json';
const schemaFileName = "../SQL/CDT_COVID/postvax-data/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDT_COVID/postvax-data/schema/tests/output/pass/";
const schemaTestBadFilePath = "../SQL/CDT_COVID/postvax-data/schema/tests/output/fail/";

const getData_daily_postvax_data = async () => {
  const statResults = await queryDataset(
      {
          postvax_data: getSQL('CDT_COVID/postvax-data/Postvax'),
      }
      ,process.env["SNOWFLAKE_CDT_COVID"]
  );

  // validateJSON('CDTCDPH_VACCINE/Vaccines.sql failed validation', resultsVaccines,'../SQL/CDTCDPH_VACCINE/Vaccines.sql.Schema.json','../SQL/CDTCDPH_VACCINE/Vaccines.sql.Sample.json');

  // FORMULATE JSON HERE...

  let json = {
      meta: {
        PUBLISHED_DATE: "1900-01-01"
      },
      data: statResults.postvax_data
  };

  validateJSON(`${path} failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return {path, json};
};

module.exports = {
    getData_daily_postvax_data
};