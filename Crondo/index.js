
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

 const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/

//const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
//const debugChannel = 'C01DBP67MSQ'; // #testingbot
const debugChannel = 'C01H6RB99E2'; // #carter-dev
const notifyChannel = 'C01H6RB99E2'; // #carter-dev
const schedule = require('./schedule.json').data.functions;

const weekdayCodes = 'UMTWRFS';


const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';
module.exports = async function (context, myTimer) {
  const hereNow = moment().tz(dataTimeZone);

  const lasthourTimstamp = slackBotTimeStampFromDate(moment().subtract(1, 'hours'));

  const TodayDayOfWeekCode = weekdayCodes[hereNow.day()];
  const TodayYear = hereNow.year();
  const TodayMonth = hereNow.month();
  const TodayDay = hereNow.day();
  const TodayHour = hereNow.hour();
  
  const slackData = await (await slackBotChannelHistory(debugChannel,`&oldest=${lasthourTimstamp}`)).json();
  for (let func of schedule.filter(x=>x.enabled)) {
    for (let runtime of func.daily_schedule.filter(x=>x.days.includes(TodayDayOfWeekCode))) {

      //const runToday = moment.tz({hour:runtime.hour,minute:runtime.minute},dataTimeZone);
const runToday = moment.tz({hour:runtime.hour,minute:runtime.minute},dataTimeZone);
const sRunToday = runToday.tz('America/Los_Angeles').toLocaleString();



      const threadStartTime = runToday.clone().subtract(15,'minute');
      const threadTooLateTime = runToday.clone().add(1,'hour');

      const sThreadStartTime = threadStartTime.toLocaleString();
      const sThreadStartTimePassed = threadStartTime.from();
      const threadStartTimePassed = threadStartTime.diff();

      if(threadStartTimePassed<0 && threadTooLateTime.diff()>0) {
        //Ok to open this thread
        const RuntimeThread = slackData.messages.find(m=>m.text===runtime.message);

        if(!RuntimeThread) {
          await slackBotChatPost(debugChannel,runtime.message);
        }
      }



      //new Date(`${TodayYear}-${TodayMonth}-${TodayDay} ${pad2(runtime.hour)}:${pad2(runtime.minute)}:00 PST`);
const ejhrbf=1;

//new Date('2021-03-22 9:0:00 PST')
//Mon Mar 22 2021 10:00:00 GMT-0700 (Pacific Daylight Time)
//new Date('2021-03-22 9:0:00')
//Mon Mar 22 2021 09:00:00 GMT-0700 (Pacific Daylight Time)



    }
  }
};