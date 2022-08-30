const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');
const { todayDateString } = require('../common/gitTreeCommon');
const roundNumber = (number, fractionDigits=3) => {
  const roundscale = Math.pow(10,fractionDigits);
  return Math.round(Number.parseFloat(number)*roundscale)/roundscale;
};

const path = 'daily-stats-v2.json';
const schemaFileName = "../SQL/CDT_COVID/Daily-stats-v2/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDT_COVID/Daily-stats-v2/schema/tests/output/pass/";
const schemaTestBadFilePath = "../SQL/CDT_COVID/Daily-stats-v2/schema/tests/output/fail/";

const getData_daily_stats_v2 = async () => {
  const statResults = await queryDataset(
      {
          metrics: getSQL('CDT_COVID/Daily-stats-v2/Metrics'),
          hospitalizations : getSQL('CDT_COVID/Daily-stats-v2/Hospitalizations')
      }
      ,process.env["SNOWFLAKE_CDTCDPH_COVID_OAUTH"]
  );
//   const resultsVaccines = await queryDataset(
//       getSQL('CDTCDPH_VACCINE/Vaccines'),
//       process.env["SNOWFLAKE_CDTCDPH_VACCINE_OAUTH"]
//   );

//   validateJSON('CDTCDPH_VACCINE/Vaccines.sql failed validation', resultsVaccines,'../SQL/CDTCDPH_VACCINE/Vaccines.sql.Schema.json','../SQL/CDTCDPH_VACCINE/Vaccines.sql.Sample.json');
  
  const row = statResults.metrics[0];
  const rowHospitals = statResults.hospitalizations[0];
//   const rowVaccines = resultsVaccines[0];

  const json = {
      meta: {
        PUBLISHED_DATE: todayDateString()
      },
      data: {
          cases: {
              DATE : row['MAX(DATE)'],
              LATEST_TOTAL_CONFIRMED_CASES : row['SUM(LATEST_TOTAL_CONFIRMED_CASES)'],
              LATEST_TOTAL_COMBINED_CASES : row['SUM(LATEST_TOTAL_COMBINED_CASES)'],
              NEWLY_REPORTED_CASES : row['SUM(NEWLY_REPORTED_CASES)'],
              LATEST_PCT_CH_CASES_REPORTED_1_DAY : roundNumber(100.0*row['SUM(LATEST_PCT_CH_CASES_REPORTED_1_DAY)'],6),
              LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS)'],
              LATEST_CONFIDENT_AVG_COMBINED_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_COMBINED_CASE_RATE_PER_100K_7_DAYS)'],
              LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS)'],
              NEWLY_REPORTED_CASES_LAST_7_DAYS : row['SUM(NEWLY_REPORTED_CASES_LAST_7_DAYS)']
          },
          deaths : {
              DATE : row['MAX(DATE)'],
              LATEST_TOTAL_CONFIRMED_DEATHS : row['SUM(LATEST_TOTAL_CONFIRMED_DEATHS)'],
              NEWLY_REPORTED_DEATHS : row['SUM(NEWLY_REPORTED_DEATHS)'],
              LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS)'],
              LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS)'],
              LATEST_PCT_CH_DEATHS_REPORTED_1_DAY : roundNumber(100.0*row['SUM(LATEST_PCT_CH_DEATHS_REPORTED_1_DAY)'],6)
          },
          tests : {
              DATE : row['MAX(DATE)'],
              LATEST_TOTAL_TESTS_PERFORMED : row['SUM(LATEST_TOTAL_TESTS_PERFORMED)'],
              LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY : roundNumber(100.0*row['SUM(LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY)'],6),
              LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS)'],
              NEWLY_REPORTED_TESTS : row['SUM(NEWLY_REPORTED_TESTS)'],
              NEWLY_REPORTED_TESTS_LAST_7_DAYS : row['SUM(NEWLY_REPORTED_TESTS_LAST_7_DAYS)'],
              LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS : row['SUM(LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS)'],
              LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS)'], //moved to cases
              LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS)'], //mode to deaths
              LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS)']
          },
          hospitalizations : {
              DATE : rowHospitals.SF_LOAD_TIMESTAMP,
              HOSPITALIZED_COVID_CONFIRMED_PATIENTS : rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS,
              HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY : rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY,
              HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG,6),
              HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS : rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS,
              HOSPITALIZED_SUSPECTED_COVID_PATIENTS : rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS,
              HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY : rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY,
              HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG,6),
              HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS : rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS
          },
          icu : {
              DATE : rowHospitals.SF_LOAD_TIMESTAMP,
              ICU_COVID_CONFIRMED_PATIENTS : rowHospitals.ICU_COVID_CONFIRMED_PATIENTS,
              ICU_COVID_CONFIRMED_PATIENTS_DAILY : rowHospitals.ICU_COVID_CONFIRMED_PATIENTS_DAILY,
              ICU_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.ICU_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG,6),
              ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS : rowHospitals.ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS,
              ICU_SUSPECTED_COVID_PATIENTS : rowHospitals.ICU_SUSPECTED_COVID_PATIENTS,
              ICU_SUSPECTED_COVID_PATIENTS_DAILY : rowHospitals.ICU_SUSPECTED_COVID_PATIENTS_DAILY,
              ICU_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.ICU_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG,6),
              ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS : rowHospitals.ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS
          }
        //   vaccinations: {
        //       DATE : rowHospitals.SF_LOAD_TIMESTAMP,
        //       CUMMULATIVE_DAILY_DOSES_ADMINISTERED : rowVaccines.CUMMULATIVE_DAILY_DOSES_ADMINISTERED
        //   }
      }
  };

  validateJSON(`${path} failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return {path, json};
};

module.exports = {
    getData_daily_stats_v2
};
