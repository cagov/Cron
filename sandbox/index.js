const { doDailyStatsPr } = require('./datasetUpdates');
const { Values } = require('../local.settings.json');
Object.keys(Values).forEach(x=>process.env[x]=Values[x]); //Load local settings file for testing

//const masterbranch='synctest3', stagingbranch='synctest3_staging';
const masterbranch='master', stagingbranch='staging';
const mergetargets = [masterbranch,stagingbranch];

doDailyStatsPr(mergetargets);