const { queryDataset } = require('../common/snowflakeQuery');
const { validateJSON2, getSqlWorkAndSchemas } = require('../common/schemaTester');
const GitHub = require('github-api');
const PrLabels = ['Automatic Deployment'];
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'master';
const doValidation = true;

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sqlRootPath = '../SQL/CDT_COVID/CovidStateDashboardTables/';
const outputPath = 'data/dashboard';
const regionList = ["California","Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa","Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo","Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa","Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange","Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino","San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo","Santa Barbara","Santa Clara","Santa Cruz","Shasta","Sierra","Siskiyou","Solano","Sonoma","Stanislaus","Sutter","Tehama","Trinity","Tulare","Tuolumne","Ventura","Yolo","Yuba"];

//Git generates the SHA by concatenating a header in the form of blob {content.length} {null byte} and the contents of your file
const sha1 = require('sha1');
const gitHubBlobPredictSha = content => sha1(`blob ${Buffer.byteLength(content)}\0${content}`);

/**
 * 
 * @param {Map<string,any>} filesMap 
 * @param {{data:{tree:[{path:string}]}}} referenceTree 
 * @returns 
 */
const createTreeFromFileMap = (filesMap,referenceTree) => {
    const targetTree = [];

    for (const [key,value] of filesMap) {
        //Tree parts...
        //https://docs.github.com/en/free-pro-team@latest/rest/reference/git#create-a-tree
        const mode = '100644'; //code for tree blob
        const type = 'blob';
    
        const newFileName = `${key.toLowerCase().replace(/ /g,'')}.json`;
        let content = JSON.stringify(value,null,2);

        const treeRow = 
            {
                path: newFileName,
                content, 
                mode, 
                type
            };

        let existingFile = referenceTree.data.tree.find(x=>x.path===treeRow.path);
        if(!existingFile || existingFile.sha !== gitHubBlobPredictSha(content)) {
            treeRow.path = `${outputPath}/${treeRow.path}`;

            targetTree.push(treeRow);
        }
        
    }

    return targetTree;
};


//function to return a new branch if the tree has changes
const branchIfChanged = async (gitRepo, tree, branch, commitName) => {
    if(!tree.length) {
        console.log('No tree changes');
        return null;
    }

    let treeParts = [tree];
    const totalRows = tree.length;

    console.log(`Tree data is ${Buffer.byteLength(JSON.stringify(tree))} bytes`);

    //Split the tree into allowable sizes
    let evalIndex = 0;
    while(evalIndex < treeParts.length) {
        if(JSON.stringify(treeParts[evalIndex]).length>9000000) {
            let half = Math.ceil(treeParts[evalIndex].length / 2);
            treeParts.unshift(treeParts[evalIndex].splice(0, half));
        } else {
            evalIndex++;
        }
    }

    //Grab the starting point for a fresh tree
    const refResult = await gitRepo.getRef(`heads/${masterBranch}`);
    const baseSha = refResult.data.object.sha;

    //Loop through adding items to the tree
    let createTreeResult = {data:{sha:baseSha}};
    let rowCount = 0;
    for(let treePart of treeParts) {
        rowCount += treePart.length;
        console.log(`Creating tree for ${commitName} - ${rowCount}/${totalRows} items`);
        createTreeResult = await gitRepo.createTree(treePart,createTreeResult.data.sha);
    }

    //Create a commit the maps to all the tree changes
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

const getDateValueRows = (dataset, valueColumnName) =>
    dataset
        .map(m=>({DATE:m.DATE,VALUE:m[valueColumnName]}))
        .filter(m=>m.VALUE!==null);


const doCovidStateDashboardTables = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const prTitle = `${todayDateString()} Covid Dashboard Tables`;
    const newBranchName =`${todayDateString()}-${todayTimeString()}-state-dash-tables`;

    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath,'schema/input/[file]/schema.json','schema/input/[file]/sample.json','schema/input/[file]/fail/','schema/output/');
    
    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork,process.env["SNOWFLAKE_CDT_COVID"]);
    if(doValidation) {
        Object.keys(sqlWorkAndSchemas.schema).forEach(file => {
            const schemaObject = sqlWorkAndSchemas.schema[file];
            const targetJSON = allData[file];
            //require('fs').writeFileSync(`${file}_sample.json`, JSON.stringify(targetJSON,null,2), 'utf8');
            console.log(`Validating - ${file}`);
            validateJSON2(`${file} - failed SQL input validation`, targetJSON,schemaObject.schema,schemaObject.passTests,schemaObject.failTests);
        });
    }

    let allFilesMap = new Map();

    const folder_hospitalized_patients = 'hospitalized-patients';
    const folder_icu_patients = 'icu-patients';
    const folder_icu_beds = 'icu-beds';
    const folder_confirmed_cases_episode_date = 'confirmed-cases-episode-date';
    const folder_confirmed_cases_reported_date = 'confirmed-cases-reported-date';
    const folder_confirmed_deaths_death_date = 'confirmed-deaths-death-date';
    const folder_confirmed_deaths_reported_date = 'confirmed-deaths-reported-date';
    const folder_total_tests_testing_date = 'total-tests-testing-date';
    const folder_total_tests_reported_date = 'total-tests-reported-date';
    const folder_positivity_rate = 'positivity-rate';

    regionList.forEach(myRegion=>{
        let regionFileName = myRegion.replace(/ /g,'_');
        let hospitals_and_icus_byRegion = allData.hospitals_and_icus.filter(f=>f.REGION===myRegion);

        if(hospitals_and_icus_byRegion.length) {
            const latestData = hospitals_and_icus_byRegion[0];

            allFilesMap.set(`${folder_hospitalized_patients}/${regionFileName}`,
            {
                meta:{
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data:{
                    latest:{
                        HOSPITALIZED_PATIENTS: {
                            TOTAL:latestData.HOSPITALIZED_PATIENTS,
                            CHANGE:latestData.HOSPITALIZED_PATIENTS_CHANGE,
                            CHANGE_FACTOR:latestData.HOSPITALIZED_PATIENTS_CHANGE_FACTOR,
                            POPULATION:latestData.POPULATION
                        }
                    },
                    time_series: {
                        HOSPITALIZED_PATIENTS: getDateValueRows(hospitals_and_icus_byRegion,'HOSPITALIZED_PATIENTS'),
                        HOSPITALIZED_PATIENTS_14_DAY_AVG: getDateValueRows(hospitals_and_icus_byRegion,'HOSPITALIZED_PATIENTS_14_DAY_AVG')
                    }
                }
            });

            allFilesMap.set(`${folder_icu_patients}/${regionFileName}`,
            {
                meta:{
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data:{
                    latest:{
                        ICU_PATIENTS: {
                            TOTAL:latestData.ICU_PATIENTS,
                            CHANGE:latestData.ICU_PATIENTS_CHANGE,
                            CHANGE_FACTOR:latestData.ICU_PATIENTS_CHANGE_FACTOR,
                            POPULATION:latestData.POPULATION
                        }
                    },
                    time_series:{
                        ICU_PATIENTS: getDateValueRows(hospitals_and_icus_byRegion,'ICU_PATIENTS'),
                        ICU_PATIENTS_14_DAY_AVG: getDateValueRows(hospitals_and_icus_byRegion,'ICU_PATIENTS_14_DAY_AVG')
                    }
                }
            });

            allFilesMap.set(`${folder_icu_beds}/${regionFileName}`,
            {
                meta:{
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data:{
                    latest:{
                        ICU_BEDS: {
                            TOTAL:latestData.ICU_AVAILABLE_BEDS,
                            CHANGE:latestData.ICU_AVAILABLE_BEDS_CHANGE,
                            CHANGE_FACTOR:latestData.ICU_AVAILABLE_BEDS_CHANGE_FACTOR,
                            POPULATION:latestData.POPULATION
                        }
                    },
                    time_series: {
                        ICU_BEDS: getDateValueRows(hospitals_and_icus_byRegion,'ICU_AVAILABLE_BEDS')
                    }
                }
            });
        } //if(hospitals_and_icus_byRegion.length>0)

        let summary_by_region = allData.summary_by_region.find(f=>f.REGION===myRegion);
        let rows_by_region = allData.cases_deaths_tests_rows.filter(f=>f.REGION===myRegion);
        if(summary_by_region && rows_by_region.length) {
            allFilesMap.set(`${folder_confirmed_cases_episode_date}/${regionFileName}`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        CONFIRMED_CASES_EPISODE_DATE: {
                            total_confirmed_cases: summary_by_region.total_confirmed_cases,
                            new_cases: summary_by_region.new_cases,
                            new_cases_delta_1_day: summary_by_region.new_cases_delta_1_day,
                            cases_per_100k_7_days: summary_by_region.cases_per_100k_7_days,
                            EPISODE_UNCERTAINTY_PERIOD: summary_by_region.EPISODE_UNCERTAINTY_PERIOD,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        CONFIRMED_CASES_EPISODE_DATE: getDateValueRows(rows_by_region,'CASES'),
                        AVG_CASE_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_CASE_RATE_PER_100K_7_DAYS')
                    }
                }
            });

            allFilesMap.set(`${folder_confirmed_cases_reported_date}/${regionFileName}`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        CONFIRMED_CASES_REPORTED_DATE: {
                            total_confirmed_cases: summary_by_region.total_confirmed_cases,
                            new_cases: summary_by_region.new_cases,
                            new_cases_delta_1_day: summary_by_region.new_cases_delta_1_day,
                            cases_per_100k_7_days: summary_by_region.cases_per_100k_7_days,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        CONFIRMED_CASES_REPORTED_DATE: getDateValueRows(rows_by_region,'REPORTED_CASES'),
                        AVG_CASE_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_CASE_REPORT_RATE_PER_100K_7_DAYS')
                    }
                }
            });

            allFilesMap.set(`${folder_confirmed_deaths_death_date}/${regionFileName}`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        CONFIRMED_DEATHS_DEATH_DATE: {
                            total_confirmed_deaths: summary_by_region.total_confirmed_deaths,
                            new_deaths: summary_by_region.new_deaths,
                            new_deaths_delta_1_day: summary_by_region.new_deaths_delta_1_day,
                            deaths_per_100k_7_days: summary_by_region.deaths_per_100k_7_days,
                            DEATH_UNCERTAINTY_PERIOD: summary_by_region.DEATH_UNCERTAINTY_PERIOD,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        CONFIRMED_DEATHS_DEATH_DATE: getDateValueRows(rows_by_region,'DEATHS'),
                        AVG_DEATH_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_DEATH_RATE_PER_100K_7_DAYS')
                    }
                }
            });

            allFilesMap.set(`${folder_confirmed_deaths_reported_date}/${regionFileName}`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        CONFIRMED_DEATHS_REPORTED_DATE: {
                            total_confirmed_deaths: summary_by_region.total_confirmed_deaths,
                            new_deaths: summary_by_region.new_deaths,
                            new_deaths_delta_1_day: summary_by_region.new_deaths_delta_1_day,
                            deaths_per_100k_7_days: summary_by_region.deaths_per_100k_7_days,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        CONFIRMED_DEATHS_REPORTED_DATE: getDateValueRows(rows_by_region,'REPORTED_DEATHS'),
                        AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS')
                    }
                }
            });

            allFilesMap.set(`${folder_total_tests_testing_date}/${regionFileName}`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        TOTAL_TESTS_TESTING_DATE: {
                            total_tests_performed: summary_by_region.total_tests_performed,
                            new_tests_reported: summary_by_region.new_tests_reported,
                            new_tests_reported_delta_1_day: summary_by_region.new_tests_reported_delta_1_day,
                            TESTING_UNCERTAINTY_PERIOD: summary_by_region.TESTING_UNCERTAINTY_PERIOD,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        TOTAL_TESTS: getDateValueRows(rows_by_region,'TOTAL_TESTS'),
                        AVG_TEST_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_TEST_RATE_PER_100K_7_DAYS')
                    }
                }
            });

            allFilesMap.set(`${folder_total_tests_reported_date}/${regionFileName}`,
            {
                meta: {
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data: {
                    latest: {
                        TOTAL_TESTS_REPORTED_DATE: {
                            total_tests_performed: summary_by_region.total_tests_performed,
                            new_tests_reported: summary_by_region.new_tests_reported,
                            new_tests_reported_delta_1_day: summary_by_region.new_tests_reported_delta_1_day,
                            POPULATION: summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        REPORTED_TESTS: getDateValueRows(rows_by_region,'REPORTED_TESTS'),
                        AVG_TEST_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region,'AVG_TEST_REPORT_RATE_PER_100K_7_DAYS')
                    }
                }
            });

            allFilesMap.set(`${folder_positivity_rate}/${regionFileName}`,
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
                        TOTAL_TESTS: getDateValueRows(rows_by_region,'TOTAL_TESTS')
                    }
                }
            });
        } //if(summary_by_region.length)
    });

    if(doValidation) {
        //Validate output
        console.log('Validating output files');
        for (let [key,value] of allFilesMap) {
            let rootFolder = key.split('/')[0];
            let schema = sqlWorkAndSchemas.outputSchema.find(f=>rootFolder===f.name);

            if(schema) {
                validateJSON2(`${key} failed validation`, value, schema.json);
            } else {
                throw new Error(`Missing validator for ${key}.`);
            }
        }
    }

    const treeParentPath = outputPath.split('/')[0];
    const rootTree = await gitRepo.getSha(masterBranch,treeParentPath);
    const referenceTreeSha = rootTree.data.find(f=>f.path===outputPath).sha;
    const referenceTree = await gitRepo.getTree(`${referenceTreeSha}?recursive=true`);

    const workTree = createTreeFromFileMap(allFilesMap,referenceTree);

    const newBranch = await branchIfChanged(gitRepo, workTree, newBranchName, newBranchName);
    if(newBranch) {
        const Pr = (await gitRepo.createPullRequest({
            title: prTitle,
            head: newBranchName,
            base: masterBranch
        }))
        .data;

        console.log(`PR created - ${Pr.html_url}`);

        //Label the Pr
        await gitIssues.editIssue(Pr.number,{
            labels: PrLabels
        });

        await sleep(5000); //give PR time to check actions
        //Approve Pr
        await gitRepo.mergePullRequest(Pr.number,{
            merge_method: 'squash'
        });

        //Delete Branch
        await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
        return Pr;
    }
};


module.exports = {
    doCovidStateDashboardTables
};