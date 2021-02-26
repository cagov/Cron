const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');
const targetFileName = 'daily-stats-v2.json';
const targetPath = "data/";
const schemaFileName = "../JSON_Schema/daily-stats-v2/schema.json";
const schemaTestGoodFilePath = "../JSON_Schema/daily-stats-v2/tests/pass/";
const schemaTestBadFilePath = "../JSON_Schema/daily-stats-v2/tests/fail/";

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

const roundNumber = (number, fractionDigits=3) => {
    const roundscale = Math.pow(10,fractionDigits);
    return Math.round(Number.parseFloat(number)*roundscale)/roundscale;
};

//Check to see if we need stats update PRs, make them if we do.
const doCovidStateDashboarV2 = async () => {
    //uncomment this if you want to test the schema before running the query (schema dev mode)
    //validateJSON('daily-stats-v2.json failed validation',null,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);    throw new Error('validation pass');

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

    const dataOutput = await getData();
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
    const statResults = await queryDataset(
        {
            metrics: getSQL('CDT_COVID/Metrics'),
            hospitalizations : getSQL('CDT_COVID/Hospitalizations')
        }
        ,process.env["SNOWFLAKE_CDT_COVID"]
    );
    const resultsVaccines = await queryDataset(
        getSQL('CDTCDPH_VACCINE/Vaccines'),
        process.env["SNOWFLAKE_CDTCDPH_VACCINE"]
    );
    
    const row = statResults.metrics[0];
    const rowHospitals = statResults.hospitalizations[0];
    const rowVaccines = resultsVaccines[0].VACCINE_KPI_JSON;

    const mappedResults = {
        data: {
            cases: {
                DATE : row['MAX(DATE)'],
                LATEST_TOTAL_CONFIRMED_CASES : row['SUM(LATEST_TOTAL_CONFIRMED_CASES)'],
                NEWLY_REPORTED_CASES : row['SUM(NEWLY_REPORTED_CASES)'],
                LATEST_PCT_CH_CASES_REPORTED_1_DAY : roundNumber(100.0*row['SUM(LATEST_PCT_CH_CASES_REPORTED_1_DAY)'],6),
                LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS)'],
                NEWLY_REPORTED_CASES_LAST_7_DAYS : row['SUM(NEWLY_REPORTED_CASES_LAST_7_DAYS)']
            },
            deaths : {
                DATE : row['MAX(DATE)'],
                LATEST_TOTAL_CONFIRMED_DEATHS : row['SUM(LATEST_TOTAL_CONFIRMED_DEATHS)'],
                NEWLY_REPORTED_DEATHS : row['SUM(NEWLY_REPORTED_DEATHS)'],
                LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS)'],
                LATEST_PCT_CH_DEATHS_REPORTED_1_DAY : roundNumber(100.0*row['SUM(LATEST_PCT_CH_DEATHS_REPORTED_1_DAY)'],6)
            },
            tests : {
                DATE : row['MAX(DATE)'],
                LATEST_TOTAL_TESTS_PERFORMED : row['SUM(LATEST_TOTAL_TESTS_PERFORMED)'],
                LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY : roundNumber(100.0*row['SUM(LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY)'],6),
                LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS)'],
                NEWLY_REPORTED_TESTS : row['SUM(NEWLY_REPORTED_TESTS)'],
                NEWLY_REPORTED_TESTS_LAST_7_DAYS : row['SUM(NEWLY_REPORTED_TESTS_LAST_7_DAYS)'],
                LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS : row['SUM(LATEST_CONFIDENT_POSITIVITY_RATE_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS)'], //moved to cases
                LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS)'], //mode to deaths
                LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS)']
            },
            hospitalizations : {
                DATE : rowHospitals.SF_LOAD_TIMESTAMP,
                HOSPITALIZED_COVID_CONFIRMED_PATIENTS : rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS,
                HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY : rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY,
                HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG,6),
                HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS : rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS,
                HOSPITALIZED_SUSPECTED_COVID_PATIENTS : rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS,
                HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY : rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY,
                HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG,6),
                HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS : rowHospitals.HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS
            },
            icu : {
                DATE : rowHospitals.SF_LOAD_TIMESTAMP,
                ICU_COVID_CONFIRMED_PATIENTS : rowHospitals.ICU_COVID_CONFIRMED_PATIENTS,
                ICU_COVID_CONFIRMED_PATIENTS_DAILY : rowHospitals.ICU_COVID_CONFIRMED_PATIENTS_DAILY,
                ICU_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.ICU_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG,6),
                ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS : rowHospitals.ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS,
                ICU_SUSPECTED_COVID_PATIENTS : rowHospitals.ICU_SUSPECTED_COVID_PATIENTS,
                ICU_SUSPECTED_COVID_PATIENTS_DAILY : rowHospitals.ICU_SUSPECTED_COVID_PATIENTS_DAILY,
                ICU_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG : roundNumber(100.0*rowHospitals.ICU_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG,6),
                ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS : rowHospitals.ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS
            },
            vaccinations: {
                DATE : rowHospitals.SF_LOAD_TIMESTAMP,
                DOSES_ADMINISTERED : rowVaccines.DOSES_ADMINISTERED,
                CUMMULATIVE_DAILY_DOSES_ADMINISTERED : rowVaccines.CUMMULATIVE_DAILY_DOSES_ADMINISTERED,
                PCT_INCREASE_FROM_PRIOR_DAY : rowVaccines.PCT_INCREASE_FROM_PRIOR_DAY
            }
        }
    };

    validateJSON('daily-stats-v2.json failed validation', mappedResults,schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);

    return mappedResults;
};

module.exports = {
    doCovidStateDashboarV2
};
