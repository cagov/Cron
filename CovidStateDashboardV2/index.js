const { doCovidStateDashboarV2 } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
const debugChannel = 'C01DBP67MSQ'; // #testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every day @ 8:00am)`)).json()).ts;

    const PrResult = await doCovidStateDashboarV2();

    if(PrResult) {
      const prMessage = `Daily stats V2 deployed\n${PrResult.html_url}`;
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