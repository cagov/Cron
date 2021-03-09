const { getData_daily_stats_v2 } = require('./daily-stats-v2');
const { getData_infections_by_group } = require('./infections-by-group');
const targetFileNameStats = 'data/daily-stats-v2.json';

const GitHub = require('github-api');
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'master';
const commitMessage = 'update Stats';
const branchPrefix = 'auto-stats-update';

//Check to see if we need stats update PRs, make them if we do.
const doCovidStateDashboarV2 = async () => {
    //uncomment this if you want to test the schema before running the query (schema dev mode)
    //validateJSON('daily-stats-v2.json failed validation',null,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);    throw new Error('validation pass');
    //validateJSON('CDTCDPH_VACCINE/Vaccines.sql failed validation', null,'../SQL/CDTCDPH_VACCINE/Vaccines.sql.Schema.json','../SQL/CDTCDPH_VACCINE/Vaccines.sql.Sample.json'); throw new Error('validation pass');

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);

    const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: 'numeric', day: 'numeric', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
    const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');

    const title = `${todayDateString} Stats Update`;
    let branch = masterBranch;

    const prs = await gitRepo.listPullRequests({
        base:masterBranch
    });
    let Pr = prs.data.filter(x=>x.title===title)[0];

    if(Pr) { //reuse the PR if it is still open
        branch = Pr.head.ref;    
    }

    const dataOutput = await getData_daily_stats_v2();
    const targetcontent = (await gitRepo.getContents(branch,targetFileNameStats,true)).data;
    if(JSON.stringify(dataOutput)===JSON.stringify(targetcontent)) {
        console.log('data matched - no need to update');
    } else {
        console.log('data changed - updating');
        if(!Pr) {
            //new branch
            branch = `${branchPrefix}-${todayDateString}-${todayTimeString}`;
            await gitRepo.createBranch(masterBranch,branch);
        }

        await gitRepo.writeFile(branch, targetFileNameStats, JSON.stringify(dataOutput,null,2), commitMessage, {committer,encode:true});

        if(!Pr) {
            //new Pr
            Pr = (await gitRepo.createPullRequest({
                title,
                head: branch,
                base: masterBranch
            }))
            .data;
        }
    }

    //Approve the PR
    if(Pr) {
        await gitRepo.mergePullRequest(Pr.number,{
            merge_method: 'squash'
        });

        await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
    }
    return Pr;
};

module.exports = {
    doCovidStateDashboarV2
};