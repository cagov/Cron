
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

const pad2 = number => (number < 10 ? '0' : '') + number;

module.exports = async function (context, myTimer) {
  const lasthourTimstamp = slackBotTimeStampFromDate(new Date()-86400000); // /24
  const slackData = await (await slackBotChannelHistory(debugChannel,`&oldest=${lasthourTimstamp}`)).json();

  const TodayDayOfWeekCode = weekdayCodes[nowPacTime({weekday:"short"}).slice(0, -1)];
  const TodayYear = nowPacTime({year: 'numeric'});
  const TodayMonth = nowPacTime({month: 'numeric'});
  const TodayDay = nowPacTime({day: 'numeric'});
  

  for (let func of schedule.filter(x=>x.enabled)) {
    for (let runtime of func.daily_schedule.filter(x=>x.days.includes(TodayDayOfWeekCode))) {

      const runToday = new Date(`${TodayYear}-${TodayMonth}-${TodayDay} ${pad2(runtime.hour)}:${pad2(runtime.minute)}:00 PST`);
const ejhrbf=1;

//new Date('2021-03-22 9:0:00 PST')
//Mon Mar 22 2021 10:00:00 GMT-0700 (Pacific Daylight Time)
//new Date('2021-03-22 9:0:00')
//Mon Mar 22 2021 09:00:00 GMT-0700 (Pacific Daylight Time)



    }
  }
};