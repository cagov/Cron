const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');

const targetFilePath = 'data/infections-by-group-california.json';
const schemaFileName = "../JSON_Schema/daily-stats-v2/schema.json";
const schemaTestGoodFilePath = "../JSON_Schema/daily-stats-v2/tests/pass/";
const schemaTestBadFilePath = "../JSON_Schema/daily-stats-v2/tests/fail/";

const getData_infections_by_group = async () => {
  const statResults = await queryDataset(
      {
          infections_by_group : getSQL('CDT_COVID/v2-state-dashboard-infections-by-group')
      }
      ,process.env["SNOWFLAKE_CDT_COVID"]
  );

  const arrayResultMap = m => ({CATEGORY:m.CATEGORY,METRIC_VALUE:m.METRIC_VALUE});
  const byGender = statResults.infections_by_group.filter(x=>x.DATASET==='GENDER');
  const byAge = statResults.infections_by_group.filter(x=>x.DATASET==='AGE');
  const byRaceAndEthnicity = statResults.infections_by_group.filter(x=>x.DATASET==='RACE_ETHNICITY');

  const json = {
      data: {
          by_race_and_ethnicity: {
              cases: byRaceAndEthnicity.filter(x=>x.SUBJECT==='CASE_PERCENTAGE').map(arrayResultMap),
              deaths: byRaceAndEthnicity.filter(x=>x.SUBJECT==='DEATH_PERCENTAGE').map(arrayResultMap),
              population: byRaceAndEthnicity.filter(x=>x.SUBJECT==='PERCENT_CA_POPULATION').map(arrayResultMap)
          },
          by_gender: {
              cases: byGender.filter(x=>x.SUBJECT==='CASE_PERCENTAGE').map(arrayResultMap),
              deaths: byGender.filter(x=>x.SUBJECT==='DEATH_PERCENTAGE').map(arrayResultMap),
              population: byGender.filter(x=>x.SUBJECT==='PERCENT_CA_POPULATION').map(arrayResultMap)
          },
          by_age: {
              cases: byAge.filter(x=>x.SUBJECT==='CASE_PERCENTAGE').map(arrayResultMap),
              deaths: byAge.filter(x=>x.SUBJECT==='DEATH_PERCENTAGE').map(arrayResultMap),
              population: byAge.filter(x=>x.SUBJECT==='PERCENT_CA_POPULATION').map(arrayResultMap)
          }
      }
  };

  validateJSON(`${targetFilePath} failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return {targetFilePath, json};
};

module.exports = {
    getData_infections_by_group
};