//Loading environment variables
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

const { doDailyStatsPr } = require('../CovidStateDashboard/datasetUpdates');
const { slackBotChatPost } = require('../CovidStateDashboard/slackBot');
const { queryDataset, getDatabaseConnection } = require('../CovidStateDashboard/snowflakeQuery');

(async () => {

  //const masterbranch='synctest3', stagingbranch='synctest3_staging';
  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  await doDailyStatsPr(mergetargets);


  const targetChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
  const response = await slackBotChatPost(targetChannel,'#TEST#\n##Test 2##\n###Test 3###');

  const json = await response.json();

  console.log(JSON.stringify(json,null,2));


  //const sqlText = `SELECT TOP 1 * from COVID.PRODUCTION.VW_TABLEAU_COVID_METRICS_STATEWIDE ORDER BY DATE DESC`;
  //console.log(JSON.stringify(await queryDataset(sqlText),null,2));

  //console.log(JSON.stringify(await queryDataset(sqlText),null,2));
})();