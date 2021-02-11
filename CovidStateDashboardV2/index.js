const { doCovidStateDashboarV2 } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const notifyChannel = 'C01AA1ZB05B';
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';


module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  try {
    await slackBotChatPost(debugChannel,`${appName} (Every 30 mins from 10am to 1:30pm)`);

    const PrResult = await doCovidStateDashboarV2();

    if(PrResult) {
      const prMessage = `Daily stats deployed\n${PrResult.html_url}`;
      await slackBotChatPost(debugChannel,prMessage);
      await slackBotChatPost(notifyChannel,prMessage);
    }

    await slackBotChatPost(debugChannel,`${appName} finished`);
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
};