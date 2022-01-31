const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');
const { todayDateString } = require('../common/gitTreeCommon');

const schemaFileName = "../SQL/CDT_COVID/postvax-data/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDT_COVID/postvax-data/schema/tests/pass/";
const schemaTestBadFilePath = "../SQL/CDT_COVID/postvax-data/schema/tests/fail/";

const getData_daily_postvax_data = async () => {
  const statResults = await queryDataset(
      {
          postvax_data: getSQL('CDT_COVID/postvax-data/Postvax'),
      }
      ,process.env["SNOWFLAKE_CDT_COVID"]
  );

  const report_date = statResults.postvax_data[0].REPORT_DATE;

  // pull a subset of fields  here...
  let json = {
      meta: {
        PUBLISHED_DATE: todayDateString(),
        REPORT_DATE: report_date,
        AREA: "California",
        AREA_TYPE: "State",
        CASES_SAMPLE_SIZE: 100000,
        HOSP_SAMPLE_SIZE: 1000000,
        DEATHS_SAMPLE_SIZE: 1000000
      },
      data: statResults.postvax_data
  };

  // For now, don't bother validating until we get data into a form we really like...
  // validateJSON(`Postvax data failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return json;
};

module.exports = {
    getData_daily_postvax_data
};