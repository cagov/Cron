const { getData_daily_stats_v2 } = require('./daily-stats-v2');
const { getData_infections_by_group } = require('./infections-by-group');

const GitHub = require('github-api');
const PrLabels = ['Automatic Deployment'];
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'master';

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');

//Check to see if we need stats update PRs, make them if we do.
const doCovidStateDashboarV2 = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const prTitle = `${todayDateString()} V2 Stats Update`;

    const datasets = [await getData_daily_stats_v2(),await getData_infections_by_group()];

    const Pr = await processFilesForPr(datasets,gitRepo,prTitle);

    //Label the Pr
    await gitIssues.editIssue(Pr.number,{
        labels: PrLabels
    });

    await PrApprove(gitRepo,Pr);

    return Pr;
};

const processFilesForPr = async (fileData, gitRepo, prTitle) => {
    let Pr = null;

    for(let dataOutput of fileData) {
        Pr = await createPrForChange(gitRepo,Pr,dataOutput.path,dataOutput.json,prTitle);
    }

    return Pr;
};

const createPrForChange = async (gitRepo, Pr, path, json, prTitle) => {
    const branchName = `auto-${prTitle.replace(/ /g,'-')}-${todayDateString()}-${todayTimeString()}`;
    const targetcontent = (await gitRepo.getContents(Pr ? branchName : masterBranch,path,true)).data;
    if(JSON.stringify(json.data)===JSON.stringify(targetcontent.data)) {
        console.log('data matched - no need to update');
    } else {
        console.log('data changed - updating');

        //Add publishedDate
        if(!json.meta) {
            json.meta = {};
        }
        json.meta.PUBLISHED_DATE = todayDateString();

        if(!Pr) {
            await gitRepo.createBranch(masterBranch,branchName);
        }
        const commitMessage = `Update ${path.split("/").pop()}`;
        await gitRepo.writeFile(branchName, path, JSON.stringify(json,null,2), commitMessage, {committer,encode:true});

        if(!Pr) {
            //Create PR
            Pr = (await gitRepo.createPullRequest({
                title: prTitle,
                head: branchName,
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