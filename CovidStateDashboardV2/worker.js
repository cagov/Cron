const { queryDataset,getDatabaseConnection } = require('../common/snowflakeQueryV2');
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

const roundNumber = (number, fractionDigits=3) => {
    const roundscale = Math.pow(10,fractionDigits);
    return Math.round(Number.parseFloat(number)*roundscale)/roundscale;
};

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
    const sqlWork_CDT_COVID = {
    metrics:
    `
        select top 1
            MAX(DATE),
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
    `,
    hospitalizations : `
    WITH HOSPITALIZATIONS as (
        select TO_DATE(SF_LOAD_TIMESTAMP) as SF_LOAD_TIMESTAMP
          , SUM(HOSPITALIZED_COVID_CONFIRMED_PATIENTS) AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS
          , SUM(HOSPITALIZED_SUSPECTED_COVID_PATIENTS) AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS
          , SUM(ICU_COVID_CONFIRMED_PATIENTS) AS ICU_COVID_CONFIRMED_PATIENTS
          , SUM(ICU_SUSPECTED_COVID_PATIENTS) AS ICU_SUSPECTED_COVID_PATIENTS
          , SUM(HOSPITALIZED_COVID_CONFIRMED_PATIENTS) + SUM(HOSPITALIZED_SUSPECTED_COVID_PATIENTS) AS TOTAL_PATIENTS
        FROM COVID.PRODUCTION.VW_CHA_HOSPITALDATA_OLD
        group by TO_DATE(SF_LOAD_TIMESTAMP)
    )
    , CHANGES as (
        select SF_LOAD_TIMESTAMP
            , HOSPITALIZED_COVID_CONFIRMED_PATIENTS
                , ZEROIFNULL(HOSPITALIZED_COVID_CONFIRMED_PATIENTS - LAG(HOSPITALIZED_COVID_CONFIRMED_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY
                , HOSPITALIZED_COVID_CONFIRMED_PATIENTS - LAG(HOSPITALIZED_COVID_CONFIRMED_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS
            , HOSPITALIZED_SUSPECTED_COVID_PATIENTS
                , ZEROIFNULL(HOSPITALIZED_SUSPECTED_COVID_PATIENTS - LAG(HOSPITALIZED_SUSPECTED_COVID_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY
                , HOSPITALIZED_SUSPECTED_COVID_PATIENTS - LAG(HOSPITALIZED_SUSPECTED_COVID_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS
            , ICU_COVID_CONFIRMED_PATIENTS
                , ZEROIFNULL(ICU_COVID_CONFIRMED_PATIENTS - LAG(ICU_COVID_CONFIRMED_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS ICU_COVID_CONFIRMED_PATIENTS_DAILY
                , ICU_COVID_CONFIRMED_PATIENTS - LAG(ICU_COVID_CONFIRMED_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS
            , ICU_SUSPECTED_COVID_PATIENTS
                , ZEROIFNULL(ICU_SUSPECTED_COVID_PATIENTS - LAG(ICU_SUSPECTED_COVID_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS ICU_SUSPECTED_COVID_PATIENTS_DAILY
                , ICU_SUSPECTED_COVID_PATIENTS - LAG(ICU_SUSPECTED_COVID_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS
            , TOTAL_PATIENTS
        FROM HOSPITALIZATIONS
    )
    select TOP 1 SF_LOAD_TIMESTAMP
        , HOSPITALIZED_COVID_CONFIRMED_PATIENTS
            , HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY
            , CASE HOSPITALIZED_COVID_CONFIRMED_PATIENTS
                WHEN 0 THEN 0
                WHEN HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY THEN 1
                ELSE HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY / (HOSPITALIZED_COVID_CONFIRMED_PATIENTS-HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY)
            END AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG
            , HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS
        , HOSPITALIZED_SUSPECTED_COVID_PATIENTS
            , HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY
            , CASE HOSPITALIZED_SUSPECTED_COVID_PATIENTS
                WHEN 0 THEN 0
                WHEN HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY THEN 1
                ELSE HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY / (HOSPITALIZED_SUSPECTED_COVID_PATIENTS-HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY)
            END AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG
            , HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS
        , ICU_COVID_CONFIRMED_PATIENTS
            , ICU_COVID_CONFIRMED_PATIENTS_DAILY
            , CASE ICU_COVID_CONFIRMED_PATIENTS
                WHEN 0 THEN 0
                WHEN ICU_COVID_CONFIRMED_PATIENTS_DAILY THEN 1
                ELSE ICU_COVID_CONFIRMED_PATIENTS_DAILY / (ICU_COVID_CONFIRMED_PATIENTS-ICU_COVID_CONFIRMED_PATIENTS_DAILY)
            END AS ICU_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG
            , ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS
        , ICU_SUSPECTED_COVID_PATIENTS
            , ICU_SUSPECTED_COVID_PATIENTS_DAILY
            , CASE ICU_SUSPECTED_COVID_PATIENTS
                WHEN 0 THEN 0
                WHEN ICU_SUSPECTED_COVID_PATIENTS_DAILY THEN 1
                ELSE ICU_SUSPECTED_COVID_PATIENTS_DAILY / (ICU_SUSPECTED_COVID_PATIENTS-ICU_SUSPECTED_COVID_PATIENTS_DAILY)
            END AS ICU_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG
            , ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS
        , TOTAL_PATIENTS
    FROM CHANGES
    ORDER BY SF_LOAD_TIMESTAMP DESC
    `};

    const sqlVaccines = `
        select TOP 2
            "Administered Data Date" as administered_date
            ,doses_administered
            ,cummulative_daily_doses_administered
            ,div0(
            (cummulative_daily_doses_administered - lag(cummulative_daily_doses_administered,1,0) over (order by "Administered Data Date" ASC))
            ,lag(cummulative_daily_doses_administered,1,0) over (order by "Administered Data Date" ASC)
            ) increase_from_prior_day 
        from (
            select 
                "Administered Data Date"
                ,count(distinct ("Total Pfizer Doses Administered")) + count(distinct ("Total Moderna Doses Administered")) doses_administered
                ,sum(count(distinct ("Total Pfizer Doses Administered")) + count(distinct ("Total Moderna Doses Administered"))) over (order by "Administered Data Date" ASC) cummulative_daily_doses_administered
            from 
                CA_VACCINE.CA_VACCINE.VW_TAB_VAX_ADMINISTERED_ALT
            where
                "Administered Data Date" < to_date(getdate())
            group by
                "Administered Data Date"
        ) a 
        order by
            "Administered Data Date" desc
    `;

    const connStats = getDatabaseConnection("SNOWFLAKE_CDT_COVID");
    const statResults = await queryDataset(sqlWork_CDT_COVID,connStats);
    const connVaccines = getDatabaseConnection("SNOWFLAKE_CDTCDPH_VACCINE");
    const resultsVaccines = await queryDataset(sqlVaccines,connVaccines);
    
    const row = statResults.metrics[0];
    const rowHospitals = statResults.hospitalizations[0];
    const rowVaccines = resultsVaccines[1];

    const mappedResults = {
        data: {
            cases: {
                DATE : row['MAX(DATE)'],
                LATEST_TOTAL_CONFIRMED_CASES : row['SUM(LATEST_TOTAL_CONFIRMED_CASES)'],
                NEWLY_REPORTED_CASES : row['SUM(NEWLY_REPORTED_CASES)'],
                LATEST_PCT_CH_CASES_REPORTED_1_DAY : roundNumber(100.0*row['SUM(LATEST_PCT_CH_CASES_REPORTED_1_DAY)'],6),
                LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS)'],
                NEWLY_REPORTED_CASES_LAST_7_DAYS : row['SUM(NEWLY_REPORTED_CASES_LAST_7_DAYS)']
            },
            deaths : {
                DATE : row['MAX(DATE)'],
                LATEST_TOTAL_CONFIRMED_DEATHS : row['SUM(LATEST_TOTAL_CONFIRMED_DEATHS)'],
                NEWLY_REPORTED_DEATHS : row['SUM(NEWLY_REPORTED_DEATHS)'],
                LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS)'],
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
                LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_CASE_RATE_PER_100K_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_DEATH_RATE_PER_100K_7_DAYS)'],
                LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS : row['SUM(LATEST_CONFIDENT_INCREASE_POSITIVITY_RATE_7_DAYS)']
            },
            hospitalizations : {
                DATE : rowHospitals.SF_LOAD_TIMESTAMP,
                HOSPITALIZED_COVID_CONFIRMED_PATIENTS : rowHospitals.HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY,
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
                DATE : rowVaccines.ADMINISTERED_DATE,
                DOSES_ADMINISTERED : rowVaccines.DOSES_ADMINISTERED,
                CUMMULATIVE_DAILY_DOSES_ADMINISTERED : rowVaccines.CUMMULATIVE_DAILY_DOSES_ADMINISTERED,
                PCT_INCREASE_FROM_PRIOR_DAY : roundNumber(100.0*rowVaccines.INCREASE_FROM_PRIOR_DAY,6)
            }
        }
    };

    return mappedResults;
};

module.exports = {
    doCovidStateDashboarV2
};
