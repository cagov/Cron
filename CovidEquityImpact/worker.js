const { getData_equity_impact: getData_equity_impact } = require('./equity-impact');
const { validateJSON } = require('../common/schemaTester');
const { GitHubTreePush } = require('@cagov/github-tree-push');

const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString('en-CA', {timeZone: 'America/Los_Angeles', ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});

const schemaFileName = '../SQL/CDT_COVID/EquityImpact/schema/schema.json';
const schemaTestGoodFilePath = '../SQL/CDT_COVID/EquityImpact/schema/tests/pass/';
const schemaTestBadFilePath = '../SQL/CDT_COVID/EquityImpact/schema/tests/fail/';

const PrLabels = ['Automatic Deployment', 'Add to Rollup', 'Publish at 9:15 a.m. ☀'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
const githubPath = 'data/reviewed/equitydash';
const fileName = 'disparity-california.json';
const stagingBranch = 'CovidEquityImpact_Staging';
const targetBranch = 'main';

const doCovidEquityImpact = async () => {
    const gitToken = process.env['GITHUB_TOKEN'];
    const prTitle = `${todayDateString()} Equity Community Impact Data Update`;

    // Fetch and validate data
    const jsonData = await getData_equity_impact();

    console.log(JSON.stringify(jsonData, null, 2));

    validateJSON(`Equity data failed validation`, jsonData, schemaFileName, schemaTestGoodFilePath, schemaTestBadFilePath);

    // Push to staging
    const stagingTree = new GitHubTreePush(gitToken, {
        owner: githubOwner,
        repo: githubRepo,
        path: githubPath,
        base: stagingBranch,
        removeOtherFiles: false,
        commit_message: prTitle,
        pull_request: false
    });

    stagingTree.syncFile(fileName, jsonData);
    await stagingTree.treePush();

    // Push to main
    const mainTree = new GitHubTreePush(gitToken, {
        owner: githubOwner,
        repo: githubRepo,
        path: githubPath,
        base: targetBranch,
        removeOtherFiles: false,
        commit_message: prTitle,
        pull_request: true,
        pull_request_options: {
            title: prTitle,
            issue_options: {
                labels: PrLabels
            }
        }
    });

    mainTree.syncFile(fileName, jsonData);
    const mainResult = await mainTree.treePush();
    return mainResult;
};

module.exports = {
	doCovidEquityImpact 
};
