const { queryDataset } = require('../common/snowflakeQuery');
const { validateJSON2, getSqlWorkAndSchemas } = require('../common/schemaTester');
const { createTreeFromFileMap, PrIfChanged, todayDateString } = require('../common/gitTreeCommon');
const GitHub = require('github-api');
const PrLabels = ['Automatic Deployment','Add to Rollup','Publish at 9:20 a.m. ☀️'];
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const targetBranch = 'main'
const stagingBranch = 'CovidStateDashboardTables_Staging';
const doInputValidation = true;
const doOutputValidation = true;
const sqlRootPath = '../SQL/CDT_COVID/CovidStateDashboardTables/';
const outputPath = 'data/dashboard';
const regionList = ["California","Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa","Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo","Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa","Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange","Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino","San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo","Santa Barbara","Santa Clara","Santa Cruz","Shasta","Sierra","Siskiyou","Solano","Sonoma","Stanislaus","Sutter","Tehama","Trinity","Tulare","Tuolumne","Ventura","Yolo","Yuba"];

const PrInfoList = [
    {
        title : "Covid Dashboard Tables - Tests",
        folders : [
            "total-tests",
            "positivity-rate"
        ]
    }
];

const getDateValueRows = (dataset, valueColumnName) => {
    let DateValueRange = dataset
        .filter(m=>m[valueColumnName]!==null) //0s are ok
        .map(m=>m.DATE);

    let MINIMUM = DateValueRange[DateValueRange.length-1];
    let MAXIMUM = DateValueRange[0];

    return {
        DATE_RANGE: {
            MINIMUM,
            MAXIMUM
        },
        VALUES: dataset
            .filter(f=>f.DATE>=MINIMUM && f.DATE <= MAXIMUM)
            .map(m=>({DATE:m.DATE,VALUE:m[valueColumnName]??0}))
    };
};

const doCovidStateDashboardTablesTests = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath,'schema/input/[file]/schema.json','schema/input/[file]/sample.json','schema/input/[file]/fail/','schema/output/');
    
    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork,process.env["SNOWFLAKE_CDT_COVID"]);
    if(doInputValidation) {
        Object.keys(sqlWorkAndSchemas.schema).forEach(file => {
            const schemaObject = sqlWorkAndSchemas.schema[file];
            const targetJSON = allData[file];
            //require('fs').writeFileSync(`${file}_sample.json`, JSON.stringify(targetJSON,null,2), 'utf8');
            console.log(`Validating - ${file}`);
            validateJSON2(`${file} - failed SQL input validation`, targetJSON,schemaObject.schema,schemaObject.passTests,schemaObject.failTests);
        });
    }

    let allFilesMap = new Map();

    regionList.forEach(myRegion=>{
        let regionFileName = myRegion.toLowerCase().replace(/ /g,'_');

        let summary_by_region = allData.summary_by_region.find(f=>f.REGION===myRegion);
        let rows_by_region = allData.cases_deaths_tests_rows.filter(f=>f.REGION===myRegion);
        if(summary_by_region && rows_by_region.length) {
            allFilesMap.set(`total-tests/${regionFileName}.json`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        TOTAL_TESTS: {
                            total_tests_performed: summary_by_region.total_tests_performed,
                            new_tests_reported: summary_by_region.new_tests_reported,
                            new_tests_reported_delta_1_day: summary_by_region.new_tests_reported_delta_1_day,
                            TESTING_UNCERTAINTY_PERIOD: summary_by_region.TESTING_UNCERTAINTY_PERIOD,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        TOTAL_TESTS: getDateValueRows(rows_by_region,'TOTAL_TESTS'),
                        REPORTED_TESTS: getDateValueRows(rows_by_region,'REPORTED_TESTS'),
                        AVG_TEST_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_TEST_RATE_PER_100K_7_DAYS'),
                        AVG_TEST_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_TEST_REPORT_RATE_PER_100K_7_DAYS')
                    }
                }
            });

            allFilesMap.set(`positivity-rate/${regionFileName}.json`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        POSITIVITY_RATE: {
                            test_positivity_7_days: summary_by_region.test_positivity_7_days,
                            test_positivity_7_days_delta_7_days: summary_by_region.test_positivity_7_days_delta_7_days,
                            TESTING_UNCERTAINTY_PERIOD: summary_by_region.TESTING_UNCERTAINTY_PERIOD,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        TEST_POSITIVITY_RATE_7_DAYS: getDateValueRows(rows_by_region,'TEST_POSITIVITY_RATE_7_DAYS'),
                        DAILY_TEST_POSITIVITY_RATE: getDateValueRows(rows_by_region,'DAILY_TEST_POSITIVITY_RATE'),
                        TOTAL_TESTS: getDateValueRows(rows_by_region,'TOTAL_TESTS')
                    }
                }
            });
        } //if(summary_by_region.length)
    });

    const workTree = await createTreeFromFileMap(gitRepo,targetBranch,allFilesMap,outputPath);

    if(doOutputValidation) {
        //Validate tree output
        console.log(`Validating ${workTree.length} output files`);
        for (let treeRow of workTree) {
            let fileName = treeRow.path.replace(`${outputPath}/`,'');
            let rootFolder = fileName.split('/')[0];
            let content = allFilesMap.get(fileName);
            let schema = sqlWorkAndSchemas.outputSchema.find(f=>rootFolder===f.name);

            if(schema) {
                validateJSON2(`${fileName} failed validation`, content, schema.json);
            } else {
                throw new Error(`Missing validator for ${fileName}.`);
            }
        }
    }

    //Filter the tree and create Prs
    let PrList = [];
    for (let PrInfo of PrInfoList) {
        let filterTree = workTree.filter(t=>PrInfo.folders.some(f=>t.path.startsWith(`${outputPath}/${f}`)));

        let Pr = await PrIfChanged(gitRepo, targetBranch, filterTree, `${todayDateString()} ${PrInfo.title}`, committer);
        if(Pr) {    
            //Label the Pr
            await gitIssues.editIssue(Pr.number,{
                labels: PrLabels
            });

            PrList.push(Pr);
        }
    }

    //Merge all the PRs into a single branch for staging
    if(PrList.length) {
        await gitRepo.deleteRef(`heads/${stagingBranch}`);
        await gitRepo.createBranch(targetBranch,stagingBranch);
        
        for (let Pr of PrList) {
            await gitRepo._request('POST', `/repos/${gitRepo.__fullname}/merges`, {
                base: stagingBranch,
                head: Pr.head.sha,
                commit_message: `Merged PR ${Pr.html_url}`
            });
        }
    }

    return PrList.length ? PrList : null;
};


module.exports = {
    doCovidStateDashboardTablesTests
};