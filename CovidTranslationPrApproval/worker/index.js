const {
    gitHubPrs,
    gitHubMergePr,
    gitHubGet
} = require('../../common/gitHub');

const labelFilter = 'Translated Content';

//Check to see if we need stats update PRs, make them if we do.
const doTranslationPrUpdate = async (masterbranch) => {
   //https://developer.github.com/v3/pulls/#list-pull-requests

   //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const Prs = (await gitHubPrs(masterbranch))
        .filter(p=>
            !p.draft //ignore drafts
            &&!p.labels.some(s=>p.name===labelFilter)); //require the 'Translated Content' label

    for (const pr of Prs) {
        
        const checks = await gitHubGet(`commits/${pr.head.ref}/check-runs`);
        const pass = checks.check_runs.every(x=>x.status==='completed'&&x.conclusion==='success');

        //compare docs...
        //https://docs.github.com/en/free-pro-team@latest/rest/reference/repos#compare-two-commits
        //example
        //https://api.github.com/repos/cagov/covid19/compare/master...avantpage_translation_symptoms-and-risks_98289254
        const compare = await gitHubGet(`compare/${masterbranch}...${pr.head.ref}`);

        //limit file access to a single folder with 'modified' status only.
        const fileaccessok = compare.files.every(x=>x.filename.startsWith('pages/translated-posts/') && x.status==='modified');

        if (pass && fileaccessok) {
            await gitHubMergePr(pr);
        } else {
            //If the oldest PR does not pass, halt processing.
            return;
        }
    }
}

module.exports = {
    doTranslationPrUpdate
}