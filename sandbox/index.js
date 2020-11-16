//Loading environment variables
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doDailyStatsPr } = require('../CovidStateDashboard/datasetUpdates');
const { slackBotChatPost, slackBotReportError } = require('../CovidStateDashboard//slackBot');
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const targetChannel = 'C01AA1ZB05B';

(async () => {
    const masterbranch='synctest3', stagingbranch='synctest3_staging';
    //const masterbranch='master', stagingbranch='staging';
    const mergetargets = [masterbranch,stagingbranch];
  
    //await doWeeklyUpdatePrs(mergetargets);
    await doDailyStatsPr(mergetargets);

    //const PrUrl = (await doDailyStatsPr(mergetargets));

    //const x =1;

    //.html_url
    //const PrUrl = 'https://github.com/cagov/covid19/pull/2311';
  

    //await slackBotChatPost(targetChannel,`(TEST MESSAGE) Daily stats deployed\n${PrUrl}`);
  
    //const json = await response.json();
  
    //console.log(JSON.stringify(json,null,2));
  
    //const sqlText = `SELECT TOP 1 * from COVID.PRODUCTION.VW_TABLEAU_COVID_METRICS_STATEWIDE ORDER BY DATE DESC`;
    //console.log(JSON.stringify(await queryDataset(sqlText),null,2));
  
    //console.log(JSON.stringify(await queryDataset(sqlText),null,2));

})();