const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');

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

  // FILTER JSON HERE - remove fields we don't want
  const fields_to_remove = ['AREA','AREA_TYPE','FILE_PATH','SF_LOAD_TIMESTAMP']
  let filtered_recs = statResults.postvax_data.map(r => {
      fields_to_remove.forEach(f => {
        if (f in r) {
            delete r[f];
        }
      });
    return r;
  });

  // pull a subset of fields  here...
  let json = {
      meta: {
        PUBLISHED_DATE: "1900-01-01"
      },
      data: filtered_recs
  };

  // For now, don't bother validating until we get data into a form we really like...
  // validateJSON(`${path} failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return json;
};

module.exports = {
    getData_daily_postvax_data
};