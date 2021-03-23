const { queryDataset,getSQL } = require('../common/snowflakeQuery');
const GitHub = require('github-api');
const PrLabels = ['Automatic Deployment'];
const githubUser = 'cagov';
const githubRepo = 'covid19';
// const puppeteer = require("puppeteer");
const axios = require("axios")
const cheerio = require("cheerio")
const fetch = require('node-fetch');

const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};
const masterBranch = 'master';
const homePageToCheck = 'https://covid19.ca.gov/';
const srcJSONFile = 'https://files.covid19.ca.gov/data/daily-stats-v2.json';
const mySelector = 'div#total-vaccines-number strong';
const build_json_path = 'pages/_data/auto-builder.json';

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');
const testing_mode = true;

/**
 * Pull a URL, parse the content and return it.
 * @param {string} url 
 * @returns Parsed data.
 */
async function fetchHTML(url) {
    const { data } = await axios.get(url);
    return cheerio.load(data);
}

/**
 * Loop through the filedata and put all the changes in one PR
 * @param {Array<{path:string,json:{data:{}}}>} fileData 
 * @param {*} gitRepo 
 * @param {string} prTitle 
 * @returns The PR created if changes were made
 */
 const processFilesForPr = async (fileData, gitRepo, prTitle) => {
    let Pr = null;
    console.log("File Data",fileData);
    for(let dataOutput of fileData) {
        Pr = await createPrForChange(gitRepo,Pr,dataOutput.path,dataOutput.json,prTitle);
    }

    return Pr;
};

/**
 * If changes are detected, create and return a PR, or reuse a PR
 * @param {*} gitRepo 
 * @param {{head:{ref:string}}} [Pr] The PR from previous runs
 * @param {string} path path of the file to update
 * @param {{data:{}}} json data to send
 * @param {string} prTitle title for PR if created
 * @returns {Promise<{html_url:string}>} The PR created if a change was made
 */
 const createPrForChange = async (gitRepo, Pr, path, json, prTitle) => {
    const branchName = Pr ? Pr.head.ref : `auto-${prTitle.replace(/ /g,'-')}-${todayDateString()}-${todayTimeString()}`;
    const targetcontent = (await gitRepo.getContents(Pr ? Pr.head.ref : masterBranch,path,true)).data;
    // console.log("Creating PRForChange",path,json);
    //Add publishedDate
    if(!json.meta) {
        json.meta = {};
    }
    json.meta.PUBLISHED_DATE = todayDateString();
    json.meta.PUBLISHED_TIME = todayTimeString();

    if(JSON.stringify(json)===JSON.stringify(targetcontent)) {
        console.log('data matched - no need to update');
    } else {
        console.log('data changed - updating');

        if(!Pr) {
            await gitRepo.createBranch(masterBranch,branchName);
        }
        const commitMessage = `Update ${path.split("/").pop()}`;
        await gitRepo.writeFile(branchName, path, JSON.stringify(json,null,2), commitMessage, {committer,encode:true});

        if(!Pr) {
            //Create PR
            Pr = (await gitRepo.createPullRequest({
                title: prTitle,
                head: branchName,
                base: masterBranch
            }))
            .data;
        }
    }

    return Pr;
};

/**
 * Squash a PR and delete the branch
 * @param {*} gitRepo 
 * @param {{number:number,head:{ref:string}}} Pr 
 */
 const PrApprove = async (gitRepo, Pr) => {
    //Approve the PR
    await gitRepo.mergePullRequest(Pr.number,{
        merge_method: 'squash'
    });
    //Delete PR branch
    await gitRepo.deleteRef(`heads/${Pr.head.ref}`);
};

const get_auto_build_JSON = async() => {

    const json = {
        meta: {
            PUBLISHED_DATE: "1900-01-01",
            PUBLISHED_TIME: "00:00:00"
          },
        data: {
            comment: "Generated for CronAutoBuilder for build triggering"
        }
    };
    // !! validate JSON ??
    return {path:build_json_path, json:json};
};

const force_build = async() => {
    // Instigate a build by updating a file
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const gitIssues = await gitModule.getIssues(githubUser,githubRepo);
    const prTitle = `${todayDateString()} Auto Builder`;

    // !! skip if a build is already underway within the last 10 minutes

    const datasets = [
        await get_auto_build_JSON()
    ];

    const Pr = await processFilesForPr(datasets,gitRepo,prTitle);
    if(Pr) {
        //Label the Pr
        await gitIssues.editIssue(Pr.number,{
            labels: PrLabels
        });
        await PrApprove(gitRepo,Pr);
    } else {
        throw "Unable to get a PR";
    }
};

const doCovidAutoBuilder = async () => {
    let needsBuild = false;

    console.log("Looking at home page");
    const site = await fetchHTML(homePageToCheck);
    let value = site(mySelector).text();

    const shownDoses = parseInt(value.split(',').join(''));
    console.log("Shown Doses", shownDoses);
    if (shownDoses > 0) {
        console.log("beginning fetch");
        await fetch(srcJSONFile,{method:"Get"})
        .then(res => res.json())
        .then(json => {
            const jsonDoses = json.data.vaccinations.CUMMULATIVE_DAILY_DOSES_ADMINISTERED;
            console.log("JSON doses",jsonDoses);
            if (jsonDoses == shownDoses) {
                console.log("Values match, no building needed");
                needsBuild = testing_mode? true : false;
            }
            else {
                if (jsonDoses < shownDoses) {
                    throw "JSON Doses is lower than what is on website!";
                }
                console.log("Values do not match, build may be needed");
                needsBuild = true;
            }
        });
        console.log("Checking needs build",needsBuild);
        if (needsBuild) {
            console.log("Will force a github build here")
            await force_build();
        }
    } else {
        console.log("VaccinesAdmin is 0, likely a parsing issue, report it");
        throw "Failed to parse Vaccines from home page!";
    }
    return needsBuild;
};

module.exports = {
    doCovidAutoBuilder
};