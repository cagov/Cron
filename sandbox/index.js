//Loading environment variables
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doTranslationPrUpdate } = require('../CovidTranslationPrApproval/worker');
const { doHealthCheck } = require('../CovidSiteHealth/worker');
const { doDailyStatsPr } = require('../CovidStateDashboard/datasetUpdates');
const { doCovidStateDashboarV2 } = require('../CovidStateDashboardV2/worker');
//const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
//const { gitHubSetConfig,gitHubPrRequestReview,gitHubBranchCreate,gitHubBranchMerge,gitHubFileAdd } = require('../common/gitHub');
const CovidEquityData = require('../CovidEquityData');
const CovidNewsFeed = require('../CovidNewsFeed');

//const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
//const notifyChannel = 'C01DBP67MSQ';

const masterbranch='master', stagingbranch='staging';
//const masterbranch='synctest3', stagingbranch='synctest3_staging';
const mergetargets = [masterbranch,stagingbranch];

const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const doWork = async opt => {
    console.log(`Option ${opt} selected`);
    switch (opt) {
    case '1':
        console.log("Running CovidEquityData");
        await CovidEquityData();
        break;
    case '2':
        console.log("Running doDailyStatsPr");
        await doDailyStatsPr(mergetargets);
        break;
    case '3':
        console.log("Running doTranslationPrUpdate");
        await doTranslationPrUpdate(masterbranch);
        break;
    case '4':
        console.log("Running doWeeklyUpdatePrs");
        await doWeeklyUpdatePrs(mergetargets);
        break;
    case '5':
        console.log("Running CovidNewsFeed");
        await CovidNewsFeed();
        break;
    case '6':
        console.log("Running doHealthCheck");
        await doHealthCheck();
        break;
    case '7':
        console.log("Running doCovidStateDashboarV2");
        await doCovidStateDashboarV2();
        break;
    case 'q':
        console.log("Buh bye!");
        break;
    default:
        console.log("Invalid option, bye!");
    }
};

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
        console.log("5. Run CovidNewsFeed");
        console.log("q. quit");
        rl.question("Your choice> ", doWork);
        rl.on("close", () => {
            console.log("Buh bye!");
            process.exit(0);
        });
    }
})();