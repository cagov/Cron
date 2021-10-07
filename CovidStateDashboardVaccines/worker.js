const { getData_daily_vaccines_sparkline } = require('./daily-vaccines-sparkline');

const GitHub = require('github-api');
const { createTreeFromFileMap, PrIfChanged, todayDateString } = require('../common/gitTreeCommon');
const PrLabels = ['Automatic Deployment','Add to Rollup','Publish at 9:20 a.m. ☀️'];
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const gitHubCommitter = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const treePath = 'data/dashboard/vaccines';
const fileName = 'sparkline.json';
const stagingBranch = 'CovidStateDashboardVaccines_Sparkline_Staging';
const targetBranch = 'main';

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
    }

    return Pr;
};


module.exports = {
    doCovidVaccinesSparklineData
};