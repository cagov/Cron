const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');
const { todayDateString } = require('../common/gitTreeCommon');

const schemaFileName = "../SQL/CDT_COVID/postvax-data-v2/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDT_COVID/postvax-data-v2/schema/tests/pass/";
const schemaTestBadFilePath = "../SQL/CDT_COVID/postvax-data-v2/schema/tests/fail/";

const getData_daily_postvax_data = async () => {
  const statResults = await queryDataset(
      {
          postvax_data: getSQL('CDT_COVID/postvax-data-v2/Postvax'),
          monthlyrate_data: getSQL('CDT_COVID/postvax-data-v2/MonthlyRates'),
      }
      ,process.env["SNOWFLAKE_CDTCDPH_COVID_OAUTH"]
  );
  const lastMonthRates = statResults.monthlyrate_data[0];
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
        DEATHS_SAMPLE_SIZE: 1000000,
        EPMONTH: lastMonthRates.EPMONTH,
        DATE_CEILING: lastMonthRates.DATE_CEILING,
        RR_CASE: lastMonthRates.RR_CASE,
        RR_HOSP: lastMonthRates.RR_HOSP,
        RR_DEATH: lastMonthRates.RR_DEATH,
      },
      data: statResults.postvax_data
  };

  // For now, don't bother validating until we get data into a form we really like...
  validateJSON(`Postvax-v2 data failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return json;
};

module.exports = {
    getData_daily_postvax_data
};