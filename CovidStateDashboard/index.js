const { doDailyStatsPr } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
const debugChannel = 'C01DBP67MSQ'; // #testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} ran 9:22am`)).json()).ts;

    const masterbranch='master', stagingbranch='staging';
    const mergetargets = [masterbranch,stagingbranch];

    const PrResult = await doDailyStatsPr(mergetargets);

    if(PrResult) {
      const prMessage = `Daily stats deployed\n${PrResult.html_url}`;
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