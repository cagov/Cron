const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');

const schemaFileName = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/tests/output/pass/";
const schemaTestBadFilePath = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/tests/output/fail/";

const getData_daily_vaccines_sparkline = async () => {
  const sqlWork = {
    sparklineResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/sparkline'),
    fullyvaxedResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/fullyvaxed'),
    populationResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/eligiblepopulation')
  }
  
  const {
    sparklineResults,
    fullyvaxedResults,
    populationResults
  } = await queryDataset(sqlWork,process.env["SNOWFLAKE_CDTCDPH_VACCINE"]);


  // validateJSON('CDTCDPH_VACCINE/Vaccines.sql failed validation', resultsVaccines,'../SQL/CDTCDPH_VACCINE/Vaccines.sql.Schema.json','../SQL/CDTCDPH_VACCINE/Vaccines.sql.Sample.json');

  // FILTER JSON HERE - remove fields we don't want

  // pull a subset of fields  here...
  let mapped_sparkline_data = sparklineResults.map(r => 
    ({DATE:r.ADMIN_DATE, VALUE:r.COUNT}));

  let avg_records = [];
  mapped_sparkline_data.forEach((rec,i) => {
      let sum = 0;
      for (let j = i; j < i+7; ++j) {
        sum += j < mapped_sparkline_data.length? mapped_sparkline_data[j].VALUE : 0;
      }
      avg_records.push({DATE:rec.DATE,VALUE:sum/7.0});
  });


  // console.log("fullyvaxedResults",fullyvaxedResults);
  // console.log("populationResults",populationResults);

  let json = {
      meta: {
        PUBLISHED_DATE: "1900-01-01",
        coverage: "California"
      },
      data: {
        population: {
          FULLY_VAXED: fullyvaxedResults[0].FULLY_VACCINATED,
          ELIGIBLE_POPULATION: populationResults[0].ELIGIBLE_POPULATION,
          FULLY_VAXED_RATIO: fullyvaxedResults[0].FULLY_VACCINATED / populationResults[0].ELIGIBLE_POPULATION
        },
        time_series: {
          VACCINE_DOSES: {
            DATE_RANGE: {
              MINIMUM: mapped_sparkline_data[mapped_sparkline_data.length-1].DATE,
              MAXIMUM: mapped_sparkline_data[0].DATE
            },
            VALUES: mapped_sparkline_data
          },
          VACCINE_DOSES_7DAYAVG: {
            DATE_RANGE: {
              MINIMUM: avg_records[avg_records.length-1].DATE,
              MAXIMUM: avg_records[0].DATE
            },
            VALUES: avg_records
          }
        }
      }
  };

  // console.log("Computed json",json);

  // For now, don't bother validating until we get data into a form we really like...
  // validateJSON(`${path} failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return json;
};

module.exports = {
  getData_daily_vaccines_sparkline
};