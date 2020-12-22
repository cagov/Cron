const { queryDataset } = require('../../common/snowflakeQuery');
const statsFileName = 'tableauCovidMetrics.json';

const GitHub = require('github-api');
const githubUser = 'cagov';
const githubRepo = 'covid19';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};

const gitHubMessage = (action, file) => `${action} - ${file}`;
const PrLabels = ['Automatic Deployment'];

//Check to see if we need stats update PRs, make them if we do.
const doDailyStatsPr = async mergetargets => {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    const sql = `SELECT TOP 1 * from COVID.PRODUCTION.VW_TABLEAU_COVID_METRICS_STATEWIDE ORDER BY DATE DESC`;
    let sqlResults = null;
    let masterPr = null;
    const todayDateString = new Date().toLocaleString("en-US", {year: 'numeric', month: 'numeric', day: 'numeric', timeZone: "America/Los_Angeles"}).replace(/\//g,'-');
    const todayTimeString = new Date().toLocaleString("en-US", {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: "America/Los_Angeles"}).replace(/:/g,'-');

    for(const mergetarget of mergetargets) {
        const isMaster = mergetarget === mergetargets[0];
        const title = `${todayDateString} Stats Update${isMaster ? `` : ` (${mergetarget})`}`;
        let branch = `auto-stats-update-${mergetarget}-${todayDateString}-${todayTimeString}`;

        const prs = await gitRepo.listPullRequests({
            base:mergetarget
        });
        let Pr = prs.data.filter(x=>x.title===title)[0];

        if(Pr) { //reuse the PR if it is still open
            branch = Pr.head.ref;
        } else {
            await gitRepo.createBranch(mergetarget,branch);        
        }

        sqlResults = sqlResults || (await queryDataset(sql))[0][0]; //only run the query if needed

        const content = Buffer.from(JSON.stringify(sqlResults,null,2)).toString('base64');
        const targetfile = (await gitRepo.getContents(branch,`pages/_data/${statsFileName}`,false)).data; //reload the meta so we update the latest

        const targetcontent = targetfile.content.replace(/\n/g,'');
        if(content===targetcontent) {
            console.log('data matched - no need to update');
        } else {
            await gitRepo.writeFile(branch, targetfile.path, content, gitHubMessage(`${todayDateString} Update`,statsFileName), {committer,encode:false});

            if(!Pr) {
                Pr = (await gitRepo.createPullRequest({
                        title,
                        head: branch,
                        base: mergetarget
                    }))
                    .data;
                    
                await gitIssues.editIssue(Pr.number,{
                    labels: PrLabels
                });
            }
        }

        //Approve the PR
        if(Pr) {
            await gitRepo.mergePullRequest(Pr.number,{
               merge_method: 'squash'
            });

            await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
        }

        if(isMaster) {
            masterPr = Pr;
        }
    }
    return masterPr;
};

module.exports = {
  doDailyStatsPr
};