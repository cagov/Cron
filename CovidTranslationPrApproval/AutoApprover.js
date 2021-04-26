const GitHub = require('github-api'); //https://github-tools.github.io/github/docs/3.2.3/Repository.html
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const masterbranch = 'main';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/
const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

const AutoApproverLabels = require('./AutoApproverLabels.json').data;

//Check to see if we need stats update PRs, make them if we do.
const doAutoApprover = async () => {
    //https://github-tools.github.io/github/docs/3.2.3/Repository.html#listPullRequests
    //https://developer.github.com/v3/pulls/#list-pull-requests

    //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    
    let thisTime = moment().tz(dataTimeZone);
    let thisHour = thisTime.hour();
    let thisMinute = Math.floor(thisTime.minute() / 5) * 5; //Round down to 5 mins
    let ActiveLabel = AutoApproverLabels.timeLabels.find(x=>x.hour===thisHour && x.minute===thisMinute)?.label;

    const Prs = (await gitRepo.listPullRequests(
        {
            base : masterbranch,
            direction : 'desc' //Newest ones first
        }
        ))
        .data
        .filter(p=>
            !p.draft //ignore drafts
            &&p.labels.some(s=>s.name===ActiveLabel || s.name===AutoApproverLabels.specialLabels.PublishASAP)
            &&!p.labels.some(s=>s.name===AutoApproverLabels.specialLabels.DoNotPublish)
        );
    for (const prlist of Prs) {
        //get the full pr detail
        const pr = (await gitRepo.getPullRequest(prlist.number)).data;
        if (pr.mergeable) {
            //Grab all the checks running on this PR
            const checks = (await gitRepo._request('GET',`/repos/${gitRepo.__fullname}/commits/${pr.head.sha}/check-runs`)).data;
            const pass = checks.check_runs.every(x=>x && x.status==='completed' && x.conclusion==='success');

            if (pass) {
                //Approve the PR
                await gitRepo.mergePullRequest(pr.number,{
                    merge_method: 'squash'
                });

                await gitRepo.deleteRef(`heads/${pr.head.ref}`);
                await sleep(5000); //Wait after any approval so the next Pr can update
            }
        }
    }
};

module.exports = {
  doAutoApprover
};