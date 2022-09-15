
const { doCovidPostvaxData } = require('../CovidPostvaxDataNoboost/worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const { isIdleDay } = require('../common/timeOffCheck');
const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
const debugChannel = 'C01DBP67MSQ'; // #testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every Wednesday @ 8:30am -- should snooze unless first week of month )`)).json()).ts;

    if (isIdleDay({weekends_off:true, holidays_off:true, first_week_only:true, day_delta:1})) {
      await slackBotReplyPost(debugChannel, slackPostTS,`${appName} snoozed`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'zzz');
    } else {
      const TreeRunResults = await doCovidPostvaxData(true);

      if(TreeRunResults.Pull_Request_URL) {
        const prMessage = `Weekly Postvax preview data ready\n${TreeRunResults.Pull_Request_URL}`;
        await slackBotReplyPost(debugChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(debugChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel, prMessage);
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
