
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
    for (const func of jobs.filter(x=>x.enabled&x.days.includes(TodayDayOfWeekCode))) {
      
        const runToday = moment.tz({hour:func.runat.hour,minute:func.runat.minute},dataTimeZone);

        const threadStartTimePassed = runToday.diff()<0;
        const threadNotTooLate = runToday.clone().add(1,'hour').diff()>0;

        const RuntimeThread = slackData.messages.find(m=>m.text===func.title);

        if(threadStartTimePassed && threadNotTooLate) {
          //We should have a run for this

          if(!RuntimeThread) {
            let slackPostTS = (await (await slackBotChatPost(feedChannel,func.title)).json()).ts;

            try {
              //await runModule(func.name,feedChannel,slackPostTS);
              await slackBotReplyPost(feedChannel, slackPostTS,`${func.title} finished`);
              await slackBotReactionAdd(feedChannel, slackPostTS, 'white_check_mark');
            } catch (e) {
              //Report on this error and allow movement forward
              await slackBotReportError(feedChannel,`Error running ${func.title}`,e);

              if(slackPostTS) {
                await slackBotReplyPost(feedChannel, slackPostTS, `${func.title} ERROR!`);
                await slackBotReactionAdd(feedChannel, slackPostTS, 'x');
              }
            }
          }
        
      }
    }
  } catch (e) {
    //Someething in the overall system failed
    await slackBotReportError(feedChannel,`Error running Crondo`,e);
  }
};