const { doCovidStateDashboardSummary } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
const debugChannel = 'C01DBP67MSQ'; // #testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every day @ 7:45am)`)).json()).ts;

    const TreeRunResults = await doCovidStateDashboardSummary();

    if(TreeRunResults.Pull_Request_URL) {
      const prMessage = `Daily stats summary ready\n${TreeRunResults.Pull_Request_URL}`;
      await slackBotReplyPost(debugChannel, slackPostTS, prMessage);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'package');
      await slackBotChatPost(notifyChannel, prMessage);
    }

    await slackBotReplyPost(debugChannel, slackPostTS,`${appName} finished`);
    await slackBotReactionAdd(debugChannel, slackPostTS, 'white_check_mark');
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);

    if(slackPostTS) {
      await slackBotReplyPost(debugChannel, slackPostTS, `${appName} ERROR!`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'x');
    }
  }
};