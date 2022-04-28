// @ts-check
const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');
const { todayDateString } = require('../common/gitTreeCommon');

const schemaFileName = "../SQL/CDT_COVID/variants-data/schema/schema.json";
const schemaTestGoodFilePath = "../SQL/CDT_COVID/variants-data/schema/tests/pass/";
const schemaTestBadFilePath = "../SQL/CDT_COVID/variants-data/schema/tests/fail/";

const getData_weekly_variants_data = async () => {
console.log(`Auth = ${process.env["SNOWFLAKE_CDTCDPH_COVID_OAUTH"]}`)




/** @type {{variants_data:{VARIANT_NAME:string, METRIC_NAME:string, REPORT_DATE:string, DATE:string, VALUE: number}[]}} */
  const statResults = await queryDataset(
      {
          variants_data: getSQL('CDT_COVID/variants-data/Variants'),
      }
      ,process.env["SNOWFLAKE_CDTCDPH_COVID_OAUTH"]
  );




  //temp output
      console.log(JSON.stringify(statResults.variants_data,null,2));


  // validateJSON('CDTCDPH_VACCINE/Vaccines.sql failed validation', resultsVaccines,'../SQL/CDTCDPH_VACCINE/Vaccines.sql.Schema.json','../SQL/CDTCDPH_VACCINE/Vaccines.sql.Sample.json');

  // PROCESS DATA HERE

  // Produce a list of unique variant names (not including 'All') sorted alphabetically.
  let variants_nomdict = {};
  let variants_series_nomdict = {};
  statResults.variants_data.forEach( (rec) => {
    variants_series_nomdict[rec.VARIANT_NAME + '_' + rec.METRIC_NAME.replace(' ','-')] = 1;
    if (rec.VARIANT_NAME != 'All' && rec.VARIANT_NAME != 'Total') {
      variants_nomdict[rec.VARIANT_NAME] = 1;
    }
  });
  let variant_noms = Object.keys(variants_nomdict);
  let variants_series_noms = Object.keys(variants_series_nomdict);
  variant_noms.sort();
  variants_series_noms.sort();

  // Determine report_date from the first record
  const report_date = statResults.variants_data[0].REPORT_DATE;

  // Produce variant time series for all unique pairings
  let variant_series = {};
  variants_series_noms.forEach( (tseries_name) => {
    let tdata = [];

    statResults.variants_data.forEach( (rec) => {
      const recKey = rec.VARIANT_NAME + '_' + rec.METRIC_NAME.replace(' ','-');
      if (recKey == tseries_name) {
        tdata.push({DATE:rec.DATE, VALUE: rec.VALUE});
      }
    });
    variant_series[tseries_name] = {VALUES: tdata};
  });

  // Compute 7-day Averages
  // const days_to_average = 7;

  // variant_noms.forEach( (vname) => {
  //   const tseries_name = vname + '_Percentage-Average';
  //   const tseries_source = vname + '_Percentage';
  //   const source_series = variant_series[tseries_source]['VALUES'];
  //   let tdata = [];
  //   for (let i = days_to_average-1; i < source_series.length; ++i) {
  //     let sum = 0;
  //     for (let j = 0; j < days_to_average; ++j) {
  //       sum += source_series[i-j].VALUE;
  //     }
  //     let avg = sum / days_to_average;
  //     avg = Math.floor(avg*100) / 100; // just 2 digits of precision
  //     tdata.push({DATE:source_series[i].DATE, VALUE: avg});
  //   }
  //   variant_series[tseries_name] = {VALUES: tdata};
  // });

  // produce final output json block...
  let json = {
      meta: {
        PUBLISHED_DATE: todayDateString(),
        REPORT_DATE: report_date,
        VARIANTS: variant_noms
      },
      data: { 
        time_series: variant_series
      }
  };

  // Minimal validation for now (but some validation!)
  validateJSON(`Variants failed validation`, json,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

  return json;
};

module.exports = {
    getData_weekly_variants_data: getData_weekly_variants_data
};