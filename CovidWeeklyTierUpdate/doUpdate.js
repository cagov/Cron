const GitHub = require('github-api'); //https://github-tools.github.io/github/docs/3.2.3/Repository.html
const { queryDataset } = require('../common/snowflakeQuery');
const { validateJSON, validateJSON2, getSqlWorkAndSchemas } = require('../common/schemaTester');

const githubUser = 'cagov';
const githubRepo = 'covid19';
const committer = {
    name: process.env["GITHUB_NAME"],
    email: process.env["GITHUB_EMAIL"]
};

const sqlRootPath = '../SQL/CDT_COVID/TierUpdate/';
const targetFileName = 'countystatus.json';
const targetPath = `src/js/roadmap/`;
const PrPrefix = 'Auto Tier Update';
const branchPrefix = 'auto-tier-update';
const commitMessage = 'update Tiers';
const PrLabels = ['Automatic Deployment'];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

//Check to see if we need stats update PRs, make them if we do.
const doWeeklyUpdatePrs = async mergetargets => {
    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath,'schema/input/[file]/schema.json','schema/input/[file]/sample.json');
    
    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork,process.env["SNOWFLAKE_CDT_COVID"]);

    Object.keys(sqlWorkAndSchemas.schema).forEach(file => {
        const schemaObject = sqlWorkAndSchemas.schema[file];
        const targetJSON = allData[file];
        //Use this to sput out sample datasets
        //require('fs').writeFileSync(`${file}_sample.json`, JSON.stringify(targetJSON,null,2), 'utf8');
        console.log(`Validating - ${file}`);
        validateJSON2(`${file} - failed SQL input validation`, targetJSON,schemaObject.schema,schemaObject.passTests,schemaObject.failTests);
    });

    //https://github-tools.github.io/github/docs/3.2.3/Repository.html
    //https://developer.github.com/v3/pulls/#list-pull-requests

    //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
    const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');

    const report = [];

    //flip the data so high is low and low is high
    const dataOutput = allData.TierUpdate.map(item => 
        ({
            "county":item.COUNTY,
            "Overall Status":(5 - item.CURRENT_TIER).toString()
        })
    );
    validateJSON(`Failed output validation`, dataOutput, `${sqlRootPath}schema/output/TierUpdate/schema.json`,`${sqlRootPath}schema/output/TierUpdate/sample.json`);

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
                    await sleep(5000); //PR actions need time to check
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