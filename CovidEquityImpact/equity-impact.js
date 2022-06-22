const { queryDataset, getSQL } = require('../common/snowflakeQuery');
const { todayDateString } = require('../common/gitTreeCommon');

const getData_equity_impact = async () => {

    const statResults = await queryDataset(
        {
            impact_data: getSQL('CDT_COVID/EquityImpact/ImpactData')
        },
        process.env["SNOWFLAKE_CDTCDPH_COVID_OAUTH"]
    );

    //console.log(JSON.stringify(statResults.impact_data, null, 2));

    // Get redundant information from first record
    const report_date = statResults.impact_data[0].REPORT_DATE;

    // Store transformed data here
    let equity_data = {};

    // Track unique categories here
    let categories = {};

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    function myReplaceAll(str, find, replace) {
        return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
    }

    // Do one pass-through of data from snowflake
    statResults.impact_data.forEach( (record) => {

        categories[record.DEMOG_CAT] = 1;
        let metric = undefined;
        try {
            // replaceAll not currently supported on our Azure instance
           // let metric = record.DEMOG_CAT.replaceAll(' ', '_') + '_' + record.METRIC_CAT;
           metric = myReplaceAll(record.DEMOG_CAT,' ', '_') + '_' + record.METRIC_CAT;
        } catch (e) {
            console.log('searchme');
            console.log(record);
            console.log(record.DEMOG_CAT);
            throw(e);
        }

        if (equity_data[metric] === undefined) {
            equity_data[metric] = {VALUES: []};
        }

        equity_data[metric].VALUES.push({
            DATE: record.DATE,
            VALUE: record.VALUE
        });
    });

    let json = {
        meta: {
            PUBLISHED_DATE: todayDateString(),
            REPORT_DATE: report_date,
            CATEGORIES: Object.keys(categories),
            AREA: 'California',
            AREA_TYPE: 'State'
        },
        data: {
            time_series: equity_data
        }
    };

    return json;
};

module.exports = {
    getData_equity_impact: getData_equity_impact
};
