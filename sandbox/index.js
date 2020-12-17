//Loading environment variables
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doTranslationPrUpdate } = require('../CovidTranslationPrApproval/worker');
const { doDailyStatsPr } = require('../CovidStateDashboard/datasetUpdates');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const { gitHubSetConfig,gitHubPrRequestReview,gitHubBranchCreate,gitHubBranchMerge,gitHubFileAdd } = require('../common/gitHub');
const CovidEquityData = require('../CovidEquityData');

const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
//const notifyChannel = 'C01DBP67MSQ';

const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const doWork = async (opt) => {
    if (opt == '1') {
        console.log("Running CovidEquityData");
        await CovidEquityData();
    } else if (opt == '2') {
        console.log("Running doDailyStatsPr");
        const masterbranch='master', stagingbranch='staging';
        const mergetargets = [masterbranch,stagingbranch];
        await doDailyStatsPr(mergetargets);
    } else if (opt == '3') {
        console.log("Running doTranslationPrUpdate");
        const masterbranch='master';
        await doTranslationPrUpdate(masterbranch);
    } else if (opt == '4') {
        console.log("Running doWeeklyUpdatePrs");
        const masterbranch='master', stagingbranch='staging';
        const mergetargets = [masterbranch,stagingbranch];
        const report = await doWeeklyUpdatePrs(mergetargets);
    } else if (opt == 'q') {
        console.log("Buh bye!")
    } else {
        console.log("Invalid option, bye!")
    }
}

(async () => {
   
    let debugModeArg = process.argv[2];
    if(debugModeArg) {
        //debug mode arg was specified
        let opt = debugModeArg.split(':')[0];
        await doWork(opt);
    } else {
        //command line prompt
        console.log("1. Run CovidEquityData");
        console.log("2. Run doDailyStatsPr");
        console.log("3. Run doTranslationPrUpdate");
        console.log("4. Run doWeeklyUpdatePrs");
        console.log("q. quit");
        rl.question("Your choice> ", async function(opt) {
            await doWork(opt);
            process.exit(0);
        });
        rl.on("close", () => {
            console.log("Buh bye!")
            process.exit(0);
        });
    }



    //const yo = await CovidEquityData();


    //const targetBranchName = 'carter-test-branch';
    //const b = await gitHubBranchCreate(targetBranchName,'master');
    //await gitHubFileAdd('test','delme.txt','adding test file',targetBranchName)
    //const pr = await gitHubBranchMerge(targetBranchName,"master",true,'carter test PR',null,false);
    
    //const pr = {url:'https://api.github.com/repos/cagov/covid-static/pulls/16'};
    //const r = await gitHubPrRequestReview(pr,['aaronhans']);


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