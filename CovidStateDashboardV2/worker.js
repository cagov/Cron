const { queryDataset } = require('../common/snowflakeQuery');
const targetFileName = 'daily-stats-v2.json';
const targetPath = "data/";

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
const useSampleData = false;

//Check to see if we need stats update PRs, make them if we do.
const doCovidStateDashboarV2 = async () => {
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

    const dataOutput = useSampleData ? sampleData : await getData();
    const targetcontent = (await gitRepo.getContents(branch,`${targetPath}${targetFileName}`,true)).data;
    if(JSON.stringify(dataOutput)===JSON.stringify(targetcontent)) {
        console.log('data matched - no need to update');
    } else {
        console.log('data changed - updating');
        if(!Pr) {
            //new branch
            branch = `${branchPrefix}-${todayDateString}-${todayTimeString}`;
            await gitRepo.createBranch(masterBranch,branch);
        }

        await gitRepo.writeFile(branch, `${targetPath}${targetFileName}`, JSON.stringify(dataOutput,null,2), commitMessage, {committer,encode:true});

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

const getData = async () => {
    const sql = `
        select
            SUM(LATEST_TOTAL_CONFIRMED_CASES),
            SUM(NEWLY_REPORTED_CASES),
            SUM(LATEST_PCT_CH_CASES_REPORTED_1_DAY),
            SUM(LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS),
            SUM(NEWLY_REPORTED_CASES_LAST_7_DAYS),
            SUM(LATEST_TOTAL_CONFIRMED_DEATHS),
            SUM(NEWLY_REPORTED_DEATHS),
            SUM(LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS),      
            SUM(LATEST_PCT_CH_DEATHS_REPORTED_1_DAY),
            SUM(LATEST_TOTAL_TESTS_PERFORMED),
            SUM(NEWLY_REPORTED_TESTS),
            SUM(LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY),
            SUM(LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS),
            SUM(NEWLY_REPORTED_TESTS_LAST_7_DAYS),
            SUM(LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS),
            SUM(LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS),
            SUM(LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS),
            SUM(LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS)
        from
        COVID.DEVELOPMENT.VW_CDPH_COUNTY_AND_STATE_TIMESERIES_METRICS  
        where area='California';
    `;

    const sqlResults = await queryDataset(sql);
    const row = sqlResults[0][0][0];

    const mappedResults = {
        data: {
            cases: {
                LATEST_TOTAL_CONFIRMED_CASES : row['SUM(LATEST_TOTAL_CONFIRMED_CASES)'],
                NEWLY_REPORTED_CASES : row['SUM(NEWLY_REPORTED_CASES)'],
                LATEST_PCT_CH_CASES_REPORTED_1_DAY : row['SUM(LATEST_PCT_CH_CASES_REPORTED_1_DAY)'],
                LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS)'],
                NEWLY_REPORTED_CASES_LAST_7_DAYS : row['SUM(NEWLY_REPORTED_CASES_LAST_7_DAYS)']
            },
            deaths : {
                LATEST_TOTAL_CONFIRMED_DEATHS : row['SUM(LATEST_TOTAL_CONFIRMED_DEATHS)'],
                NEWLY_REPORTED_DEATHS : row['SUM(NEWLY_REPORTED_DEATHS)'],
                LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS)'],
                LATEST_PCT_CH_DEATHS_REPORTED_1_DAY : row['SUM(LATEST_PCT_CH_DEATHS_REPORTED_1_DAY)']
            },
            tests :{
                LATEST_TOTAL_TESTS_PERFORMED : row['SUM(LATEST_TOTAL_TESTS_PERFORMED)'],
                LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY : row['SUM(LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY)'],
                LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS)'],
                NEWLY_REPORTED_TESTS_LAST_7_DAYS : row['SUM(NEWLY_REPORTED_TESTS_LAST_7_DAYS)'],
                LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS : row['SUM(LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS)']
            }
        }
    };

    return mappedResults;
};

const sampleData = {
    cases: {
      LATEST_TOTAL_CONFIRMED_CASES: 2187223,
      NEWLY_REPORTED_CASES: 31245,
      LATEST_PCT_CH_CASES_REPORTED_1_DAY: 0.014492,
      LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS: 94.203671345,
      NEWLY_REPORTED_CASES_LAST_7_DAYS: 262214
    },
    deaths: {
      LATEST_TOTAL_CONFIRMED_DEATHS: 24195,
      NEWLY_REPORTED_DEATHS: 74,
      LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS: 0.368452766,
      LATEST_PCT_CH_DEATHS_REPORTED_1_DAY: 0.003068
    },
    tests: {
      LATEST_TOTAL_TESTS_PERFORMED: 31191431,
      LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY: 0.000352,
      LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS: 302292,
      NEWLY_REPORTED_TESTS_LAST_7_DAYS: 687398,
      LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS: 0.127341395,
      LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS: 6.853225933,
      LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS: 0.105731094,
      LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS: 0.018447592
    }
  };

module.exports = {
    doCovidStateDashboarV2
};
