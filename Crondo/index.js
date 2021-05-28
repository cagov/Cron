const { WebClient } = require('@slack/web-api'); //https://slack.dev/node-slack-sdk/web-api
const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/

//const { runModule } = require('./modules');

const channel = 'C0243VANW1W'; // #crondo-dev
const myUser = 'U01CYP9UF62';
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
    
    const slackData = await slackWeb.conversations.history({channel,oldest:startOfDataTimeStamp});
    //https://api.slack.com/methods/conversations.history

    for (const myjob of jobs.filter(x=>x.enabled&x.days.includes(TodayDayOfWeekCode))) {
        const runToday = moment.tz({hour:myjob.runat.hour,minute:myjob.runat.minute},dataTimeZone);

        const threadStartTimePassed = runToday.diff()<0;

        if(threadStartTimePassed) {
          //We should have a run for this

          //const threadNotTooLate = runToday.clone().add(1,'hour').diff()>0;
          let RuntimeThread = slackData.messages.find(m=>m.text===myjob.title);

          let runPlease = !RuntimeThread;
          if(!RuntimeThread) {
            RuntimeThread = await slackWeb.chat.postMessage({channel,text:myjob.title});
            //https://api.slack.com/methods/chat.postMessage
          }
          const thread_ts = RuntimeThread.ts;

          if(RuntimeThread.reply_users?.length>1) {
            //user activiy
            const replies = await slackWeb.conversations.replies({channel,ts:thread_ts, limit:999});
            await slackWeb.chat.postMessage({channel,thread_ts,text:`user activity detected.`});
          }

          try {
            if(runPlease) {
              //await runModule(func.name,feedChannel,slackPostTS);
              await slackWeb.chat.postMessage({channel,thread_ts,text:`${myjob.title} finished`});
              await slackWeb.reactions.add({channel,timestamp:thread_ts,name:'white_check_mark'});
            } else {
              await slackWeb.chat.postMessage({channel,thread_ts,text:`${myjob.title} scanned`});
            }
          } catch (e) {
            //Report on this error and allow movement forward
            await slackWeb.reactions.add({channel,timestamp:thread_ts,name:'x'});
            await slackWeb.chat.postMessage({channel,thread_ts,text:`\`\`\`${e}\`\`\``
            });
          }
      }
    }
  } catch (e) {
    //Someething in the overall system failed
    await slackWeb.chat.postMessage({channel,text:`*Error running Crondo*\`\`\`${e}\`\`\``});
  }
};