const { slackBotChannelHistory, slackBotChannelReplies, slackBotReplyPost } = require('../common/slackBot');
const scanChannel = 'CUUAH7Z7G'; //#code-movement
const bot_name = 'cagov Slackbot';

const fileToCheck = "https://covid19.ca.gov/commit-info.json";

const fetch = require('node-fetch');

const doHealthCheck = async () => 
    await fetch(fileToCheck)
      .then(async response => await response.ok ? responseOk(response) : responseNotOk(response));

const responseOk = async response => {
  console.log('Response OK');
  const commitinfo = await response.json();

  if(commitinfo.some(c => (new Date - new Date(c.timestamp))/1000/60/60 < 1) ) {
    //Some commits deployed within the last hour
    console.log('recent commit found.');

    const history = await (await slackBotChannelHistory(scanChannel)).json();
    const GitHubPosts = history.messages.filter(x=>x.bot_profile&&x.bot_profile.name==='GitHub');
  
    for (let commit of commitinfo) {
      const matches = GitHubPosts.filter(p=>p.attachments.some(a=> a.text&&a.text.includes(commit.url)));
      for(let m of matches) {
        //mark all matches deployed
        //check for replies first
        let hasReplies = !!m.latest_reply;
  
        if(hasReplies) {
          console.log('Checking replies on match.');
          const repliesResponse = await slackBotChannelReplies(scanChannel,m.ts);
          const replies = await repliesResponse.json();

          hasReplies = replies.messages.some(r=>r.bot_profile&&r.bot_profile.name===bot_name);
        }

        if (!hasReplies) {
          //If the reply isn't there...add it
          console.log('Marking a reply deployed');
          await slackBotReplyPost(scanChannel,m.ts,'*Deployment Confirmed*');
        }
      }
    }
  } else {
    console.log('no recent commit found.');
  }

  console.log('Done.');
};

const responseNotOk = async response => {
  console.log('Response NOT OK');
  return { 
    status: response.status,
    statusText: response.statusText
  };
};

module.exports = {
  doHealthCheck
};