const { getData_weekly_variants_data: getData_weekly_variants_data } = require('./weekly-variants-data');

const { GitHubTreePush } = require("@cagov/github-tree-push");
const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const PrLabels = ['Automatic Deployment', 'Add to Rollup', 'Publish at 9:15 a.m. ☀️'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
const githubPath = 'data/dashboard/variants';
const fileName = 'california.json';
const stagingBranch = 'CovidStateDashboardVariants_Staging';
const targetBranch = 'main';

/**
 * Check to see if we need stats update PRs, make them if we do.
 * @returns The PR created if changes were made
 */
const doCovidVariantsData = async () => {
    const gitToken = process.env["GITHUB_TOKEN"];
    const prTitle = `${todayDateString()} Variants Data Update`;

    const jsonData = await getData_weekly_variants_data();

    if (!jsonData.meta) {
        jsonData.meta = {};
    }
    jsonData.meta.PUBLISHED_DATE = todayDateString();
    jsonData.meta.AREA = 'California';
    jsonData.meta.AREA_TYPE = 'State';

    //Staging will be direct commits
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
    await stagingTree.treePush();


    //Production will be PRs
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
};

module.exports = {
    doCovidVariantsData
};