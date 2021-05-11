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
const sqlRootPath = "../SQL/CDTCDPH_VACCINE/CovidVaccineEquity/";
const schemaPath = `${sqlRootPath}schema/`;
const targetPath = 'data/vaccine-equity/';

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const doCovidVaccineEquity = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const branchPrefix = 'data-';
    const BranchName = `${branchPrefix}${todayDateString()}-${todayTimeString()}-vaccineequity`;
    const CommitText = 'Update Vaccine Equity Data';
    const PrTitle = `${todayDateString()} Vaccine Equity`;

    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath,'schema/[file]/input/schema.json','schema/[file]/input/sample.json');
    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork,process.env["SNOWFLAKE_CDTCDPH_VACCINE"]);

    Object.keys(sqlWorkAndSchemas.schema).forEach(file => {
        const schemaObject = sqlWorkAndSchemas.schema[file];
        const targetJSON = allData[file];
        validateJSON2(`${file} - failed SQL input validation`, targetJSON,schemaObject.schema,schemaObject.passTests,schemaObject.failTests);
    });

    const newTree = [];

    const getTreeValue = (path,value) => {
        return {
             mode : '100644', //code for tree blob
             type : 'blob',
             path,
             content : JSON.stringify(value,null,2)
        };
    };

    /**
     * @param {{CATEGORY: string,REGION: string,LATEST_ADMIN_DATE: string, METRIC_VALUE: number}[]} dataset
     * @param {string} schemaName
     * @param {string} path_prefix
     * @param {{mode :string, type :string, path:string,content : string}[]} tree
     */
    const customAddDatsetToTree = (dataset, schemaName, path_prefix, tree) => {
        const regions = dataset
            .map(x=>x.REGION)
            .filter((value, index, self) => 
                self.indexOf(value) === index);
            
        regions.forEach(r =>
            {
                const rows = dataset.filter(d=>d.REGION===r);
                const REGION = r.replace(/ County/,'');
                const LATEST_ADMIN_DATE = rows.length ? rows[0].LATEST_ADMIN_DATE : null;

                const path = `${path_prefix+REGION.toLowerCase().replace(/ /g,'')}.json`;
                const data = rows.map(x=>({
                    CATEGORY:x.CATEGORY,
                    METRIC_VALUE:x.METRIC_VALUE
                }));
                const result = {
                    meta: {
                        REGION,
                        LATEST_ADMIN_DATE,
                        PUBLISHED_DATE:todayDateString()
                    },
                    data
                };

                validateJSON(`${schemaName} failed SQL output validation`,
                    result,
                    `${schemaPath}${schemaName}/output/schema.json`,
                    `${schemaPath}${schemaName}/output/sample.json`);

                tree.push(getTreeValue(`${targetPath}${path}`,result));
            }
            );
    };

    customAddDatsetToTree(allData.vaccines_by_age,"vaccines_by_age",`age/vaccines_by_age_`,newTree);
    customAddDatsetToTree(allData.vaccines_by_gender,"vaccines_by_gender",`gender/vaccines_by_gender_`,newTree);
    customAddDatsetToTree(allData.vaccines_by_race_eth,"vaccines_by_race_eth",`race-ethnicity/vaccines_by_race_ethnicity_`,newTree);

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

    //Create a PR from a new branch if changes exist
    if(await branchIfChanged(newTree,BranchName,CommitText)) {
        const Pr = (await gitRepo.createPullRequest({
            title: PrTitle,
            head: BranchName,
            base: masterBranch
        }))
        .data;

        //Label the Pr
         await gitIssues.editIssue(Pr.number,{
             labels: PrLabels
         });

        await sleep(5000); //let the PR check actions before merging
        //Approve Pr
        await gitRepo.mergePullRequest(Pr.number,{
            merge_method: 'squash'
        });

        //Delete Branch
        await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
        return Pr;
    }

    return null;
};

module.exports = {
    doCovidVaccineEquity
};
