const GitHub = require('github-api'); //https://github-tools.github.io/github/docs/3.2.3/Repository.html
const githubUser = 'cagov';
const githubRepo = 'covid19';
const labelFilter = 'Translated Content';
const nonPrintableCharsRx = /\p{C}/gu;

//Check to see if we need stats update PRs, make them if we do.
const doTranslationPrUpdate = async masterbranch => {
    //https://github-tools.github.io/github/docs/3.2.3/Repository.html#listPullRequests
    //https://developer.github.com/v3/pulls/#list-pull-requests

    //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    
    const Prs = (await gitRepo.listPullRequests(
        {
            base : masterbranch,
            direction : 'desc' //Newest ones first
        }
        ))
        .data
        .filter(p=>
            !p.draft //ignore drafts
            &&p.labels.some(s=>s.name===labelFilter) //require the 'Translated Content' label
        );
    for (const prlist of Prs) {
        //get the full pr detail
        const pr = (await gitRepo.getPullRequest(prlist.number)).data;
        if (pr.mergeable) {
            //Grab all the checks running on this PR
            const checks = (await gitRepo._request('GET',`/repos/${gitRepo.__fullname}/commits/${pr.head.sha}/check-runs`)).data;
            const pass = checks.check_runs.every(x=>x && x.status==='completed' && x.conclusion==='success');

            //compare docs...
            //https://docs.github.com/en/free-pro-team@latest/rest/reference/repos#compare-two-commits
            //example
            //https://api.github.com/repos/cagov/covid19/compare/master...avantpage_translation_symptoms-and-risks_98289254
            const compare = (await gitRepo.compareBranches(masterbranch,pr.head.sha)).data;

            //limit file access to a single folder with 'modified' status only.
            const fileaccessok = compare.files.every(x=>x.filename.startsWith('pages/translated-posts/'));

            //Do not allow non-printable characters.  New Lines and Arabic number shifts are ok + 8294+8297+65279.
            const onlyGoodChars = compare.files.every(x=>!nonPrintableCharsRx.test(x.patch.replace(/[\n\u200E\u2066\u2069\uFEFF]/gu,'')));

            if (pass && fileaccessok && onlyGoodChars) {
                //Approve the PR
                await gitRepo.mergePullRequest(pr.number,{
                    merge_method: 'squash'
                });

                await gitRepo.deleteRef(`heads/${pr.head.ref}`);
            }
        }
    }
};

module.exports = {
    doTranslationPrUpdate
};