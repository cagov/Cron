const snowflake = require('snowflake-sdk');
const { slackBotChatPost, slackBotDelayedChatPost, slackBotReportError } = require('../common/slackBot');
const githubBranch = "master";
const stagingFileLoc = 'data/to-review/equitydash/';
const productionFileLoc = 'data/reviewed/equitydash/';
const branchPrefix = 'carter-data-';
const GitHub = require('github-api');
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};

//const slackBotCompletedWorkChannel = 'C01BMCQK0F6'; //main channel
//const slackBotDebugChannel = 'C01DBP67MSQ'; //#testingbot
//const slackBotDebugChannel = 'C0112NK978D'; //Aaron debug?
const slackBotDebugChannel = 'C01H6RB99E2'; //Carter debug
const slackBotCompletedWorkChannel = 'C01H6RB99E2'; //Carter debug
const appName = 'CovidEquityData';

const {
    gitHubBlobPredictSha
} = require('../common/gitHub');

module.exports = async function (context, functionInput) {
    //await slackBotChatPost(slackBotDebugChannel,`${appName} started`);

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);



const baseSha = (await gitRepo.getTree('carter-tree-test')).data.sha;

const testTree = [


];

const r = await gitRepo.createTree(testTree,baseSha);


    const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: 'numeric', day: 'numeric', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
    const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');


    try {
        let attrs = {
            account: 'cdt.west-us-2.azure',
            username: process.env["SNOWFLAKE_USER"],
            password: process.env["SNOWFLAKE_PASS"],
            warehouse: 'COVID_CDPH_VWH',
            database: 'COVID'
        };
        const connection = snowflake.createConnection(attrs);
        // Try to connect to Snowflake, and check whether the connection was successful.
        connection.connect(err => {
            if (err) {
                    console.error(`Unable to connect: ${err.message}`);
            } else {
                console.log('Successfully connected to Snowflake.');
            }
        });
        
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

        //runs a name/SQL object and returns a matching object with name/Results 
        const executeSql = async sqlWork => {
            const promises = [];

            for(let name of Object.keys(sqlWork)) {
                promises.push(getDbPromise(name,sqlWork[name]));
            }

            const resultDatasets = await Promise.all(promises);

            const result = {};

            //flatten results
            for(let promiseResult of resultDatasets) {
                for(let name of Object.keys(promiseResult)) {
                    result[name] = promiseResult[name];
                }
            }

            return result;
        };

        //creates a new Snowflake Db Promise witht the result set name
        const getDbPromise = (name, sqlText) => new Promise((resolve, reject) => {
            connection.execute({
                sqlText,
                complete: function(err, stmt, rows) {
                    if (err) {
                        console.error(`Failed to execute statement due to the following error: ${err.message}`);
                        reject(`Failed to execute statement due to the following error: ${err.message}`);
                    } else {
                        console.log(`Successfully executed statement: ${stmt.getSqlText()}`);
                        const result = {};
                        result[name] = rows;
                        resolve(result);
                    }
                }
            });
        });

        const allData = await executeSql(DbSqlWork);
        let reviewBranchName = `${branchPrefix}${todayDateString}-${todayTimeString}-equitydash-2-review`;
        let reviewCompletedBranchName = `${branchPrefix}${todayDateString}-${todayTimeString}-equitydash-review-complete`;
    
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
        allFilesMap.set('temp-test-file',`file contents ${new Date().getTime()}`);

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

        const branchDataResult = await gitRepo.getTree(`${githubBranch}?recursive=1`);
        const stagingSubtreeSha = branchDataResult.data.tree.filter(x=>x.path===`data/reviewed/equitydash`)[0].sha;
        const stagingSubtree = await gitRepo.getTree(stagingSubtreeSha);

        //const basetree = await gitRepo.getTree(branchData.data.commit.sha);


        for(const [key,value] of allFilesMap) {
            const newFileName = `${key.toLowerCase().replace(/ /g,'')}.json`;
            const treeItem = stagingSubtree.data.tree.find(x=>x.path===newFileName);

            const newHash = gitHubBlobPredictSha(value);

            const newFilePath = `${stagingFileLoc}${newFileName}`;

        }
        // this fails unless it runs one at a time
        const iterator1 = allFilesMap.keys();
        // eslint-disable-next-line no-inner-declarations
        async function getNext() {
            let nextVal = iterator1.next().value;
            if(nextVal) {
                console.log(`getting ${nextVal}`);
                //let fileResult = await putFile(allFilesMap.get(nextVal),nextVal,reviewBranchName,stagingFileLoc);
                //fileResult = await putFile(allFilesMap.get(nextVal),nextVal,reviewCompletedBranchName,productionFileLoc);
                console.log(fileResult);
                getNext();
            } else {
                console.log('done');
                // the to-review branch will merge to the /to-review location and delete its merge PR
                //await gitHubBranchMerge(reviewBranchName, githubBranch);
                // the reviewedComplete branch should stay open
                let Pr = null; //await gitHubPrGetByBranchName(githubBranch,reviewCompletedBranchName);
                if (!Pr) {
                    const prMessage = `
                    Equity dashboard stats updates in this PR may be reviewed on staging: https://staging.covid19.ca.gov/equity/
                    
                    After reviewing, if all looks well, approve and merge this Pull Request.
                    
                    If there are issues with the data:
                    
                    - Note concerns or issues here by commenting on this PR
                    
                    - Work with Triston directly to resolve data issues
                    
                    - Alert the COVID19 site team in Slack (in the Equity page channel)`;
                    //Pr = await gitHubBranchMerge(reviewCompletedBranchName,githubBranch,true,`${getTodayPacificTime().replace(/\//g,'-')} equity dashboard chart data update`,['Automatic Deployment'],false,prMessage);
                    //await gitHubPrRequestReview(Pr,['vargoCDPH','sindhuravuri']);
                }
                //await slackBotChatPost(slackBotDebugChannel,`${appName} finished`);
                //let postTime = (new Date().getTime() + 1000 * 300) / 1000;
                //await slackBotDelayedChatPost(slackBotCompletedWorkChannel,`Equity stats Update ready for review in https://staging.covid19.ca.gov/equity/ approve the PR here: \n${Pr.html_url}`, postTime);
            }
        }
        getNext();
    } catch (e) {
        await slackBotReportError(slackBotDebugChannel,`Error running equity stats update`,e,context,functionInput);
    }
};
/*
// reusable file write function
async function putFile(value,key,targetBranchName,fileLoc) {
    const newFileName = `${key.toLowerCase().replace(/ /g,'')}.json`;
    const newFilePath = `${fileLoc}${newFileName}`;
    const targetfile = await gitHubFileGet(newFilePath,targetBranchName);
    const contentRaw = JSON.stringify(value,null,2);
    const shaResult = gitHubBlobPredictSha(contentRaw);
//Git generates the SHA by concatenating a header in the form of blob {content.length} {null byte} and the contents of your file

    const content = Buffer.from(contentRaw).toString('base64');
    let resultMessage = "";

    if(targetfile&&targetfile.sha) {
        //UPDATE                
        if(content!==(targetfile.content || '').replace(/\n/g,'')) {
            //Update file
            
            let message = `Update page - ${targetfile.name}`;
            await gitHubFileUpdate(content,targetfile.url,targetfile.sha,message,targetBranchName)
                .then(r => {
                    console.log(`UPDATE Success: ${newFileName}`);
                    return r;
                });
            // await gitHubBranchMerge(branch, mergetarget);
            resultMessage = message;
        } else {
            resultMessage = `File compare matched: ${newFileName}`;
        }
    } else {
        let message = `Add page - ${newFileName}`;
                
        const addResult = await gitHubFileAdd(content,newFilePath,message,targetBranchName)
            .then(r => {console.log(`ADD Success: ${newFileName}`);return r;});   
            
        resultMessage = addResult;
    }
    return resultMessage;
}
*/