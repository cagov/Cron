const { queryDataset } = require('../common/snowflakeQuery');
const { slackBotChatPost, slackBotDelayedChatPost, slackBotReportError } = require('../common/slackBot');
const { validateJSON, validateJSON2, getSqlWorkAndSchemas } = require('../common/schemaTester');
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
//const PrReviewers = ['vargoCDPH','sindhuravuri'];
const PrReviewers = [];

//const slackBotCompletedWorkChannel = 'C01BMCQK0F6'; //main channel
//const slackBotDebugChannel = 'C01DBP67MSQ'; //#testingbot
//const slackBotDebugChannel = 'C0112NK978D'; //Aaron debug?
const slackBotDebugChannel = 'C01H6RB99E2'; //Carter debug
const slackBotCompletedWorkChannel = 'C01H6RB99E2'; //Carter debug
const appName = 'CovidEquityData';

const sqlRootPath = "../SQL/CDT_COVID/Equity/";

module.exports = async function (context, functionInput) {
    //validateJSON(`xxx failed validation`, require('../common/SQL/CDT_COVID/Equity/schema/CasesAndDeathsByDemographic/sample.json'),schemaFileName,schemaTestGoodFilePath,schemaTestBadFilePath);throw new Error('All good');
    
    try {
        //await slackBotChatPost(slackBotDebugChannel,`${appName} started (planned Tuesdays 1:20pm).`);
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
        
        const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath,'schema/[file]/input/schema.json','schema/[file]/input/sample.json','schema/[file]/input/fail/');

        const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork,process.env["SNOWFLAKE_CDT_COVID"]);

        Object.keys(sqlWorkAndSchemas.schema).forEach(file => {
            const schemaObject = sqlWorkAndSchemas.schema[file];
            const targetJSON = allData[file];
            validateJSON2(`${file} - failed SQL input validation`, targetJSON,schemaObject.schema,schemaObject.passTests,schemaObject.failTests);
        });

        let allFilesMap = new Map();
        const equityTopBoxDataV2 = {
            LowIncome : allData.CasesLowIncome,
            Demographics : allData.CasesAndDeathsByDemographic
        };

        allFilesMap.set('equityTopBoxDataV2',equityTopBoxDataV2);

        validateJSON('equityTopBoxDataV2.CasesAndDeathsByDemographic failed validation', 
            equityTopBoxDataV2,
            `../SQL/CDT_COVID/Equity/schema/CasesAndDeathsByDemographic/output/schema.json`,
            '../SQL/CDT_COVID/Equity/schema/CasesAndDeathsByDemographic/output/sample.json',
            '../SQL/CDT_COVID/Equity/schema/CasesAndDeathsByDemographic/output/fail/'
        );
  
        // this is combining cases, testing and deaths metrics
        allData.MissingnessData.forEach(item => {
            let mapKey = `missingness-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey) || {race_ethnicity:{}};

            countyInfo.race_ethnicity[item.METRIC] = item;
            allFilesMap.set(mapKey,countyInfo);
        });
        // combining sogi missingness with regular missingness so I can write less files
        // missingness sexual orientation, gender identity
        allData.MissingnessSOGIData.forEach(item => {
            let mapKey = `missingness-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey) || {};

            if(!countyInfo[item.SOGI_CATEGORY]) {
                countyInfo[item.SOGI_CATEGORY] = {};
            }
            countyInfo[item.SOGI_CATEGORY][item.METRIC] = {
                METRIC : item.METRIC,
                MISSING : item.MISSING,
                NOT_MISSING : item.NOT_MISSING,
                TOTAL : item.TOTAL,
                PERCENT_COMPLETE : item.PERCENT_COMPLETE,
                PERCENT_COMPLETE_30_DAYS_DIFF : item.DIFF_30_DAY,
                REPORT_DATE : item.REPORT_DATE
            };
            allFilesMap.set(mapKey,countyInfo);
        });

        // for cumulative go through all, add each county to map with cumulative key, all records for that county should be in that one file
        // cumulative for R/E per 100K, R/E by % pop. there used to be a REPORT_DATE here and we used to have to do where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE); but that has been removed and we expect a single cumulative value here now
        allData.CumulativeData.forEach(item => {
            let mapKey = `cumulative-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey) || [];

            item.SORT_METRIC = item.METRIC_TOTAL_PERCENTAGE / item.POPULATION_PERCENTAGE;
            item.METRIC_TOTAL_DELTA = 100 - item.METRIC_TOTAL_PERCENTAGE;
            item.POPULATION_PERCENTAGE_DELTA = 100 - item.POPULATION_PERCENTAGE;
            let allMetricItemsInCounty = [...allData.CumulativeData].filter(f => f.COUNTY === item.COUNTY && f.METRIC === item.METRIC);
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
        allData.SocialData.forEach(item => {
            let mapKey = `social-data-${item.SOCIAL_DET}`;
            let countyInfo = allFilesMap.get(mapKey) || [];

            countyInfo.push(item);
            allFilesMap.set(mapKey,countyInfo);
        });

        // healthequity data
        // equity metric line chart
        allData.HealthEquityData.forEach(item => {
            let mapKey = `healthequity-${item.COUNTY}`;
            let countyInfo = allFilesMap.get(mapKey) || {}; // ts:Date.now() insures file uniqueness

            if(!countyInfo[item.METRIC]) {
                countyInfo[item.METRIC] = [];
            }
            countyInfo[item.METRIC].push(item);        
            allFilesMap.set(mapKey,countyInfo);
        });

        // statewide stats for comparison
        allData.CumulativeStatewideData.forEach(item => {
            let info = allFilesMap.get('cumulative-combined') || {};

            if(!info[item.METRIC]) {
                info[item.METRIC] = item; // just one row for cases, deaths, tests in this query
            }
            allFilesMap.set('cumulative-combined',info);
        });

        // write one file for statewide data
        let statewideMapKey = `statewide-data`;
        let statewidePopData = [];
        allData.StatewideData.forEach(item => {
            statewidePopData.push(item);
        });
        allFilesMap.set(statewideMapKey,statewidePopData);

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
       //await slackBotReportError(slackBotDebugChannel,`Error running equity stats update`,e,context,functionInput);
    }
};