const { doCovidStateDashboarV2 } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const notifyChannel = 'C01AA1ZB05B';
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';


module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  try {
    await slackBotChatPost(debugChannel,`${appName} ran 10:45am`);

    const PrResult = await doCovidStateDashboarV2();

    await slackBotChatPost(debugChannel,`${appName} finished`);

    if(PrResult) {
      await slackBotChatPost(notifyChannel,`Daily stats deployed\n${PrResult.html_url}`);
    }
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
};