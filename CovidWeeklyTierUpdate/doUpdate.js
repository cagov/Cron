const GitHub = require('github-api'); //https://github-tools.github.io/github/docs/3.2.3/Repository.html
const githubUser = 'cagov';
const githubRepo = 'covid19';
const committer = {
    name: process.env["GITHUB_NAME"],
    email: process.env["GITHUB_EMAIL"]
};
const { queryDataset } = require('../common/snowflakeQuery');
const targetFileName = 'countystatus.json';
const targetPath = `src/js/roadmap/`;
const PrPrefix = 'Auto Tier Update';
const branchPrefix = 'auto-tier-update';
const commitMessage = 'update Tiers';
const PrLabels = ['Automatic Deployment'];
const sql = `select COUNTY, CURRENT_TIER from COVID.PRODUCTION.VW_CDPH_COUNTY_TIER_DATA where date = (select max(DATE) from COVID.PRODUCTION.VW_CDPH_COUNTY_TIER_DATA)`;
 
const getData = async () => {
    const sqlResults = (await queryDataset(sql))[0][0];

    //flip the data so high is low and low is high
    const flipped = sqlResults.map(item => 
        ({
            "county":item.COUNTY,
            "Overall Status":(5 - item.CURRENT_TIER).toString()
        })
    );
    return flipped;
};

//Check to see if we need stats update PRs, make them if we do.
const doWeeklyUpdatePrs = async mergetargets => {
    //https://github-tools.github.io/github/docs/3.2.3/Repository.html
    //https://developer.github.com/v3/pulls/#list-pull-requests

    //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
    const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');

    const report = [];

    const dataOutput = await getData();

    for(const mergetarget of mergetargets) {
        const isMaster = mergetarget === mergetargets[0];

        const PrTitle = `${PrPrefix} ${todayDateString} ${isMaster ? `` : ` (${mergetarget})`}`;
        let branch = mergetarget;

        const prs = await gitRepo.listPullRequests({
            base:mergetarget
        });
        let Pr = prs.data.filter(x=>x.title===PrTitle)[0];
    
        if(Pr) { //reuse the PR (and branch) if it is still open
            branch = Pr.head.ref;
        }

        //Content compare to determine if we need to create a PR.
        const targetcontent = (await gitRepo.getContents(branch,`${targetPath}${targetFileName}`,true)).data;
        if(JSON.stringify(dataOutput)===JSON.stringify(targetcontent)) {
            console.log('data matched - no need to update');
        } else {
            console.log('data changed - updating');
            if(!Pr) {
                //new branch
                branch = `${branchPrefix}-${todayDateString}-${todayTimeString}`;
                await gitRepo.createBranch(mergetarget,branch);
            }
    
            //Update the branch
            await gitRepo.writeFile(branch, `${targetPath}${targetFileName}`, JSON.stringify(dataOutput,null,2), commitMessage, {committer,encode:true});
    
            if(!Pr) {
                //new Pr
                Pr = (await gitRepo.createPullRequest({
                    title: PrTitle,
                    head: branch,
                    base: mergetarget
                }))
                .data;
                
                //label pr
                await gitIssues.editIssue(Pr.number,{
                    labels: PrLabels
                });

                //Auto approve the staging PR
                if(isMaster) {
                    //Return the master Pr for sharing
                    report.push({Pr});
                } else {
                    //Auto approve and delete non-master PRs
                    await gitRepo.mergePullRequest(Pr.number,{
                        merge_method: 'squash'
                    });
            
                    await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
                }
            }
        }
    }

    return report;
};

module.exports = {
  doWeeklyUpdatePrs
};