const { doDailyStatsPr } = require('./datasetUpdates');
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

//const masterbranch='synctest3', stagingbranch='synctest3_staging', checkStatsPrs = false;
const masterbranch='master', stagingbranch='staging', checkStatsPrs = true;
const mergetargets = [masterbranch,stagingbranch];

//Check to see if we need stats update PRs
if (checkStatsPrs) {
  doDailyStatsPr(mergetargets);
}