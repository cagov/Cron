//Loading environment variables
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

const { doTranslationPrUpdate } = require('../CovidTranslationPrApproval/worker');
const { doAutoApprover } = require('../CovidTranslationPrApproval/AutoApprover');
const { doHealthCheck } = require('../CovidSiteHealth/worker');
const { doCovidStateDashboarV2 } = require('../CovidStateDashboardV2/worker');
const { doCovidVaccineEquity } = require('../CovidVaccineEquity/worker');
const { doCovidVaccineHPIV2 } = require('../CovidVaccineHPIV2/worker');
const { doCovidAutoBuilder } = require('../CovidAutoBuilder/worker');
const { doCovidStateDashboardTables } = require('../CovidStateDashboardTables/worker');
const { doCovidPostvaxData } = require('../CovidPostvaxData/worker');
const { doCovidVariantsData } = require('../CovidVariantsData/worker');
const { doCovidVaccinesSparklineData } = require('../CovidStateDashboardVaccines/worker');
//
//const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');

//const tempFunction = async () => {           };

const { doCovidEquityData } = require('../CovidEquityData/worker');

//const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
//const notifyChannel = 'C01DBP67MSQ';

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
        await doCovidEquityData();
        break;
    case '3':
        console.log("Running doTranslationPrUpdate");
        await doTranslationPrUpdate('master');
        break;
    case '6':
        console.log("Running doHealthCheck");
        await doHealthCheck();
        break;
    case '7':
        console.log("Running doCovidStateDashboarV2");
        await doCovidStateDashboarV2();
        break;
    case '8':
        console.log("Running doCovidVaccineEquity");
        await doCovidVaccineEquity();
        break;
    case '10':
        console.log("Running doCovidVaccineHPIV2");
        await doCovidVaccineHPIV2();
        break;
    case '11':
        console.log("Running doCovidAutoBuilder");
        await doCovidAutoBuilder();
        break;
    case '12':
        console.log("Running doAutoApprover");
        await doAutoApprover();
        break;
    case '13':
        console.log("Running doCovidStateDashboardTables");
        await doCovidStateDashboardTables();
        break;
    case '14':
        console.log("Running doCovidPostvaxData");
        await doCovidPostvaxData();
        break;
    case '15':
        console.log("Running doCovidVaccinesSparklineData");
        await doCovidVaccinesSparklineData();
        break;
    case '16':
        console.log("Running doCovidVariantsData");
        await doCovidVariantsData();
        break;
    case 'temp':
        //Put some temporary code here
        console.log("Running Temp code");
        
        //await tempFunction();

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
        console.log("q. quit");
        rl.question("Your choice> ", doWork);
        rl.on("close", () => {
            console.log("Buh bye!");
            process.exit(0);
        });
    }
})()
.catch(e=>{
    console.error(e);
})
.then(() => {
    console.log("Debug Finished.");
    process.exit(0);
});