const { getData_daily_stats_v2 } = require('./daily-stats-v2');
const { getData_infections_by_group } = require('./infections-by-group');
const { todayDateString } = require('../common/gitTreeCommon');

// const { createTreeFromFileMap, PrIfChanged, todayDateString } = require('../common/gitTreeCommon');
// const GitHub = require('github-api');
const { GitHubTreePush } = require("@cagov/github-tree-push");


const PrLabels = ['Automatic Deployment','Add to Rollup','Publish at 9:15 a.m. ☀️'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
// const gitHubCommitter = {
//   name: process.env["GITHUB_NAME"],
//   email: process.env["GITHUB_EMAIL"]
// };

const githubPath = 'data';
const stagingBranch = 'CovidStateDashboard_Summary_Staging';
const targetBranch = 'main';

/**
 * Check to see if we need stats update PRs, make them if we do.
 * @returns The PR created if changes were made
 */
const doCovidStateDashboardSummary = async () => {
    // const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    // const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    // const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const gitToken = process.env["GITHUB_TOKEN"];
    const prTitle = `${todayDateString()} Dashboard Summary Update`;

    const datasets = [
        await getData_infections_by_group(),
        await getData_daily_stats_v2()
    ];

    const stagingTree = new GitHubTreePush(gitToken, {
        owner: githubOwner,
        repo: githubRepo,
        path: githubPath,
        base: stagingBranch,
        removeOtherFiles: false,
        commit_message: prTitle,
        pull_request: false
    });
    for (let drec of datasets) {
        stagingTree.syncFile(drec.path, drec.json);
    }
    await stagingTree.treePush();

    const mainTree = new GitHubTreePush(gitToken, {
        owner: githubOwner,
        repo: githubRepo,
        path: githubPath,
        base: targetBranch,
        removeOtherFiles: false,
        commit_message: prTitle,
        pull_request: true,
        pull_request_options: {
            title: prTitle,
            issue_options: {
                labels: PrLabels
            }
        }
    });
    for (let drec of datasets) {
        mainTree.syncFile(drec.path, drec.json);
    }
    const mainResult = await mainTree.treePush();
    return mainResult;
};

module.exports = {
    doCovidStateDashboardSummary
};