const { queryDataset } = require('../common/snowflakeQuery');
const { validateJSON, validateJSON2, getSqlWorkAndSchemas } = require('../common/schemaTester');
const GitHub = require('github-api');
const PrLabels = ['Automatic Deployment'];
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'master';

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sqlRootPath = '../SQL/CDT_COVID/CovidStateDashboardTables/';
const outputPath = 'data/dashboard/state-dashboard/';
const regionList = ["California","Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa","Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo","Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa","Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange","Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino","San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo","Santa Barbara","Santa Clara","Santa Cruz","Shasta","Sierra","Siskiyou","Solano","Sonoma","Stanislaus","Sutter","Tehama","Trinity","Tulare","Tuolumne","Ventura","Yolo","Yuba"];
//const regionList = ["California","Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa","Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo","Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa","Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange","Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino","San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo","Santa Barbara","Santa Clara","Santa Cruz",         "Sierra","Siskiyou"];

const createTreeFromFileMap = (existingTree,filesMap,rootPath) => {
    const targetTree = existingTree || [];

    for (const [key,value] of filesMap) {
        //Tree parts...
        //https://docs.github.com/en/free-pro-team@latest/rest/reference/git#create-a-tree
        const mode = '100644'; //code for tree blob
        const type = 'blob';
    
        const newFileName = `${key.toLowerCase().replace(/ /g,'')}.json`;
        const content = JSON.stringify(value,null,2);
        
        const treeRow = 
            {
                path: `${rootPath}${newFileName}`,
                content, mode, type
            };

        targetTree.push(treeRow);
    }

    return targetTree;
};


//function to return a new branch if the tree has changes
const branchIfChanged = async (gitRepo, tree, branch, commitName) => {
    const refResult = await gitRepo.getRef(`heads/${masterBranch}`);
    const baseSha = refResult.data.object.sha;

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

    //Loop through adding items to the tree
    let createTreeResult = {data:{sha:baseSha}};
    let rowCount = 0;
    for(let treePart of treeParts) {
        rowCount += treePart.length;
        console.log(`Creating tree for ${commitName} - ${rowCount}/${totalRows} items`);
        createTreeResult = await gitRepo.createTree(treePart,createTreeResult.data.sha);
    }

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

const doCovidStateDashboardTables = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const prTitle = `${todayDateString()} Covid Dashboard Tables`;
    const newBranchName =`${todayDateString()}-${todayTimeString()}-state-dash-tables`;

    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath,'schema/[file]/input/schema.json','schema/[file]/input/sample.json','schema/[file]/input/fail/');
    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork,process.env["SNOWFLAKE_CDT_COVID"]);
    Object.keys(sqlWorkAndSchemas.schema).forEach(file => {
        const schemaObject = sqlWorkAndSchemas.schema[file];
        const targetJSON = allData[file];
        validateJSON2(`${file} - failed SQL input validation`, targetJSON,schemaObject.schema,schemaObject.passTests,schemaObject.failTests);
    });


    let allFilesMap = new Map();

    regionList.forEach(myRegion=>{
        let regionFileName = myRegion.replace(/ /g,'_');
        let hospitals_and_icus_byRegion = allData.hospitals_and_icus.filter(f=>f.REGION===myRegion);

        if(hospitals_and_icus_byRegion.length) {
            const latestData = hospitals_and_icus_byRegion[0];

            allFilesMap.set(`hospitalized-patients/${regionFileName}`,
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
                    time_series:{
                        HOSPITALIZED_PATIENTS: hospitals_and_icus_byRegion
                            .map(m=>({DATE:m.DATE,VALUE:m.HOSPITALIZED_PATIENTS}))
                            .filter(m=>m.VALUE!==null),
                        HOSPITALIZED_PATIENTS_14_DAY_AVG: hospitals_and_icus_byRegion
                            .map(m=>({DATE:m.DATE,VALUE:m.HOSPITALIZED_PATIENTS_14_DAY_AVG}))
                            .filter(m=>m.VALUE!==null)
                    }
                }
            });

            allFilesMap.set(`icu-patients/${regionFileName}`,
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
                        ICU_PATIENTS: hospitals_and_icus_byRegion
                            .map(m=>({DATE:m.DATE,VALUE:m.ICU_PATIENTS}))
                            .filter(m=>m.VALUE!==null),
                        ICU_PATIENTS_14_DAY_AVG: hospitals_and_icus_byRegion
                            .map(m=>({DATE:m.DATE,VALUE:m.ICU_PATIENTS_14_DAY_AVG}))
                            .filter(m=>m.VALUE!==null)
                    }
                }
            });

            allFilesMap.set(`icu-beds/${regionFileName}`,
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
                    time_series:{
                        ICU_BEDS: hospitals_and_icus_byRegion
                            .map(m=>({DATE:m.DATE,VALUE:m.ICU_AVAILABLE_BEDS}))
                            .filter(m=>m.VALUE!==null)
                    }
                }
            });
        } //if(hospitals_and_icus_byRegion.length>0)

        let summary_by_region = allData.summary_by_region.find(f=>f.REGION===myRegion);
        let rows_by_region = allData.cases_deaths_tests_rows.filter(f=>f.REGION===myRegion);
        if(summary_by_region && rows_by_region.length) {
            allFilesMap.set(`confirmed-cases-episode-date/${regionFileName}`,
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
                            EPISODE_UNCERTAINTY_PERIOD: rows_by_region.find(f=>!f.EPISODE_UNCERTAINTY_PERIOD).DATE,
                            POPULATION:summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        CONFIRMED_CASES_EPISODE_DATE: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.CASES}))
                            .filter(m=>m.VALUE!==null),
                        AVG_CASE_RATE_PER_100K_7_DAYS: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.AVG_CASE_RATE_PER_100K_7_DAYS}))
                            .filter(m=>m.VALUE!==null)
                    }
                }
            });

            allFilesMap.set(`confirmed-cases-reported-date/${regionFileName}`,
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
                            POPULATION:summary_by_region.POPULATION
                        }
                    },
                    time_series:{
                        CONFIRMED_CASES_REPORTED_DATE: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.REPORTED_CASES}))
                            .filter(m=>m.VALUE!==null),
                        AVG_CASE_REPORT_RATE_PER_100K_7_DAYS: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.AVG_CASE_REPORT_RATE_PER_100K_7_DAYS}))
                            .filter(m=>m.VALUE!==null)
                    }
                }
            });

            allFilesMap.set(`confirmed-deaths-death-date/${regionFileName}`,
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
                            DEATH_UNCERTAINTY_PERIOD: rows_by_region.find(f=>!f.DEATH_UNCERTAINTY_PERIOD).DATE,
                            POPULATION:summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        CONFIRMED_DEATHS_DEATH_DATE: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.DEATHS}))
                            .filter(m=>m.VALUE!==null),
                        AVG_DEATH_RATE_PER_100K_7_DAYS: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.AVG_DEATH_RATE_PER_100K_7_DAYS}))
                            .filter(m=>m.VALUE!==null)
                    }
                }
            });

            allFilesMap.set(`confirmed-deaths-reported-date/${regionFileName}`,
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
                            POPULATION:summary_by_region.POPULATION
                        }
                    },
                    time_series: {
                        CONFIRMED_DEATHS_REPORTED_DATE: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.REPORTED_DEATHS}))
                            .filter(m=>m.VALUE!==null),
                        AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS: rows_by_region
                            .map(m=>({DATE:m.DATE,VALUE:m.AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS}))
                            .filter(m=>m.VALUE!==null)
                    }
                }
            });
        } //if(summary_by_region.length)
    });


    const workTree = createTreeFromFileMap(null,allFilesMap,outputPath);

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

        //await sleep(5000); //give PR time to check actions
        //Approve Pr
        //await gitRepo.mergePullRequest(Pr.number,{
        //    merge_method: 'squash'
        //});

        //Delete Branch
        //await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
        return Pr;
    }
};


module.exports = {
    doCovidStateDashboardTables
};