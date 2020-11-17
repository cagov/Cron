const {
    gitHubPrs,
    gitHubMergePr,
    gitHubGet
} = require('../../CovidStateDashboard/gitHub');

const labelFilter = 'Translated Content';

//Check to see if we need stats update PRs, make them if we do.
const doTranslationPrUpdate = async (masterbranch) => {
   //https://developer.github.com/v3/pulls/#list-pull-requests

   //https://api.github.com/repos/cagov/covid19/pulls?base=master

    const Prs = (await gitHubPrs(masterbranch))
        .filter(x=>!x.labels
            .some(s=>x.name===labelFilter));

    for (const pr of Prs) {
        
        const checks = await gitHubGet(`commits/${pr.head.ref}/check-runs`);
        const pass = checks.check_runs.every(x=>x.status==='completed'&&x.conclusion==='success');
        if(pass) {
            await gitHubMergePr(pr);
        }

//pr.head.ref
    }
  
        

    //check here...
    //https://dev.to/gr2m/github-api-how-to-retrieve-the-combined-pull-request-status-from-commit-statuses-check-runs-and-github-action-results-2cen
//https://developer.github.com/v3/checks/runs/#list-check-runs-for-a-git-reference


//grab the check run for each ref...
//https://api.github.com/repos/cagov/covid19/commits/avantpage_translation_industry-guidance_98302781/check-runs?status=completed

const x =1;
}

module.exports = {
    doTranslationPrUpdate
}