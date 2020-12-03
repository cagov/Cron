//Loading environment variables
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doTranslationPrUpdate } = require('../CovidTranslationPrApproval/worker');
const { doDailyStatsPr } = require('../CovidStateDashboard/datasetUpdates');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const { gitHubSetConfig } = require('../common/gitHub');
const CovidEquityData = require('../CovidEquityData');

const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
//const notifyChannel = 'C01DBP67MSQ';

(async () => {
    //const masterbranch='synctest3', stagingbranch='synctest3_staging';
    const masterbranch='master', stagingbranch='staging';
    const mergetargets = [masterbranch,stagingbranch];
    //gitHubSetConfig('cagov','covid19',process.env["GITHUB_TOKEN"],process.env["GITHUB_NAME"],process.env["GITHUB_EMAIL"]);
  

    const yo = await CovidEquityData();

    //const report = await doWeeklyUpdatePrs(mergetargets);


//for(const val of report) {
//    await slackBotChatPost(notifyChannel,`Tier Update Deployed\n${val.Pr.html_url}`);
//}


    //await doDailyStatsPr(mergetargets);

    //await doTranslationPrUpdate(masterbranch);

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