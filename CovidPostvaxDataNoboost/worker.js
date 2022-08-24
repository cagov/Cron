const { getData_daily_postvax_data } = require('./daily-postvax-data');

const { GitHubTreePush } = require("@cagov/github-tree-push");
const { todayDateString, todayTimeString, sleep } = require('../common/gitTreeCommon');
const PrLabels = ['Automatic Deployment','Add to Rollup','Publish at 9:15 a.m. ☀️'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
const githubPath = 'data/dashboard/postvax-v2';
const fileName = 'california.json';
const stagingBranch = 'CovidStateDashboardPostvax_Staging';
const targetBranch = 'main';

/**
 * Check to see if we need stats update PRs, make them if we do.
 * @returns The PR created if changes were made
 */
const doCovidPostvaxData = async (previewOnly) => {
    const gitToken = process.env["GITHUB_TOKEN"];
    const prTitle = `${todayDateString()} Postvax-v2 Data Update`;

    const jsonData =  await getData_daily_postvax_data();

    const stagingTree = new GitHubTreePush(gitToken, {
        owner: githubOwner,
        repo: githubRepo,
        path: githubPath,
        base: stagingBranch,
        removeOtherFiles: true,
        commit_message: prTitle,
        pull_request: false
    });

    stagingTree.syncFile(fileName, jsonData);
    const stagingResult = await stagingTree.treePush();

    if (!previewOnly) {
        const mainTree = new GitHubTreePush(gitToken, {
            owner: githubOwner,
            repo: githubRepo,
            path: githubPath,
            base: targetBranch,
            removeOtherFiles: true,
            commit_message: prTitle,
            pull_request: true,
            pull_request_options: {
                title: prTitle,
                issue_options: {
                    labels: PrLabels
                }
            }
        });

        mainTree.syncFile(fileName, jsonData);
        const mainResult = await mainTree.treePush();

        return mainResult;
    } else {
        return stagingResult;
    }
};

module.exports = {
    doCovidPostvaxData
};