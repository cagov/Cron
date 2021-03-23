const { doCovidAutoBuilder } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel = 'C01DBP67MSQ'; // ultimately do this elsewhere... right now, testingbot
const debugChannel = 'C01DBP67MSQ'; // testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  const noisy_mode = false;
  let slackPostTS = null;
  try {
    // slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every 15 mins)`)).json()).ts;

    const PrResult = await doCovidAutoBuilder();

    if(PrResult) {
      const prMessage = `Data has been updated. Building covid19.\n`;
      let slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName}: ${prMessage}`)).json()).ts;
      await slackBotReactionAdd(debugChannel, slackPostTS, 'building_construction');
      // await slackBotChatPost(notifyChannel, prMessage);
    } else if (noisy_mode) {
      const prMessage = `No need to build covid19\n`;
      let slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName}:  ${prMessage}`)).json()).ts;
      await slackBotReactionAdd(debugChannel, slackPostTS, 'ok_hand');
    }
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
};