const { slackBotChatPost, slackBotReportError, slackBotReactionAdd } = require('../common/slackBot');
const debugChannel = 'C01DBP67MSQ'; // testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  try {

    const prMessage = `Firing Pacific Time Cron Job.\n`;
    let slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName}: ${prMessage}`)).json()).ts;
    await slackBotReactionAdd(debugChannel, slackPostTS, 'clock3');
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
};