const GitHub = require('github-api'); //https://github-tools.github.io/github/docs/3.2.3/Repository.html
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const masterbranch = 'main';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/
const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

const AutoApproverLabels = require('./AutoApproverLabels.json').data;
const labelPublishASAP = AutoApproverLabels.specialLabels.PublishASAP;
const labelDoNotPublish = AutoApproverLabels.specialLabels.DoNotPublish;
const securityGroups = ['OWNER','CONTRIBUTOR','COLLABORATOR'];

//Check to see if we need stats update PRs, make them if we do.
const doAutoApprover = async () => {
    //https://github-tools.github.io/github/docs/3.2.3/Repository.html#listPullRequests
    //https://developer.github.com/v3/pulls/#list-pull-requests

    //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);
    
    moment.tz.setDefault(dataTimeZone); //So important when using Moment.JS

    let ActiveLabel = AutoApproverLabels.timeLabels
        .map(x=>({label:x.label,diff:moment()
            .diff(moment().startOf('day')
            .add(x.hour, 'hours')
            .add(x.minute, 'minutes'),'minutes')}))
        .find(x=>x.diff>0 && x.diff<15)
        ?.label;

    if(ActiveLabel) {
        //Mark any Prs with the time publish label as publish asap
        const PrsTimeReady = (await gitRepo.listPullRequests(
            {
                base : masterbranch
            }
            ))
            .data
            .filter(p=>
                !p.draft //ignore drafts
                &&securityGroups.includes(p.author_association) //Security
                &&p.labels.some(s=>s.name===ActiveLabel)
            );

        //Time is up.  Mark it for publishing (in case we miss it this pass)
        for (const Pr of PrsTimeReady) {
            //Add label to Pr
            let labels = Pr.labels.map(x=>x.name); //Preserve existing labels!!!
            if (!labels.includes(labelPublishASAP)) {
                labels.push(labelPublishASAP);
                await gitIssues.editIssue(Pr.number,{
                    labels
                });
                await sleep(5000); //let the label apply
            }
        }
    }

    const Prs = (await gitRepo.listPullRequests(
        {
            base : masterbranch,
            direction : 'desc' //Newest ones first
        }
        ))
        .data
        .filter(p=>
            !p.draft //ignore drafts
            &&securityGroups.includes(p.author_association)
            &&p.labels.some(s=>s.name===labelPublishASAP) //Only incude marked for publishing
            &&!p.labels.some(s=>s.name===labelDoNotPublish) //Hard exclude DoNots (Stop button)
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

                //This is where some notification should happen

                await sleep(10000); //Wait after any approval so the next Pr can update
            }
        }
    }
};

module.exports = {
  doAutoApprover
};