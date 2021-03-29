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
const outputPath = 'data/state_dash_tables/';

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

    const regionList = ["California","Alameda","Alpine","Amador","Butte","Calaveras","Colusa","Contra Costa","Del Norte","El Dorado","Fresno","Glenn","Humboldt","Imperial","Inyo","Kern","Kings","Lake","Lassen","Los Angeles","Madera","Marin","Mariposa","Mendocino","Merced","Modoc","Mono","Monterey","Napa","Nevada","Orange","Placer","Plumas","Riverside","Sacramento","San Benito","San Bernardino","San Diego","San Francisco","San Joaquin","San Luis Obispo","San Mateo","Santa Barbara","Santa Clara","Santa Cruz","Shasta","Sierra","Siskiyou","Solano","Sonoma","Stanislaus","Sutter","Tehama","Trinity","Tulare","Tuolumne","Ventura","Yolo","Yuba"];

    let allFilesMap = new Map();

    regionList.forEach(myRegion=>{
        let byRegion = allData.hospitals_and_icus.filter(f=>f.REGION===myRegion);

        if(byRegion.length>0) {
            const latestData = byRegion[0];

            let json = {
                meta:{
                    PUBLISHED_DATE: todayDateString(),
                    coverage: myRegion
                },
                data:{
                    latest:{
                        HOSPITALIZED_PATIENTS: {
                            TOTAL:latestData.HOSPITALIZED_PATIENTS,
                            CHANGE:latestData.HOSPITALIZED_PATIENTS_CHANGE,
                            CHANGE_FACTOR:latestData.HOSPITALIZED_PATIENTS_CHANGE_FACTOR
                        },
                        ICU_PATIENTS: {
                            TOTAL:latestData.ICU_PATIENTS,
                            CHANGE:latestData.ICU_PATIENTS_CHANGE,
                            CHANGE_FACTOR:latestData.ICU_PATIENTS_CHANGE_FACTOR
                        }
                    },
                    time_series:{
                        HOSPITALIZED_PATIENTS: byRegion.map(m=>({DATE:m.DATE,VALUE:m.HOSPITALIZED_PATIENTS})),
                        HOSPITALIZED_PATIENTS_14_DAY_AVG: byRegion.map(m=>({DATE:m.DATE,VALUE:m.HOSPITALIZED_PATIENTS_14_DAY_AVG})),
                        ICU_PATIENTS: byRegion.map(m=>({DATE:m.DATE,VALUE:m.ICU_PATIENTS})),
                        ICU_PATIENTS_14_DAY_AVG: byRegion.map(m=>({DATE:m.DATE,VALUE:m.ICU_PATIENTS_14_DAY_AVG}))
                    }
                }
            };

            allFilesMap.set(`patients/${myRegion.replace(/ /g,'_')}`,json);
        }
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