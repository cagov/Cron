const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');

const path = 'data/infections-by-group/infections-by-group-california.json';
const schemaPath = "../SQL/CDT_COVID/Infections-by-group/schema/";
const schemaFileName = `${schemaPath}output/schema.json`;
const schemaTestGoodFilePath = `${schemaPath}output/tests/pass`;
const schemaTestBadFilePath = `${schemaPath}output/tests/fail`;

const getData_infections_by_group = async () => {
  const statResults = await queryDataset(
      {
          infections_by_group : getSQL('CDT_COVID/Infections-by-group/infections-by-group')
      }
      ,process.env["SNOWFLAKE_CDT_COVID"]
  );

  const arrayResultMap = m => ({CATEGORY:m.CATEGORY,METRIC_VALUE:m.METRIC_VALUE});
  const byGender = statResults.infections_by_group.filter(x=>x.DATASET==='GENDER');
  const byAge = statResults.infections_by_group.filter(x=>x.DATASET==='AGE');
  const byRaceAndEthnicity = statResults.infections_by_group.filter(x=>x.DATASET==='RACE_ETHNICITY');

  const json = {
      meta: {
        PUBLISHED_DATE : "1900-01-01",
        METRIC_VALUE_VALID_RANGE : {
          MINIMUM:0, 
          MAXIMUM:100  
        }
      },
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

  validateJSON(`${path} failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return {path, json};
};

module.exports = {
    getData_infections_by_group
};