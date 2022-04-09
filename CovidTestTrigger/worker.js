// testing routine
const { queryDataset,getSQL } = require('../common/snowflakeQuery');


const getData = async () => {

    const statResults = await queryDataset(
        {
            snowflake_data: getSQL('CDT_COVID/Daily-stats-v2/Metrics'),
        }
        ,process.env["SNOWFLAKE_CDT_COVID"]
    );
    
    return statResults.snowflake_data;
};


const doSnowflakeTest = async (previewOnly) => {

    const jsonData =  await getData();
    if (jsonData) {
        return "```" + JSON.stringify(jsonData) + "```";
    } else {
        return "jsonData appears invalid";
    }
};

module.exports = {
    doSnowflakeTest
};