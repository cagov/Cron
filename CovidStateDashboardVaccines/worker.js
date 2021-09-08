const { getData_daily_vaccines_sparkline } = require('./daily-vaccines-sparkline');

const GitHub = require('github-api');
const { createTreeFromFileMap, PrIfChanged, todayDateString } = require('../common/gitTreeCommon');
const PrLabels = ['Automatic Deployment','Publish at 8:40 a.m. ☀️'];
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const gitHubCommitter = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const treePath = 'data/dashboard/vaccines';
const fileName = 'sparkline.json';
const stagingBranch = 'CovidStateDashboardVaccines_Sparkline_Staging';
const mainBranch = 'main';

/**
 * Check to see if we need stats update PRs, make them if we do.
 * @returns The PR created if changes were made
 */
const doCovidVaccinesSparklineData = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const prTitle = `${todayDateString()} Vaccines Sparkline Data Update`;

    const jsonData = await getData_daily_vaccines_sparkline();
    //const jsonData = require('./sample.json');

    //Add publishedDate
    if(!jsonData.meta) {
        jsonData.meta = {};
    }
    jsonData.meta.PUBLISHED_DATE = todayDateString();

    const fileMap = new Map();
    
    fileMap.set(fileName,jsonData);

    //Staging will be direct commits
    const stagingTree = await createTreeFromFileMap(gitRepo, stagingBranch, fileMap, treePath);
    await PrIfChanged(gitRepo, stagingBranch, stagingTree, prTitle, gitHubCommitter, true);

    //Production will be PRs
    const mainTree = await createTreeFromFileMap(gitRepo, mainBranch, fileMap, treePath);
    const Pr = await PrIfChanged(gitRepo, mainBranch, mainTree, prTitle, gitHubCommitter, false);

    if(Pr) {
        //Label the Pr
        await gitIssues.editIssue(Pr.number,{
            labels: PrLabels
        });
    }

    return Pr;
};


module.exports = {
    doCovidVaccinesSparklineData
};