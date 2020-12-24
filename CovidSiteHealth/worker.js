const { slackBotChannelHistory, slackBotChannelReplies, slackBotReplyPost, slackBotChatPost } = require('../common/slackBot');
//const notifyChannel = 'C01H6RB99E2'; //'C01DBP67MSQ';
const debugChannel = 'C01H6RB99E2'; //'C01DBP67MSQ';
const scanChannel = 'CUUAH7Z7G';
const bot_name = 'cagov Slackbot';

const fileToCheck = "https://covid19.ca.gov/commit-info.json";

const fetch = require('node-fetch');

const doHealthCheck = async () => {
    const yo = await fetch(fileToCheck)
      .then(async response => await response.ok ? responseOk(response) : responseNotOk(response));

    console.log(yo);
    return yo;
};

const responseOk = async response => {
  const commitinfo = await response.json();

  const history = await (await slackBotChannelHistory(scanChannel)).json();
  const GitHubPosts = history.messages.filter(x=>x.bot_profile&&x.bot_profile.name==='GitHub');

  for (let commit of commitinfo) {
    const matches = GitHubPosts.filter(p=>p.attachments.some(a=> a.text&&a.text.includes(commit.url)));
    for(let m of matches) {
      //mark all matches deployed
      //check for replies first

        if(m.latest_reply) {
          const replies = await (await slackBotChannelReplies(scanChannel,m.ts)).json();

          if(!replies.messages.some(r=>r.bot_profile&&r.bot_profile.name===bot_name)) {
            //If the reply isn't there...add it
            await slackBotReplyPost(scanChannel,m.ts,'Deployment Confirmed');
          }
        }
    }
  }

  return commitinfo;
};


const responseNotOk = async response => {
  return { 
    status: response.status,
    statusText: response.statusText
  };
};

module.exports = {
  doHealthCheck
};