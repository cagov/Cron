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

(async () => {
   
    console.log("1. Run CovidEquityData");
    console.log("2. Run doDailyStatsPr");
    console.log("3. Run doTranslationPrUpdate");
    console.log("4. Run doWeeklyUpdatePrs");
    console.log("q. quit");
    rl.question("Your choice> ", async function(opt) {
        if (opt == '1') {
            console.log("Running CovidEquityData");
            await CovidEquityData();
        } else if (opt == '2') {
            console.log("Running doDailyStatsPr");
            await doDailyStatsPr(mergetargets);
        } else if (opt == '3') {
            console.log("Running doTranslationPrUpdate");
            await doTranslationPrUpdate();
        } else if (opt == '4') {
            console.log("Running doWeeklyUpdatePrs");
            const masterbranch='master', stagingbranch='staging';
            const mergetargets = [masterbranch,stagingbranch];
            const report = await doWeeklyUpdatePrs(mergetargets);
        } else if (opt == '5') {
            console.log("Running CovidNewsFeed");
            await CovidNewsFeed();
        } else if (opt == 'q') {
            console.log("Buh bye!")
            process.exit(0);
        } else {
            console.log("Invalid option, bye!")
            process.exit(0);
        }
    });
    rl.on("close", () => {
        console.log("Buh bye!")
        process.exit(0);
    });
})();