
const { 
  slackBotChatPost, 
  slackBotReportError, 
  slackBotReplyPost, 
  slackBotReactionAdd,  
  slackBotChannelHistory,
  slackBotTimeStampFromDate
 } = require('../common/slackBot');

 const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/

//const { runModule } = require('./modules');

const feedChannel = 'C0243VANW1W'; // #crondo-dev
const schedule = require("./schedule.json");
const jobs = schedule.data.jobs;

const weekdayCodes = 'UMTWRFS';

const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

module.exports = async function () {
  try {
    const startOfDataTimeStamp = slackBotTimeStampFromDate(moment().startOf('day'));

    const TodayDayOfWeekCode = weekdayCodes[moment().tz(dataTimeZone).day()];
    
    const slackData = await (await slackBotChannelHistory(feedChannel,`&oldest=${startOfDataTimeStamp}`)).json();
    for (const myjob of jobs.filter(x=>x.enabled&x.days.includes(TodayDayOfWeekCode))) {
      
        const runToday = moment.tz({hour:myjob.runat.hour,minute:myjob.runat.minute},dataTimeZone);

        const threadStartTimePassed = runToday.diff()<0;

        if(threadStartTimePassed) {
          //We should have a run for this

          //const threadNotTooLate = runToday.clone().add(1,'hour').diff()>0;
          let RuntimeThread = slackData.messages.find(m=>m.text===myjob.title);

          let runPlease = !RuntimeThread;
          if(!RuntimeThread) {
            RuntimeThread = await (await slackBotChatPost(feedChannel,myjob.title)).json();
          }
          const slackPostTS = RuntimeThread.ts;
          try {
            if(runPlease) {
              //await runModule(func.name,feedChannel,slackPostTS);

              await slackBotReplyPost(feedChannel, slackPostTS,`${myjob.title} finished`);
              await slackBotReactionAdd(feedChannel, slackPostTS, 'white_check_mark');
            } else {
              await slackBotReplyPost(feedChannel, slackPostTS,`${myjob.title} scanned`);
            }
          } catch (e) {
            //Report on this error and allow movement forward
            await slackBotReactionAdd(feedChannel, slackPostTS, 'x');
            await slackBotReplyPost(feedChannel, slackPostTS, `\`\`\`${e.stack}\`\`\``);
          }
      }
    }
  } catch (e) {
    //Someething in the overall system failed
    await slackBotReportError(feedChannel,`Error running Crondo`,e);
  }
};