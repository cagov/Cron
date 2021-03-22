const { doWeeklyUpdatePrs } = require('./doUpdate');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel = 'C019DS5S6Q2'; // #covid19-blueprint
const debugChannel = 'C01DBP67MSQ'; // #testingbot
module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} ran (9am every day)`)).json()).ts;

    const masterbranch='master', stagingbranch='staging';
    const mergetargets = [masterbranch,stagingbranch];
  
    const report = await doWeeklyUpdatePrs(mergetargets);

    for (let PrResult of report) {
      const prMessage = `Tier Update Deployed\n${PrResult.html_url}`;
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