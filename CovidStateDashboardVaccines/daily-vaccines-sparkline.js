const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');

const schemaFileName = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/tests/output/pass/";
const schemaTestBadFilePath = "../SQL/CDTCDPH_VACCINE/statedashboard-vaccines/schema/tests/output/fail/";

const getData_daily_vaccines_sparkline = async () => {
  const sqlWork = {
    sparklineResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/sparkline'),
    fullyvaxedResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/fullyvaxed'),
    totalvaxedResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/totalvaxed'),
    populationResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/eligiblepopulation'),
    dailyaverageResults: getSQL('CDTCDPH_VACCINE/statedashboard-vaccines/dailyaverage'),
    resultsVaccines: getSQL('CDTCDPH_VACCINE/Vaccines'),
  }

  const {
    sparklineResults,
    fullyvaxedResults,
    totalvaxedResults,
    populationResults,
    dailyaverageResults,
    resultsVaccines
  } = await queryDataset(sqlWork,process.env["SNOWFLAKE_CDTCDPH_VACCINE"]);


  validateJSON('CDTCDPH_VACCINE/Vaccines.sql failed validation', resultsVaccines,'../SQL/CDTCDPH_VACCINE/Vaccines.sql.Schema.json','../SQL/CDTCDPH_VACCINE/Vaccines.sql.Sample.json');

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
  let eligible_pop = populationResults[0].ELIGIBLE_POPULATION;
  let fully_vaxed = fullyvaxedResults[0].FULLY_VACCINATED;
  let total_vaxed = totalvaxedResults[0].TOTAL_VACCINATED;
  let daily_average = dailyaverageResults[0].DAILY_AVG;
  let partially_vaxed = total_vaxed - fully_vaxed;
  let rowVaccines = resultsVaccines[0];
  let json = {
      meta: {
        PUBLISHED_DATE: "1900-01-01",
        coverage: "California"
      },
      data: {
        summary: {
          DATE: mapped_sparkline_data[0].DATE,
          CUMMULATIVE_DAILY_DOSES_ADMINISTERED : rowVaccines.CUMMULATIVE_DAILY_DOSES_ADMINISTERED
        },
        population: {
          ELIGIBLE_POPULATION: eligible_pop,
          TOTAL_VAXED: total_vaxed,
          FULLY_VAXED: fully_vaxed,
          PARTIALLY_VAXED: partially_vaxed,
          TOTAL_VAXED_RATIO: total_vaxed / eligible_pop,
          FULLY_VAXED_RATIO: fully_vaxed / eligible_pop,
          PARTIALLY_VAXED_RATIO: partially_vaxed / eligible_pop,
          DAILY_AVERAGE: daily_average
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