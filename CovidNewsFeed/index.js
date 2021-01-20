const md5 = require('md5');
const githubBranch = "master";
const govArticleLoc = 'pages/guidancefeed/gov';
const cdphArticleLoc = 'pages/guidancefeed/cdph';
const createGovItem = require('./templates/gov.js');
const createCDPHItem = require('./templates/cdph.js');
const govNews = require("./sources/gov.js");
const cdphNews = require("./sources/cdph.js");
const debugChannel = 'C01DBP67MSQ'; // #testingbot;
const appName = 'CovidNewsFeed';
const { slackBotReportError } = require('../common/slackBot');
// https://github-tools.github.io/github/docs/3.2.3/Repository.html
const GitHub = require('github-api'); 
const githubUser = 'cagov';
const githubRepo = 'covid19';
const committer = {
  name: process.env["GITHUB_NAME"],
  email: process.env["GITHUB_EMAIL"]
};

const getGovNews = new Promise((resolve, reject) => {
  govNews(resolve,reject);
});
const getCDPHNews = new Promise((resolve, reject) => {
  cdphNews(resolve,reject);
});


module.exports = async function (context, myTimer) {
  //await slackBotChatPost(debugChannel,`${appName} started`);

  try {
    const gitModule = new GitHub({ token: process.env["GITHUB_TOKEN"] });
    const gitRepo = await gitModule.getRepo(githubUser,githubRepo);
    const getExistingGovNews = gitRepo.getContents(githubBranch,govArticleLoc,true);
    const getExistingCDPHNews = gitRepo.getContents(githubBranch,cdphArticleLoc,true);

  await Promise.all([getGovNews, getExistingGovNews, getCDPHNews, getExistingCDPHNews]).then( 
    async values => {
      let writtenFileCount = 0;
      let newGovItems = values[0].filter(newItem => 
        !values[1].data.some(old => 
          old.name === `${newItem.id}.html`
        )
      );

      for (let item of newGovItems) {
        const newFile = createGovItem(item);
        const newFilePath = `${govArticleLoc}/${newFile.filename}.html`;
        const commitMessage = `ADD ${newFilePath}`;
        console.log(commitMessage);

        await gitRepo.writeFile(githubBranch, newFilePath, newFile.html, commitMessage, {committer,encode:true});
        writtenFileCount++;
      }

      let newCDPHItems = values[2].filter(newItem => 
        !values[3].data.some(old => 
          old.name === `${md5(newItem.url)}.html`
        )
      );

      for (let item of newCDPHItems) {
        const newFile = createCDPHItem(item);
        const newFilePath = `${cdphArticleLoc}/${newFile.filename}.html`;
        const commitMessage = `ADD ${newFilePath}`;
        console.log(commitMessage);

        await gitRepo.writeFile(githubBranch, newFilePath, newFile.html, commitMessage, {committer,encode:true});
        writtenFileCount++;
      }
      // respond with success here
      console.log(`Done, wrote - ${writtenFileCount}`);
      //await slackBotChatPost(debugChannel,`${appName} finished`);
    }
  );
} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};
