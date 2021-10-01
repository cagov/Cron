//@ts-check
const GitHub = require('github-api'); //https://github-tools.github.io/github/docs/3.2.3/Repository.html
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/
const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

const AutoApproverLabels = require('./AutoApproverLabels.json').data;
const labelPublishASAP = AutoApproverLabels.specialLabels.PublishASAP;
const labelDoNotPublish = AutoApproverLabels.specialLabels.DoNotPublish;
const securityGroups = ['OWNER','CONTRIBUTOR','COLLABORATOR'];
const addToRollUptag = 'Add to Rollup';
const rollUptag = 'Rollup';

/**
 * @typedef {Object} PrRow
 * @property {string} html_url
 * @property {string} title
 * @property {number} number usually '100644'
 * @property {[{name:string}]} labels usually 'blob'
 * @property {boolean} draft
 * @property {string} author_association
 * @property {{ref:string}} base
 * @property {{ref:string}} head
 * @property {string} body
 * @returns 
 */

/**
 * @param {*} gitRepo 
 */
const getPrList = async gitRepo => {
    return /** @type PrRow[] */ ((await gitRepo.listPullRequests())
    .data)
    .filter(p=>
        !p.draft //ignore drafts
        &&securityGroups.includes(p.author_association) //Security
    );
}

/**
 * Check to see if we need stats update PRs, make them if we do.
 * @returns {Promise<{approvals: string[],skips: string[],labels: string[]}>}
 */
const doAutoApprover = async () => {
    let report = {
        approvals: [],
        skips: [],
        labels: []
    };

    //https://github-tools.github.io/github/docs/3.2.3/Repository.html#listPullRequests
    //https://developer.github.com/v3/pulls/#list-pull-requests

    //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    // @ts-ignore
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    // @ts-ignore
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);

    // @ts-ignore
    moment.tz.setDefault(dataTimeZone); //So important when using Moment.JS


    let PrList = await getPrList(gitRepo);
    //Look for rollups
    const PrRollUpList = PrList
    .filter(p=>
        p.labels.some(s=>s.name===addToRollUptag) //Only incude marked for rollup
    );
    for (const Pr of PrRollUpList) {
        //See if there is a target roll up already
        /** @type {{number:number,body:string,html_url:string}} */
        let existingRollupPr = PrList.find(x=>x.labels.some(s=>s.name===rollUptag));

        if(!existingRollupPr) {
            //create a branch for rollup
            const newBranchName = `${Pr.head.ref}-rollup-${new Date().valueOf()}`;
            const newHead = await gitRepo.createBranch(Pr.head.ref,newBranchName);

            /** @type {{html_url:string;number:number,body:string,head:{ref:string}}} */
            const newPr = (await gitRepo.createPullRequest({
                title: Pr.title + ' Rollup',
                head: newBranchName,
                base: Pr.base.ref,
                body: '*This PR is a Rollup of multiple PRs...*\n\n'
            }))
            .data;

            existingRollupPr = newPr;
        }

        let labels = Pr.labels
            .map(x=>x.name)//Preserve existing labels!!!
            .filter(x=>x!==addToRollUptag && x!==rollUptag);
        labels.push(rollUptag);
        
        await gitIssues.editIssue(existingRollupPr.number,{
            labels,
            body: existingRollupPr.body + '\n\n' + Pr.title + ' - ' + Pr.html_url
        });

        //Close the old issue
        await gitIssues.editIssue(Pr.number,{
            state: 'closed',
            body: Pr.body + '\n\nRolled into ' + existingRollupPr.html_url
        });

    }


    const ActiveLabels = AutoApproverLabels.timeLabels
        .map(x=>({label:x.label,diff:moment()
            .diff(moment().startOf('day')
            .add(x.hour, 'hours')
            .add(x.minute, 'minutes'),'minutes')}))
            .filter(x=>x.diff>0 && x.diff<15);


    //refresh for tag fixing
    PrList = await getPrList(gitRepo);

    for (const ActiveLabel of ActiveLabels) {
        //Mark any Prs with the time publish label as publish asap
        const PrsTimeReady = PrList
            .filter(p=>
                p.labels.some(s=>s.name===ActiveLabel.label)
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
                report.labels.push(Pr.html_url);
            }
        }

        await sleep(5000); //let label application apply
    }

    //refresh for approval
    PrList = (await getPrList(gitRepo))
        .filter(p=>
            p.labels.some(s=>s.name===labelPublishASAP) //Only incude marked for publishing
            &&!p.labels.some(s=>s.name===labelDoNotPublish) //Hard exclude DoNots (Stop button)
        );

    for (const prlist of PrList) {
        //get the full pr detail
        const pr = (await gitRepo.getPullRequest(`${prlist.number}?cachebust=${new Date().valueOf()}`)).data;
        if (pr.mergeable) {
            //Approve the PR
            await gitRepo.mergePullRequest(pr.number,{
                merge_method: 'squash'
            });

            await gitRepo.deleteRef(`heads/${pr.head.ref}`);

            report.approvals.push(pr.html_url);

            await sleep(30000); //Wait after any approval so the next Pr can update
        } else {
            report.skips.push(pr.html_url); //report PR not mergeable
        }
    }

    return report;
};

module.exports = {
  doAutoApprover
};