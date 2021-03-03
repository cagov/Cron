const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const { validateJSON } = require('../common/schemaTester');
const GitHub = require('github-api');
const githubUser = 'cagov';
const githubRepo = 'covid-static';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'master';
const SnowFlakeSqlPath = 'CDTCDPH_VACCINE/vaccine_hpi/';
const targetPath = 'data/vaccine-hpi/';
const targetFileName = 'vaccine-hpi.json';
const schemaPath = `../SQL/${SnowFlakeSqlPath}schema/`;

const doCovidVaccineHPI = async () => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);

    const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: '2-digit', day: '2-digit', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
    const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');

    const branchPrefix = 'data-vaccine-hpi-';
    const commitMessage = 'Update Vaccine HPI Data';
    const PrTitle = `${todayDateString} Vaccine HPI`;
    let branch = masterBranch;

    const prs = await gitRepo.listPullRequests({
        base:masterBranch
    });
    let Pr = prs.data.filter(x=>x.title===PrTitle)[0];

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
                title: PrTitle,
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
    const sqlResults = await queryDataset(
        {
            data: getSQL(`${SnowFlakeSqlPath}vaccine_hpi`)
        }
        ,process.env["SNOWFLAKE_CDTCDPH_VACCINE"]
    );

    validateJSON('vaccine-hpi.json failed validation', sqlResults.data,`${schemaPath}input/schema.json`,`${schemaPath}input/pass/`);

    let maxDate = new Date("1900-01-01");
    sqlResults.data.forEach(r=>{
        if(maxDate<r.LATEST_ADMIN_DATE) {
            maxDate = r.LATEST_ADMIN_DATE;
        }

        delete r.LATEST_ADMIN_DATE;
    });

    const mappedResults = { 
        meta : {
            date : maxDate
        },
        data: sqlResults.data
    };

    validateJSON('vaccine-hpi.json failed validation', mappedResults,`${schemaPath}output/schema.json`,`${schemaPath}output/pass/`);

    return mappedResults;
};

module.exports = {
    doCovidVaccineHPI
};
