const { getData_daily_vaccines_sparkline } = require('./daily-vaccines-sparkline');

const { GitHubTreePush } = require("@cagov/github-tree-push");
const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});

const PrLabels = ['Automatic Deployment','Add to Rollup','Publish at 9:15 a.m. ☀️'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
const gitHubCommitter = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const githubPath = 'data/dashboard/vaccines';
const fileName = 'sparkline.json';
const stagingBranch = 'CovidStateDashboardVaccines_Sparkline_Staging';
const targetBranch = 'main';

/**
 * Check to see if we need stats update PRs, make them if we do.
 * @returns The PR created if changes were made
 */
const doCovidVaccinesSparklineData = async () => {
    const gitToken = process.env["GITHUB_TOKEN"];
    const prTitle = `${todayDateString()} Vaccines Sparkline Data Update`;

    const jsonData = await getData_daily_vaccines_sparkline();
    //const jsonData = require('./sample.json');

    //Add publishedDate
    if(!jsonData.meta) {
        jsonData.meta = {};
    }
    jsonData.meta.PUBLISHED_DATE = todayDateString();

    // compute 7-day daily average from available data with 7-day delay
    const pending_date = jsonData.data.time_series.VACCINE_DOSES.VALUES[6].DATE;
    const vaxList = jsonData.data.time_series.VACCINE_DOSES.VALUES;
    let summedDosesCount = 0;
    let parse_state = 0;
    let summed_days = 0;
    for (let i = 0; i < vaxList.length; ++i) {
        if (parse_state == 0) {
            if (vaxList[i].DATE == pending_date) {
                parse_state = 1;
            }
        } else {
            summedDosesCount += vaxList[i].VALUE;
            summed_days += 1;
        }
        if (summed_days == 7) {
            break;
        }
    }
    // console.log("SUMMED VACCINE DOSES",summedDosesCount, summed_days, vaxList.length);
    jsonData.data.time_series.VACCINE_DOSES.DOSES_DAILY_AVERAGE = summedDosesCount / summed_days;

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
    doCovidVaccinesSparklineData
};