const { doCovidStateDashboardTablesCasesDeaths } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const { isIdleDay } = require('../common/timeOffCheck');
//const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
const debugChannel = 'C01DBP67MSQ'; // #testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every Tue,Fri @ 7:10am)`)).json()).ts;

    if (isIdleDay({weekends_off:true, holidays_off:true})) {
      await slackBotReplyPost(debugChannel, slackPostTS,`${appName} snoozed (weekend or holiday)`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'zzz');
    }
    else {
      const PrResults = await doCovidStateDashboardTablesCasesDeaths();

      if(PrResults) {
        await slackBotReactionAdd(debugChannel, slackPostTS, 'package');

        for (let Pr of PrResults) {
          await slackBotReplyPost(debugChannel, slackPostTS, Pr.html_url);
          //removing notifications until final deployment
          //await slackBotChatPost(notifyChannel, Pr.html_url);
        }
      }
      await slackBotReplyPost(debugChannel, slackPostTS,`${appName} finished`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'white_check_mark');
    }

  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);

    if(slackPostTS) {
      await slackBotReplyPost(debugChannel, slackPostTS, `${appName} ERROR!`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'x');
    }
  }
};
