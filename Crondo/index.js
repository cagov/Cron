const { WebClient } = require('@slack/web-api'); //https://slack.dev/node-slack-sdk/web-api
const moment = require('moment'); // https://momentjs.com/docs/#/use-it/node-js/

//const { runModule } = require('./modules');

const channel = 'C0243VANW1W'; // #crondo-dev
const botUserId = 'U01CYP9UF62'; //The Slack user of this process for filtering work
const schedule = require("./schedule.json");
const jobs = schedule.data.jobs;

const weekdayCodes = 'UMTWRFS';

const dataTimeZone = 'America/Los_Angeles';
//const dataTimeZone = 'America/New_York';

const commands = ['run','help'];
const helpText = '*Crondo Commands...*\n`help` : Show this list.\n`run` : Restart the job.';

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

          if(RuntimeThread.reply_users?.filter(x=>x!==botUserId).length) {
            //user activiy
            const replies = await slackWeb.conversations.replies({channel,ts:thread_ts, limit:999});

            const userCommands = replies.messages.filter(x=>x.user!==botUserId&&commands.includes(x.text));
            const unasnweredCommands = userCommands.filter(x=>!x.reactions || !x.reactions.some(y=>y.users.some(u=>u===botUserId)));

            for(const command of unasnweredCommands) {
              switch (command.text) {
                case 'help':
                  await slackWeb.chat.postMessage({channel,thread_ts,text:helpText});
                  break;
                case 'run':
                  runPlease = true; //mark for re-run
                  await slackWeb.chat.postMessage({channel,thread_ts,text:`Run restart`});
                  break;
                default:
                  await slackWeb.chat.postMessage({channel,thread_ts,text:`Command not implemented - ${command.text}`});
              }
              await slackWeb.reactions.add({channel,timestamp:command.ts,name:'gear'});
            }
          }

          try {
            if(runPlease) {
              //await runModule(func.name,feedChannel,slackPostTS);
              await slackWeb.chat.postMessage({channel,thread_ts,text:`${myjob.title} finished`});

              if(!RuntimeThread.reactions.some(x=>x.name==='white_check_mark')) {
                await slackWeb.reactions.add({channel,timestamp:thread_ts,name:'white_check_mark'});
              }
            }
          } catch (e) {
            //Report on this error and allow movement forward
            if(!RuntimeThread.reactions.some(x=>x.name==='x')) {
              await slackWeb.reactions.add({channel,timestamp:thread_ts,name:'x'});
            }
            await slackWeb.chat.postMessage({channel,thread_ts,text:`\`\`\`${e}\`\`\``});
          }
      }
    }
  } catch (e) {
    //Someething in the overall system failed
    await slackWeb.chat.postMessage({channel,text:`*Error running Crondo*\`\`\`${e}\`\`\``});
  }
};