const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const GitHub = require('github-api');
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'master';
const SnowFlakeSqlPath = 'CDTCDPH_VACCINE/';


//Check to see if we need stats update PRs, make them if we do.
const doCovidVaccineEquity = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);

    const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: 'numeric', day: 'numeric', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
    const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');

    const BranchName = 'carter-test-vaccine-eq';
    const CommitText = 'Commit carter-test-vaccine-eq';

    const DbSqlWork = {
        vaccines_by_age : getSQL(`${SnowFlakeSqlPath}vaccines_by_age`),
        vaccines_by_gender : getSQL(`${SnowFlakeSqlPath}vaccines_by_gender`),
        vaccines_by_race_eth: getSQL(`${SnowFlakeSqlPath}vaccines_by_race_eth`)
    };

    const allData = await queryDataset(DbSqlWork,process.env["SNOWFLAKE_CDTCDPH_VACCINE"]);
    const newTree = [];

    const getTreeValue = (path,value) => {
        return {
             mode : '100644', //code for tree blob
             type : 'blob',
             path,
             content : JSON.stringify(value,null,2)
        };
    };

    const customAddDatsetToTree = (dataset, path_prefix, tree) => {
        const regions = dataset
            .map(x=>x.REGION)
            .filter((value, index, self) => 
                self.indexOf(value) === index);
            
        regions.forEach(r =>
            {
                const rows = dataset.filter(d=>d.REGION===r);
                const REGION = (r==='_CALIFORNIA'?"california":r);
                const LATEST_ADMIN_DATE = "02-09-2021";

                const path = `${path_prefix+r.toLowerCase()}.json`;
                const data = rows.map(x=>({
                    CATEGORY:x.CATEGORY,
                    METRIC_VALUE:x.METRIC_VALUE
                }));
                const result = {
                    meta: {
                        REGION,
                        LATEST_ADMIN_DATE
                    },
                    data
                };

                tree.push(getTreeValue(path,result));
            }
            );
    };

    customAddDatsetToTree(allData.vaccines_by_age,'age/vaccines_by_age_',newTree);
    customAddDatsetToTree(allData.vaccines_by_gender,'gender/vaccines_by_gender_',newTree);
    customAddDatsetToTree(allData.vaccines_by_race_eth,'race-ethnicity/vaccines_by_race_ethnicity_',newTree);

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
    const branchMade = await branchIfChanged(newTree,BranchName,CommitText);
    if(branchMade) {
        const Pr = (await gitRepo.createPullRequest({
            title: CommitText,
            head: BranchName,
            base: masterBranch
        }))
        .data;

        //Label the Pr
       // await gitIssues.editIssue(Pr.number,{
       //     labels: PrLabels
       // });

        //Approve Pr
       // await gitRepo.mergePullRequest(Pr.number,{
       //     merge_method: 'squash'
       // });

        //Delete Branch
       // await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
       return Pr;
    }


    return null;
};

module.exports = {
    doCovidVaccineEquity
};
