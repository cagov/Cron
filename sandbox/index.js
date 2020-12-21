//Loading environment variables
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doTranslationPrUpdate } = require('../CovidTranslationPrApproval/worker');
const { doDailyStatsPr } = require('../CovidStateDashboard/datasetUpdates');
//const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
//const { gitHubSetConfig,gitHubPrRequestReview,gitHubBranchCreate,gitHubBranchMerge,gitHubFileAdd } = require('../common/gitHub');
const CovidEquityData = require('../CovidEquityData');
const CovidNewsFeed = require('../CovidNewsFeed');

//const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
//const notifyChannel = 'C01DBP67MSQ';

const readline = require("readline");
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const doWork = async opt => {
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
        await doWeeklyUpdatePrs(mergetargets);
    } else if (opt == '5') {
        console.log("Running CovidNewsFeed");
        await CovidNewsFeed();
    } else if (opt == 'q') {
        console.log("Buh bye!");
    } else {
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