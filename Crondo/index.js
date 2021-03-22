
const { 
  slackBotChatPost, 
  slackBotReportError, 
  slackBotReplyPost, 
  slackBotReactionAdd,  
  slackBotChannelHistory, 
  slackBotChannelReplies,
  slackBotTimeStampFromDate,
  slackBotTimeStampToDate
 } = require('../common/slackBot');
//const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
//const debugChannel = 'C01DBP67MSQ'; // #testingbot
const debugChannel = 'C01H6RB99E2'; // #carter-dev
const notifyChannel = 'C01H6RB99E2'; // #carter-dev
const schedule = require('./schedule.json').data.functions;

module.exports = async function (context, myTimer) {
  const lasthourTimstamp = slackBotTimeStampFromDate(new Date()-86400000); // /24
  const slackData = await (await slackBotChannelHistory(debugChannel,`&oldest=${lasthourTimstamp}`)).json();

  for (let func of schedule.filter(x=>x.enabled)) {

    const x =1;
  }
};