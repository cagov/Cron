const fetch = require('node-fetch');
const slackApiChatPost = 'https://slack.com/api/chat.postMessage';
const slackApiChannelHistory = 'https://slack.com/api/conversations.history';
const slackApiChannelReplies = 'https://slack.com/api/conversations.replies';

//For help building attachments...go here...
//https://api.slack.com/docs/messages/builder

const slackBotGetToken = () => {
  const token = process.env["SLACKBOT_TOKEN"];

  if (!token) {
    //developers that don't set the creds can still use the rest of the code
    console.error('You need local.settings.json to contain "SLACKBOT_TOKEN" to use slackbot features.');
    return;
  }

  return token;
};

const slackApiHeaders = {
  'Authorization' : `Bearer ${slackBotGetToken()}`,
  'Content-Type': 'application/json;charset=utf-8'
};

const slackApiPost = bodyJSON =>
    ({
        method: 'POST',
        headers: slackApiHeaders,
        body: JSON.stringify(bodyJSON)
    });
const slackApiGet = () =>
  ({
      headers: slackApiHeaders
  });

    //https://api.slack.com/methods/conversations.history
const slackBotChannelHistory = async channel => {
  return await fetch(`${slackApiChannelHistory}?channel=${channel}`,slackApiGet());
};

//https://api.slack.com/methods/conversations.replies
const slackBotChannelReplies = async (channel,ts) => {
  return await fetch(`${slackApiChannelReplies}?channel=${channel}&ts=${ts}`,slackApiGet());
};

const slackBotChatPost = async (channel,text,attachments) => {
  const payload = {
    channel,
    text,
    attachments
  };

  return await fetch(slackApiChatPost,slackApiPost(payload));
};

const slackBotDelayedChatPost = async (channel,text,post_at) => {
  const payload = {
    channel,
    text,
    post_at
  };

  const fetchResp = await fetch("https://slack.com/api/chat.scheduleMessage",slackApiPost(payload));
  const postInfo = await fetchResp.json();
  return postInfo;
};

//request/data is optional
const slackBotReportError = async (channel,title,errorObject,request,data) => {
  console.error(errorObject);

  let slackText = `${title}\n*Error Stack*\n\`\`\`${errorObject.stack}\`\`\``;

  if (request) {
    slackText += `\n\n*Request*\n\`\`\`${JSON.stringify(request,null,2)}\`\`\``;
  }
  if (data) {
    slackText += `\n\n*Data*\n\`\`\`${JSON.stringify(data,null,2)}\`\`\``;
  }

  return await slackBotChatPost(channel,slackText);
};

module.exports = {
  slackBotChatPost,
  slackBotDelayedChatPost,
  slackBotReportError,
  slackBotChannelHistory,
  slackBotChannelReplies
};