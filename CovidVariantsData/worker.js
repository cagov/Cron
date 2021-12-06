const { getData_weekly_variants_data: getData_weekly_variants_data } = require('./weekly-variants-data');

const GitHub = require('github-api');
const { createTreeFromFileMap, PrIfChanged, todayDateString } = require('../common/gitTreeCommon');
const PrLabels = ['Automatic Deployment','Add to Rollup','Publish at 9:15 a.m. ☀️'];
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const gitHubCommitter = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const treePath = 'data/dashboard/variants';
const fileName = 'california.json';
const stagingBranch = 'CovidStateDashboardVariants_Staging';
const targetBranch = 'main';

/**
 * Check to see if we need stats update PRs, make them if we do.
 * @returns The PR created if changes were made
 */
const doCovidVariantsData = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const prTitle = `${todayDateString()} Variants Data Update`;

    const jsonData =  await getData_weekly_variants_data();

    if(!jsonData.meta) {
        jsonData.meta = {};
    }
    jsonData.meta.PUBLISHED_DATE = todayDateString();
    jsonData.meta.AREA = 'California';
    jsonData.meta.AREA_TYPE = 'State';

    const fileMap = new Map();

    fileMap.set(fileName,jsonData);
    //Staging will be direct commits
    const stagingTree = await createTreeFromFileMap(gitRepo, stagingBranch, fileMap, treePath);
    await PrIfChanged(gitRepo, stagingBranch, stagingTree, prTitle, gitHubCommitter, true);

    //Production will be PRs
    const mainTree = await createTreeFromFileMap(gitRepo, targetBranch, fileMap, treePath);
    const Pr = await PrIfChanged(gitRepo, targetBranch, mainTree, prTitle, gitHubCommitter, false);

    if(Pr) {
        //Label the Pr
        await gitIssues.editIssue(Pr.number,{
            labels: PrLabels
        });
    } else {
        console.log("No changes detected");
    }

    return Pr;
};

module.exports = {
    doCovidVariantsData
};