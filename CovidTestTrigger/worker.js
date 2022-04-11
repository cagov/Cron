// testing routine
// const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { queryDataset,getSQL } = require('../common/snowflakeQueryTest');

const snowflakeAccount = "SNOWFLAKE_CDT_COVID";
// const snowflakeAccount = "SNOWFLAKE_CDTCDPH_COVID_OAUTH";

const getData = async (slackPostTS) => {

    const statResults = await queryDataset(
        {
            snowflake_data: getSQL('CDT_COVID/Daily-stats-v2/Metrics'),
        }
        ,process.env[snowflakeAccount],
        slackPostTS
    );
    
    return statResults.snowflake_data;
};


const doSnowflakeTest = async (previewOnly, slackPostTS) => {

    const jsonData =  await getData(slackPostTS);
    if (jsonData) {
        return "```" + JSON.stringify(jsonData) + "```";
    } else {
        return "jsonData appears invalid";
    }
};

module.exports = {
    doSnowflakeTest
};