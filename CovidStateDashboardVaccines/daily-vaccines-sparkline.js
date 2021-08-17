const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');

const path = 'data/dashboard/vaccines/sparkline.json';
const schemaFileName = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/tests/output/pass/";
const schemaTestBadFilePath = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/tests/output/fail/";

const getData_daily_vaccines_sparkline = async () => {
  const statResults = await queryDataset(
      {
        sparkline_data: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/sparkline'),
      }
      ,process.env["SNOWFLAKE_CDTCDPH_VACCINE"]
  );

  // validateJSON('CDTCDPH_VACCINE/Vaccines.sql failed validation', resultsVaccines,'../SQL/CDTCDPH_VACCINE/Vaccines.sql.Schema.json','../SQL/CDTCDPH_VACCINE/Vaccines.sql.Sample.json');

  // FILTER JSON HERE - remove fields we don't want

  // pull a subset of fields  here...
  let json = {
      meta: {
        PUBLISHED_DATE: "1900-01-01"
      },
      data: statResults.sparkline_data
  };

  // For now, don't bother validating until we get data into a form we really like...
  // validateJSON(`${path} failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return {path, json};
};

module.exports = {
  getData_daily_vaccines_sparkline
};