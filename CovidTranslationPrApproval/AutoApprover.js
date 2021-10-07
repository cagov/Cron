const GitHub = require('github-api'); //https://github-tools.github.io/github/docs/3.2.3/Repository.html
const githubUser = 'cagov';
const githubRepo = 'covid-static-data';
const committer = {
    name: process.env["GITHUB_NAME"],
    email: process.env["GITHUB_EMAIL"]
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/
const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

const AutoApproverLabels = require('./AutoApproverLabels.json').data;
const labelPublishASAP = AutoApproverLabels.specialLabels.PublishASAP;
const labelDoNotPublish = AutoApproverLabels.specialLabels.DoNotPublish;
const securityGroups = ['OWNER', 'CONTRIBUTOR', 'COLLABORATOR'];
const addToRollUptag = 'Add to Rollup';
const rollUptag = 'Rollup';

/**
 * @typedef {object} PrRow
 * @property {string} html_url PR html link
 * @property {string} title PR title
 * @property {number} number PR number
 * @property {{name:string}[]} labels list of PR labels
 * @property {boolean} draft true for draft PR
 * @property {string} author_association security groups
 * @property {{ref:string}} base PR branch base
 * @property {{ref:string,sha:string}} head PR branch head
 * @property {string} body PR issue body
 * @property {string} merge_commit_sha PR Merge Commit SHA
 * @returns 
 */

/**
 * @param {*} gitRepo from Github API
 */
const getPrList = async gitRepo => {
    /** @type {PrRow[]} */
    const purePrs = (await gitRepo.listPullRequests()).data;

    return purePrs
        .filter(p =>
            !p.draft //ignore drafts
            && securityGroups.includes(p.author_association) //Security
        );
};

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
    const gitRepo = await gitModule.getRepo(githubUser, githubRepo);
    // @ts-ignore
    const gitIssues = await gitModule.getIssues(githubUser, githubRepo);

    moment.tz.setDefault(dataTimeZone); //So important when using Moment.JS


    let PrList = await getPrList(gitRepo);
    //Look for rollups
    const PrRollUpList = PrList
        .filter(p =>
            p.labels.some(s => s.name === addToRollUptag) //Only incude marked for rollup
        );
    for (const Pr of PrRollUpList) {
        const mainTargetBranch = Pr.base.ref;

        //See if there is a target roll up already
        /** @type {PrRow} */
        let existingRollupPr = PrList.find(x => x.base.ref === mainTargetBranch && x.labels.some(s => s.name === rollUptag));
        const MakeNewPr = !existingRollupPr;
        const RollupPrTitle = `${moment().format('YYYY-MM-DD')}-Rollup`;
        let rollupBranchName = `${RollupPrTitle}-${new Date().valueOf()}`;
        let rollupBranchSha = '';
        if (MakeNewPr) {
            //create a branch for rollup
            /** @type {{data:{object:{sha:string}}}} */
            const newBranch = await gitRepo.createBranch(mainTargetBranch, rollupBranchName);
            rollupBranchSha = newBranch.data.object.sha;
        } else {
            rollupBranchName = existingRollupPr.head.ref;
            rollupBranchSha = existingRollupPr.head.sha;
        }

        //Compare the proposed commit with the rollup PR branch
        /** @type {{data:{files:{filename:string,sha:string}[]}}} */
        const compare = await gitRepo.compareBranches(rollupBranchSha, Pr.head.sha);
        if (compare.data.files.length) {
            console.log(`${compare.data.files.length} changes.`);

            const updateTree = compare.data.files.map(x => ({
                path: x.filename,
                mode: '100644',
                type: 'blob',
                sha: x.sha
            }));

            /** @type {{data:{sha:string}}} */
            const createTreeResult = await gitRepo.createTree(updateTree, rollupBranchSha);
            const treeSha = createTreeResult.data.sha;
            //Create a commit the maps to all the tree changes
            /** @type {{data:{sha:string,html_url:string}}} */
            const commitResult = await gitRepo.commit(rollupBranchSha, treeSha, `Rollup > ${Pr.title}`, committer);
            const commitSha = commitResult.data.sha;


            await gitRepo.updateHead(`heads/${rollupBranchName}`, commitSha);
        }

        if(MakeNewPr) {
            /** @type {PrRow} */
            existingRollupPr = (await gitRepo.createPullRequest({
                title: RollupPrTitle,
                head: rollupBranchName,
                base: mainTargetBranch,
                body: '**This PR is a Rollup of multiple PRs**\n\n'
            }))
                .data;
        }


        //merge labels
        let labels = [...Pr.labels.map(x => x.name), ...existingRollupPr.labels.map(x => x.name)]
            //Preserve original labels from first Pr
            .filter(x => x !== addToRollUptag && x !== rollUptag);

        labels.push(rollUptag);

        await gitIssues.editIssue(existingRollupPr.number, {
            labels: [...new Set(labels)] //removes dupes
        });

        //Add the old Pr link to the body of the rollup issue
        await gitIssues.editIssue(existingRollupPr.number, {
            body: `${existingRollupPr.body || ''}- ${Pr.html_url}\n`
        });

        //Close the old issue
        await gitIssues.editIssue(Pr.number, {
            state: 'closed',
            body: `${Pr.body || ''}\n\n**This PR was rolled into the following PR**\n\n-${existingRollupPr.html_url}`
        });

        //Delete the old PR branch
        await gitRepo.deleteRef(`heads/${Pr.head.ref}`);

        //Created wait and refresh
        await sleep(5000);
        PrList = await getPrList(gitRepo);
    }


    const ActiveLabels = AutoApproverLabels.timeLabels
        .map(x => ({
            label: x.label, diff: moment()
                .diff(moment().startOf('day')
                    .add(x.hour, 'hours')
                    .add(x.minute, 'minutes'), 'minutes')
        }))
        .filter(x => x.diff > 0 && x.diff < 15);

    for (const ActiveLabel of ActiveLabels) {
        //Mark any Prs with the time publish label as publish asap
        const PrsTimeReady = PrList
            .filter(p =>
                p.labels.some(s => s.name === ActiveLabel.label)
            );

        //Time is up.  Mark it for publishing (in case we miss it this pass)
        for (const Pr of PrsTimeReady) {
            //Add label to Pr
            let labels = Pr.labels.map(x => x.name); //Preserve existing labels!!!
            if (!labels.includes(labelPublishASAP)) {
                labels.push(labelPublishASAP);
                await gitIssues.editIssue(Pr.number, {
                    labels
                });
                report.labels.push(Pr.html_url);
            }
        }

        await sleep(5000); //let label application apply
    }

    //refresh for approval
    PrList = (await getPrList(gitRepo))
        .filter(p =>
            p.labels.some(s => s.name === labelPublishASAP) //Only incude marked for publishing
            && !p.labels.some(s => s.name === labelDoNotPublish) //Hard exclude DoNots (Stop button)
        );
    for (const prlist of PrList) {
        //get the full pr detail
        const pr = (await gitRepo.getPullRequest(`${prlist.number}?cachebust=${new Date().valueOf()}`)).data;
        if (pr.mergeable) {
            //Approve the PR
            await gitRepo.mergePullRequest(pr.number, {
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