const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { slackBotChatPost, slackBotDelayedChatPost, slackBotReportError } = require('../common/slackBot');
const masterBranch = 'master';
const stagingFileLoc = 'data/to-review/equitydash/';
const productionFileLoc = 'data/reviewed/equitydash/';
const branchPrefix = 'data-';
const GitHub = require('github-api');
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const PrLabels = ['Automatic Deployment'];
const PrReviewers = ['vargoCDPH','sindhuravuri'];

//const slackBotCompletedWorkChannel = 'C01BMCQK0F6'; //main channel
//const slackBotDebugChannel = 'C01DBP67MSQ'; //#testingbot
//const slackBotDebugChannel = 'C0112NK978D'; //Aaron debug?
const slackBotDebugChannel = 'C01H6RB99E2'; //Carter debug
const slackBotCompletedWorkChannel = 'C01H6RB99E2'; //Carter debug
const appName = 'CovidEquityData';

module.exports = async function (context, functionInput) {
    try {
        await slackBotChatPost(slackBotDebugChannel,`${appName} started (planned Tuesdays 1:20pm).`);
        const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
        const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
        const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

        const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
        const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');
        const branchPrefixFull = `${branchPrefix}${todayDateString}-${todayTimeString}-equitydash`;
        const stagingBranchName = `${branchPrefixFull}-2-review`;
        const productionBranchName = `${branchPrefixFull}-review-complete`;
        const stagingCommitText = 'Staging Equity Data';
        const productionCommitText = 'Prod Equity Data';
        const stagingPrTitle = `${todayDateString} equity dashboard chart data update (Staging)`;
        const productionPrTitle = `${todayDateString} equity dashboard chart data update`;

        const productionPrMessage = `
Equity dashboard stats updates in this PR may be reviewed on staging - [here](https://staging.covid19.ca.gov/equity/).

After reviewing, if all looks well, approve and merge this Pull Request.

If there are issues with the data:
- Note concerns or issues here by commenting on this PR
- Work with Triston directly to resolve data issues
- Alert the COVID19 site team in Slack (in the [Equity page channel](https://cadotgov.slack.com/archives/C01BMCQK0F6))`;
        
        const DbSqlWork = {
            casesAndDeathsByDemographic :
                `select
                    *,
                    CASES/POPULATION*100000 as CASE_RATE,
                    DEATHS/POPULATION*100000 as DEATH_RATE
                from
                (
                select
                    RACE_ETHNICITY,
                    sum(cases) as cases,
                    sum(deaths) as deaths,
                    (select sum(POPULATION) from COVID.PRODUCTION.CDPH_STATIC_DEMOGRAPHICS d1 where d1.RACE_ETHNICITY = demoTab.RACE_ETHNICITY) as POPULATION,
                    REPORT_DATE
                from 
                    COVID.PRODUCTION.VW_CDPH_CASE_DEMOGRAPHICS as demoTab
                where
                    RACE_ETHNICITY!='Other'
                    and REPORT_DATE = (SELECT max(REPORT_DATE) from COVID.PRODUCTION.VW_CDPH_CASE_DEMOGRAPHICS)
                group by
                    RACE_ETHNICITY,
                    REPORT_DATE
                order by
                    RACE_ETHNICITY
                )`,
            casesLowIncome :
                `select top 1
                    DATE,
                    STATE_CASE_RATE_PER_100K,
                    CASE_RATE_PER_100K,
                    POPULATION,
                    CASES_7DAYAVG_7DAYSAGO,
                    RATE_DIFF_30_DAYS
                from
                    COVID.PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET
                where 
                    SOCIAL_DET='income_cumulative' and
                    SOCIAL_TIER='below $40K'
                order by
                    DATE desc
                `,
            // cumulative for R/E per 100K, R/E by % pop. there used to be a REPORT_DATE here and we used to have to do where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE); but that has been removed and we expect a single cumulative value here now
            cumulativeData :            `select COUNTY, DEMOGRAPHIC_SET, DEMOGRAPHIC_SET_CATEGORY, METRIC, METRIC_VALUE, METRIC_VALUE_PER_100K, APPLIED_SUPPRESSION, POPULATION_PERCENTAGE, METRIC_TOTAL_PERCENTAGE, METRIC_VALUE_30_DAYS_AGO, METRIC_VALUE_PER_100K_30_DAYS_AGO, METRIC_VALUE_PER_100K_DELTA_FROM_30_DAYS_AGO, METRIC_TOTAL_PERCENTAGE_30_DAYS_AGO, METRIC_VALUE_PERCENTAGE_DELTA_FROM_30_DAYS_AGO from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE where DEMOGRAPHIC_SET = 'race_ethnicity'`,
            cumulativeStatewideData :   `select COUNTY, DEMOGRAPHIC_SET, DEMOGRAPHIC_SET_CATEGORY, METRIC, METRIC_VALUE, METRIC_VALUE_PER_100K, APPLIED_SUPPRESSION, POPULATION_PERCENTAGE, METRIC_TOTAL_PERCENTAGE, METRIC_VALUE_30_DAYS_AGO, METRIC_VALUE_PER_100K_30_DAYS_AGO, METRIC_VALUE_PER_100K_DELTA_FROM_30_DAYS_AGO, METRIC_TOTAL_PERCENTAGE_30_DAYS_AGO, METRIC_VALUE_PERCENTAGE_DELTA_FROM_30_DAYS_AGO from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE where DEMOGRAPHIC_SET = 'Combined'`,
            // statewide stats for comparison
            statewideData :             `select AGE_GROUP, GENDER, RACE_ETHNICITY, POPULATION, SF_LOAD_TIMESTAMP from COVID.PRODUCTION.CDPH_STATIC_DEMOGRAPHICS where SF_LOAD_TIMESTAMP = (select max(SF_LOAD_TIMESTAMP) from PRODUCTION.CDPH_STATIC_DEMOGRAPHICS)`,
            missingnessData :           `select COUNTY, METRIC, MISSING, NOT_MISSING, TOTAL, PERCENT_COMPLETE, PERCENT_COMPLETE_30_DAYS_PRIOR, PERCENT_COMPLETE_30_DAYS_DIFF, REPORT_DATE from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS)`,
            // missingness sexual orientation, gender identity
            missingnessSOGIData :       `select COUNTY, SOGI_CATEGORY, METRIC, MISSING, NOT_MISSING, TOTAL,PERCENT_COMPLETE, PERCENT_COMPLETE_30_DAYS_AGO, DIFF_30_DAY,REPORT_DATE from PRODUCTION.VW_CDPH_SOGI_COMPLETENESS where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS)`,
            socialData :                `select DATE, SOCIAL_DET, SOCIAL_TIER, SORT, CASES_7DAYAVG_7DAYSAGO, POPULATION, CASE_RATE_PER_100K, STATE_CASE_RATE_PER_100K, CASE_RATE_PER_100K_30_DAYS_AGO, RATE_DIFF_30_DAYS from PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET where DATE = (select max(DATE) from PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET)`,
            // equity metric line chart
            healthEquityData :          `select COUNTY, DATE, METRIC, METRIC_VALUE, METRIC_VALUE_30_DAYS_AGO, METRIC_VALUE_DIFF from COVID.PRODUCTION.VW_EQUITY_METRIC_POS_30_DAY_BY_CNT`,
        };

        const allData = await queryDataset(DbSqlWork,process.env["SNOWFLAKE_CDT_COVID"]);

        let allFilesMap = new Map();

        allFilesMap.set('equityTopBoxDataV2',
            {
                LowIncome : allData.casesLowIncome,
                Demographics : allData.casesAndDeathsByDemographic
            }
        );

        // this is combining cases, testing and deaths metrics
        allData.missingnessData.forEach(item => {
            let mapKey = `missingness-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey);
            if(!countyInfo) {
                countyInfo = {};
                countyInfo.race_ethnicity = {};
            }
            countyInfo.race_ethnicity[item.METRIC] = item;
            allFilesMap.set(mapKey,countyInfo);
        });
        // combining sogi missingness with regular missingness so I can write less files
        allData.missingnessSOGIData.forEach(item => {
            let mapKey = `missingness-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey);
            if(!countyInfo) {
                countyInfo = {};
            }
            if(!countyInfo[item.SOGI_CATEGORY]) {
                countyInfo[item.SOGI_CATEGORY] = {};
            }
            countyInfo[item.SOGI_CATEGORY][item.METRIC] = {};
            countyInfo[item.SOGI_CATEGORY][item.METRIC].METRIC = item.METRIC;
            countyInfo[item.SOGI_CATEGORY][item.METRIC].MISSING = item.MISSING;
            countyInfo[item.SOGI_CATEGORY][item.METRIC].NOT_MISSING = item.NOT_MISSING;
            countyInfo[item.SOGI_CATEGORY][item.METRIC].TOTAL = item.TOTAL;
            countyInfo[item.SOGI_CATEGORY][item.METRIC].PERCENT_COMPLETE = item.PERCENT_COMPLETE;
            countyInfo[item.SOGI_CATEGORY][item.METRIC].PERCENT_COMPLETE_30_DAYS_DIFF = item.DIFF_30_DAY;
            countyInfo[item.SOGI_CATEGORY][item.METRIC].REPORT_DATE = item.REPORT_DATE;
            allFilesMap.set(mapKey,countyInfo);
        });

        // for cumulative go through all, add each county to map with cumulative key, all records for that county should be in that one file
        allData.cumulativeData.forEach(item => {
            let mapKey = `cumulative-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey);
            if(!countyInfo) {
                countyInfo = [];
            }
            item.SORT_METRIC = item.METRIC_TOTAL_PERCENTAGE / item.POPULATION_PERCENTAGE;
            item.METRIC_TOTAL_DELTA = 100 - item.METRIC_TOTAL_PERCENTAGE;
            item.POPULATION_PERCENTAGE_DELTA = 100 - item.POPULATION_PERCENTAGE;
            let allMetricItemsInCounty = [...allData.cumulativeData].filter(f => f.COUNTY === item.COUNTY && f.METRIC === item.METRIC);
            item.WORST_VALUE = allMetricItemsInCounty.reduce((a, e) => e["METRIC_VALUE_PER_100K"] > a["METRIC_VALUE_PER_100K"] ? e : a).METRIC_VALUE_PER_100K;
            item.WORST_VALUE_DELTA = item.WORST_VALUE - item.METRIC_VALUE_PER_100K;
            let nonNulls = allMetricItemsInCounty.filter(f => f["METRIC_VALUE_PER_100K"] != null);
            if(nonNulls.length == 0) {
            item.LOWEST_VALUE = null;
            item.PCT_FROM_LOWEST_VALUE = null;  
            } else {
            item.LOWEST_VALUE = nonNulls.reduce((a, e) => e["METRIC_VALUE_PER_100K"] < a["METRIC_VALUE_PER_100K"] ? e : a).METRIC_VALUE_PER_100K;
            item.PCT_FROM_LOWEST_VALUE = item.METRIC_VALUE_PER_100K / item.LOWEST_VALUE;  
            }
            countyInfo.push(item);
            allFilesMap.set(mapKey,countyInfo);
        });

        // social data should all go in one file
        allData.socialData.forEach(item => {
            let mapKey = `social-data-${item.SOCIAL_DET}`;
            let countyInfo = allFilesMap.get(mapKey);
            if(!countyInfo) {
                countyInfo = [];
            }
            countyInfo.push(item);
            allFilesMap.set(mapKey,countyInfo);
        });

        // healthequity data
        allData.healthEquityData.forEach(item => {
            let mapKey = `healthequity-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey);
            if(!countyInfo) {
                countyInfo = {}; // ts:Date.now() insures file uniqueness
            }
            if(!countyInfo[item.METRIC]) {
                countyInfo[item.METRIC] = [];
            }
            countyInfo[item.METRIC].push(item);        
            allFilesMap.set(mapKey,countyInfo);
        });

        allData.cumulativeStatewideData.forEach(item => {
            let info = allFilesMap.get('cumulative-combined');
            if(!info) {
                info = {};
            }
            if(!info[item.METRIC]) {
                info[item.METRIC] = item; // just one row for cases, deaths, tests in this query
            }
            allFilesMap.set('cumulative-combined',info);
        });

        // write one file for statewide data
        let statewideMapKey = `statewide-data`;
        let statewidePopData = [];
        allData.statewideData.forEach(item => {
            statewidePopData.push(item);
        });
        allFilesMap.set(statewideMapKey,statewidePopData);

        //Creates a new file every time, Remove this later
        allFilesMap.set('temp-test-file',`file contents ${new Date().getTime()}`);

        //Create two trees for Production/Staging
        const stagingTree = [];
        const productionTree = [];
        for (const [key,value] of allFilesMap) {
            //Tree parts...
            //https://docs.github.com/en/free-pro-team@latest/rest/reference/git#create-a-tree
            const mode = '100644'; //code for tree blob
            const type = 'blob';

            const newFileName = `${key.toLowerCase().replace(/ /g,'')}.json`;
            const content = JSON.stringify(value,null,2);
            
            const stagingRow = 
                {
                    path: `${stagingFileLoc}${newFileName}`,
                    content, mode, type
                };
            const productionRow = 
                {
                    path: `${productionFileLoc}${newFileName}`,
                    content, mode, type
                };

            stagingTree.push(stagingRow);
            productionTree.push(productionRow);
        }

        //function to return a new branch if the tree has changes
        const branchIfChanged = async (tree, branch, commitName) => {
            const refResult = await gitRepo.getRef(`heads/${masterBranch}`);
            const baseSha = refResult.data.object.sha;
    
            console.log(`Creating tree for ${commitName}`);
            const createTreeResult = await gitRepo.createTree(tree,baseSha);
            const commitResult = await gitRepo.commit(baseSha,createTreeResult.data.sha,commitName,committer);
            const commitSha = commitResult.data.sha;
    
            //Compare the proposed commit with the trunk (master) branch
            const compare = await gitRepo.compareBranches(baseSha,commitSha);
            if (compare.data.files.length) {
                console.log(`${compare.data.files.length} changes.`);
                //Create a new branch and assign this commit to it, return the new branch.
                await gitRepo.createBranch(masterBranch,branch);
                return await gitRepo.updateHead(`heads/${branch}`,commitSha);
            } else {
                console.log('no changes');
                return null;
            }
        };

        //Push files directly to the "staging" area for immediate viewing
        const branchStaging = await branchIfChanged(stagingTree,stagingBranchName,stagingCommitText);
        if(branchStaging) {
            const Pr = (await gitRepo.createPullRequest({
                title: stagingPrTitle,
                head: stagingBranchName,
                base: masterBranch
            }))
            .data;

            //Label the Pr
            await gitIssues.editIssue(Pr.number,{
                labels: PrLabels
            });

            //Approve Pr
            await gitRepo.mergePullRequest(Pr.number,{
                merge_method: 'squash'
            });
    
            //Delete Branch
            await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
        }

        //Push files to a review ready PR, that will move to the production section when approved.
        const branchProduction = await branchIfChanged(productionTree,productionBranchName,productionCommitText);
        if(branchProduction) {
            const Pr = (await gitRepo.createPullRequest({
                title: productionPrTitle,
                head: productionBranchName,
                base: masterBranch,
                body: productionPrMessage
            }))
            .data;

            //label pr
            await gitIssues.editIssue(Pr.number,{
                labels: PrLabels
            });

            //Request reviewers for Pr
            //https://docs.github.com/en/free-pro-team@latest/rest/reference/pulls#request-reviewers-for-a-pull-request
            await gitRepo._request('POST', `/repos/${gitRepo.__fullname}/pulls/${Pr.number}/requested_reviewers`,{reviewers:PrReviewers});

            await slackBotChatPost(slackBotDebugChannel,`${appName} finished`);

            //Delay post to main channel to allow for build time.
            const postTime = (new Date().getTime() + 1000 * 300) / 1000;
            await slackBotDelayedChatPost(slackBotCompletedWorkChannel,`Equity stats Update ready for review in https://staging.covid19.ca.gov/equity/ approve the PR here: \n${Pr.html_url}`, postTime);
        }
    } catch (e) {
        await slackBotReportError(slackBotDebugChannel,`Error running equity stats update`,e,context,functionInput);
    }
};