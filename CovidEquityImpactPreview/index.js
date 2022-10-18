
const { doCovidEquityImpact } = require('../CovidEquityImpact/worker'); // this piggy-backs off of the main cron
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const debugChannel = 'C01DBP67MSQ'; // #testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;

  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every Monday @ 8:10am -- should snooze unless first Monday after a Friday)`)).json()).ts;

    if (isIdleDay({weekends_off:true, holidays_off:true, check_first_mon_after_fri:true})) {
      await slackBotReplyPost(debugChannel, slackPostTS,`${appName} snoozed`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'zzz');
    } else {
      const TreeRunResults = await doCovidEquityImpact(true); // preview run

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
