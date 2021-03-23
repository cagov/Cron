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

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
// const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
// const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');

async function fetchHTML(url) {
    const { data } = await axios.get(url);
    return cheerio.load(data);
}

const doCovidAutoBuilder = async () => {
    // const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    // const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    // const gitIssues = await gitModule.getIssues(githubUser,githubRepo);
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
            }
            else {
                if (jsonDoses < shownDoses) {
                    throw "JSON Doses is lower than what is on website!";
                }
                console.log("Values do not match, build may be needed");
                needsBuild = true;
                // !! skip if a build is already underway...
                // !! instigate a build
                // !! insure we don't retrigger for 10-15 minutes...
            }
        });
    } else {
        console.log("VaccinesAdmin is 0, likely a parsing issue, report it");
        throw "Failed to parse Vaccines from home page!";
    }
    // If we successfully got one, pull the JSON file and pull that number.
    console.log("Returning",needsBuild);
    return needsBuild;
};

module.exports = {
    doCovidAutoBuilder
};