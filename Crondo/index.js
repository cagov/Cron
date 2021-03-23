
const { 
  slackBotChatPost, 
  slackBotReportError, 
  slackBotReplyPost, 
  slackBotReactionAdd,  
  slackBotChannelHistory,
  slackBotTimeStampFromDate
 } = require('../common/slackBot');

 const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/

const { runModule } = require('./modules');

const debugChannel = 'C01H6RB99E2'; // #carter-dev
const schedule = require('./schedule.json').data.functions;

const weekdayCodes = 'UMTWRFS';

const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

module.exports = async function () {
  try {
    const lasthourTimstamp = slackBotTimeStampFromDate(moment().subtract(1, 'hours'));

    const TodayDayOfWeekCode = weekdayCodes[moment().tz(dataTimeZone).day()];
    
    const slackData = await (await slackBotChannelHistory(debugChannel,`&oldest=${lasthourTimstamp}`)).json();
    for (let func of schedule.filter(x=>x.enabled)) {
      for (let runtime of func.daily_schedule.filter(x=>x.days.includes(TodayDayOfWeekCode))) {
        let runToday = moment.tz({hour:runtime.hour,minute:runtime.minute},dataTimeZone);

        let threadStartTimePassed = runToday.diff()<0;
        let threadNotTooLate = runToday.clone().add(1,'hour').diff()>0;

        if(threadStartTimePassed && threadNotTooLate) {
          //We should have a run for this
          let RuntimeThread = slackData.messages.find(m=>m.text===runtime.message);

          if(!RuntimeThread) {
            let slackPostTS = (await (await slackBotChatPost(debugChannel,runtime.message)).json()).ts;

            try {
              await runModule(func.name,debugChannel,slackPostTS);
            } catch (e) {
              //Report on this error and allow movement forward
              await slackBotReportError(debugChannel,`Error running ${func.name}`,e);

              if(slackPostTS) {
                await slackBotReplyPost(debugChannel, slackPostTS, `${func.name} ERROR!`);
                await slackBotReactionAdd(debugChannel, slackPostTS, 'x');
              }
            }

            await slackBotReplyPost(debugChannel, slackPostTS,`${func.name} finished`);
            await slackBotReactionAdd(debugChannel, slackPostTS, 'white_check_mark');
          }
        }
      }
    }
  } catch (e) {
    //Someething in the overall system failed
    await slackBotReportError(debugChannel,`Error running Crondo`,e);
  }
};