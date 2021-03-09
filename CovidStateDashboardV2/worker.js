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

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');

//Check to see if we need stats update PRs, make them if we do.
const doCovidStateDashboarV2 = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);

    const title = `${todayDateString()} Stats Update`;

    const dataOutput = await getData_daily_stats_v2();
    const targetcontent = (await gitRepo.getContents(masterBranch,targetFileNameStats,true)).data;
    if(JSON.stringify(dataOutput.json.data)===JSON.stringify(targetcontent.data)) {
        console.log('data matched - no need to update');
    } else {
        console.log('data changed - updating');

        const branch = `${branchPrefix}-${todayDateString()}-${todayTimeString()}`;
        await gitRepo.createBranch(masterBranch,branch);
        
        await gitRepo.writeFile(branch, targetFileNameStats, JSON.stringify(dataOutput,null,2), commitMessage, {committer,encode:true});

        //Create PR
        const Pr = (await gitRepo.createPullRequest({
            title,
            head: branch,
            base: masterBranch
        }))
        .data;
        
        //Approve the PR
        await gitRepo.mergePullRequest(Pr.number,{
            merge_method: 'squash'
        });
        //Delete PR branch
        await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
        
        return Pr;
    }
};

const createPrForChange = async (gitRepo, Pr, contentArray) => {
    for (const dataOutput of contentArray) {

    }



    const targetcontent = (await gitRepo.getContents(masterBranch,targetFileNameStats,true)).data;
    if(JSON.stringify(dataOutput.json.data)===JSON.stringify(targetcontent.data)) {
        console.log('data matched - no need to update');
    } else {
        console.log('data changed - updating');

        const branch = `${branchPrefix}-${todayDateString()}-${todayTimeString()}`;
        await gitRepo.createBranch(masterBranch,branch);
        
        await gitRepo.writeFile(branch, targetFileNameStats, JSON.stringify(dataOutput,null,2), commitMessage, {committer,encode:true});

        if(!Pr) {
            //Create PR
            Pr = (await gitRepo.createPullRequest({
                title,
                head: branch,
                base: masterBranch
            }))
            .data;
        }
    }

    return Pr;
};

const PrApprove = async (gitRepo, Pr) => {
    //Approve the PR
    await gitRepo.mergePullRequest(Pr.number,{
        merge_method: 'squash'
    });
    //Delete PR branch
    await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
};

module.exports = {
    doCovidStateDashboarV2
};