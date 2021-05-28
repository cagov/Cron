const { WebClient } = require('@slack/web-api'); //https://slack.dev/node-slack-sdk/web-api
const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/

//const { runModule } = require('./modules');

const feedChannel = 'C0243VANW1W'; // #crondo-dev
const schedule = require("./schedule.json");
const jobs = schedule.data.jobs;

const weekdayCodes = 'UMTWRFS';

const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

module.exports = async function () {
  const slackWeb = new WebClient(process.env["SLACKBOT_TOKEN"]);
  try {
    const startOfDataTimeStamp = moment().startOf('day')/1000;

    const TodayDayOfWeekCode = weekdayCodes[moment().tz(dataTimeZone).day()];
    
    const slackData = await slackWeb.conversations.history({channel:feedChannel,oldest:startOfDataTimeStamp});
    //await (await slackBotChannelHistory(feedChannel,`&oldest=${startOfDataTimeStamp}`)).json();
    for (const myjob of jobs.filter(x=>x.enabled&x.days.includes(TodayDayOfWeekCode))) {
      
        const runToday = moment.tz({hour:myjob.runat.hour,minute:myjob.runat.minute},dataTimeZone);

        const threadStartTimePassed = runToday.diff()<0;

        if(threadStartTimePassed) {
          //We should have a run for this

          //const threadNotTooLate = runToday.clone().add(1,'hour').diff()>0;
          let RuntimeThread = slackData.messages.find(m=>m.text===myjob.title);

          let runPlease = !RuntimeThread;
          if(!RuntimeThread) {
            RuntimeThread = await slackWeb.chat.postMessage({channel: feedChannel,text: myjob.title});
          }
          const slackPostTS = RuntimeThread.ts;
          try {
            if(runPlease) {
              //await runModule(func.name,feedChannel,slackPostTS);
              await slackWeb.chat.postMessage({channel: feedChannel, text:`${myjob.title} finished`,thread_ts:slackPostTS});
              await slackWeb.reactions.add({channel:feedChannel,timestamp:slackPostTS,name:'white_check_mark'});
            } else {
              await slackWeb.chat.postMessage({channel: feedChannel,text:`${myjob.title} scanned`,thread_ts:slackPostTS});
            }
          } catch (e) {
            //Report on this error and allow movement forward
            await slackWeb.reactions.add({channel:feedChannel,timestamp:slackPostTS,name:'x'});
            await slackWeb.chat.postMessage({channel: feedChannel,text:`\`\`\`${e}\`\`\``,thread_ts:slackPostTS
            });
          }
      }
    }
  } catch (e) {
    //Someething in the overall system failed
    await slackWeb.chat.postMessage({channel: feedChannel,text:`*Error running Crondo*\`\`\`${e}\`\`\``});
  }
};