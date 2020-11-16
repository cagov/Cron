const { queryDataset } = require('../snowflakeQuery');
const statsFileName = 'tableauCovidMetrics.json';

const {
    gitHubMessage,
    gitHubBranchCreate,
    gitHubBranchMerge,
    gitHubFileUpdate,
    gitHubFileGet,
    gitHubBranchExists,
    gitHubPrGetByBranchName
} = require('../gitHub');

const PrLabels = ['Automatic Deployment'];
const tierUpdateDay = 1 //Monday

//Check to see if we need stats update PRs, make them if we do.
const doDailyStatsPr = async mergetargets => {
    const sql = `SELECT TOP 1 * from COVID.PRODUCTION.VW_TABLEAU_COVID_METRICS_STATEWIDE ORDER BY DATE DESC`;
    let sqlResults = null;
    let masterPr = null;
    const today = getTodayPacificTime().replace(/\//g,'-');

    for(const mergetarget of mergetargets) {
        const branch = `auto-stats-update-${mergetarget}-${today}`;
        const isMaster = mergetarget === mergetargets[0];

        if(await gitHubBranchExists(branch)) {console.log(`Branch "${branch}" found...skipping`); continue;} //branch exists, probably another process working on it...skip

        const PR = await gitHubPrGetByBranchName(mergetarget,branch);
        if(PR) {console.log(`PR "${branch}" found...skipping`); continue;}; //PR found, nothing to do

        sqlResults = sqlResults || (await queryDataset(sql))[0][0]; //only run the query if needed

        //Add tier dates
        let target = new Date();
        while(target.getDay()!==tierUpdateDay)
            target.setDate(target.getDate() - 1);
        sqlResults[0].TIER_DATE = target.toJSON().split('T')[0];


        target.setDate(target.getDate() - 7); //Go back a week
        while(target.getDay()!==6) //Look back for a Saturday
            target.setDate(target.getDate() - 1);

        sqlResults[0].TIER_ENDDATE = target.toJSON().split('T')[0];

        const content = Buffer.from(JSON.stringify(sqlResults,null,2)).toString('base64');

        await gitHubBranchCreate(branch,mergetarget);
        const targetfile = await gitHubFileGet(`pages/_data/${statsFileName}`,branch);
        await gitHubFileUpdate(content,targetfile.url,targetfile.sha,gitHubMessage(`${today} Update`,statsFileName),branch);
        const autoApproveMerge = !isMaster || (new Date()).getDay()!==tierUpdateDay; //Don't auto-merge on tierUpdateDay
        const PrTitle = `${today} Stats Update${(isMaster) ? `` : ` (${mergetarget})`}`;
        const Pr = 
            await gitHubBranchMerge(branch,mergetarget,true,PrTitle,PrLabels,autoApproveMerge);
        if(isMaster) {
            masterPr = Pr;
        }
    }
    return masterPr;
}

const getTodayPacificTime = () =>
    new Date().toLocaleString("en-US", {year: 'numeric', month: 'numeric', day: 'numeric', timeZone: "America/Los_Angeles"});

module.exports = {
  doDailyStatsPr
}