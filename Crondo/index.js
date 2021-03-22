
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

const nowPacTime = options => new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", ...options});
const todayDateString = () => nowPacTime({year: 'numeric',month: '2-digit',day: '2-digit'});
const todayTimeString = () => nowPacTime({hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'}).replace(/:/g,'-');

const weekdayCodes = 
  {
    Mon:'M',
    Tue:'T',
    Wed:'W',
    Thu:'R',
    Fri:'F',
    Sat:'S',
    Sun:'U'
  }
;


module.exports = async function (context, myTimer) {
  const lasthourTimstamp = slackBotTimeStampFromDate(new Date()-86400000); // /24
  const slackData = await (await slackBotChannelHistory(debugChannel,`&oldest=${lasthourTimstamp}`)).json();

  const dayOfTheWeekCode = weekdayCodes[new Date().toLocaleString("en-CA", {timeZone: "America/Los_Angeles", weekday:"short"}).slice(0, -1)];

  for (let func of schedule.filter(x=>x.enabled)) {
    for (let runtime of func.daily_schedule.filter(x=>x.days.includes(dayOfTheWeekCode))) {
const skdvndbf=1;
    }
  }
};