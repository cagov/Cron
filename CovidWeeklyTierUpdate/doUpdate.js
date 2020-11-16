const { queryDataset } = require('../CovidStateDashboard/snowflakeQuery');
const statsFileName = 'countystatus.json';

const {
    gitHubMessage,
    gitHubBranchCreate,
    gitHubBranchMerge,
    gitHubFileUpdate,
    gitHubFileGet,
    gitHubBranchExists,
    gitHubPrGetByBranchName
} = require('../CovidStateDashboard/gitHub');

const PrLabels = ['Automatic Deployment'];
const sql = `select COUNTY, CURRENT_TIER from COVID.PRODUCTION.VW_CDPH_COUNTY_TIER_DATA where date = (select max(DATE) from COVID.PRODUCTION.VW_CDPH_COUNTY_TIER_DATA)`;
 
const prepData = async () => {
    const sqlResults = (await queryDataset(sql))[0][0];

    //flip the data so high is low and low is high
    const flipped = sqlResults.map(item => 
        ({
            "county":item.COUNTY,
            "Overall Status":(5 - item.CURRENT_TIER).toString()
        })
    );
    return flipped;
}

//Check to see if we need stats update PRs, make them if we do.
const doWeeklyUpdatePrs = async mergetargets => {
    let sqlResults = null;
    const today = getTodayPacificTime().replace(/\//g,'-');

    for(const mergetarget of mergetargets) {
        const branch = `auto-weekly-update-${mergetarget}-${today}`;
        const isMaster = mergetarget === mergetargets[0];

        if(await gitHubBranchExists(branch)) {console.log(`Branch "${branch}" found...skipping`); continue;} //branch exists, probably another process working on it...skip

        const PR = await gitHubPrGetByBranchName(mergetarget,branch);
        if(PR) {console.log(`PR "${branch}" found...skipping`); continue;}; //PR found, nothing to do

        sqlResults = sqlResults || await prepData(); //only run the query if needed

        const content = Buffer.from(JSON.stringify(sqlResults,null,2)).toString('base64');

        await gitHubBranchCreate(branch,mergetarget);
        const targetfile = await gitHubFileGet(`src/js/roadmap/${statsFileName}`,branch);
        await gitHubFileUpdate(content,targetfile.url,targetfile.sha,gitHubMessage(`${today} Update`,statsFileName),branch);
        const autoApproveMerge = !isMaster; //auto-push non-master
        const PrTitle = `${today} Weekly Update${(isMaster) ? `` : ` (${mergetarget})`}`;
        await gitHubBranchMerge(branch,mergetarget,true,PrTitle,PrLabels,autoApproveMerge);
        
    }
}

const getTodayPacificTime = () =>
    new Date().toLocaleString("en-US", {year: 'numeric', month: 'numeric', day: 'numeric', timeZone: "America/Los_Angeles"});

module.exports = {
  doWeeklyUpdatePrs
}