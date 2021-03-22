const { doCovidVaccineEquity } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel = 'C01HTTNKHBM'; //covid19-vaccines
const debugChannel = 'C01DBP67MSQ'; // testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  try {
    const ts = (await slackBotChatPost(debugChannel,`${appName} (Every 30 mins from 9:15am to 1:45pm)`)).json().ts;

    const PrResult = await doCovidVaccineEquity();

    if(PrResult) {
      const prMessage = `Vaccine equity data deployed\n${PrResult.html_url}`;
      await slackBotReplyPost(debugChannel,ts,prMessage);
      await slackBotChatPost(notifyChannel,prMessage);
    }

    await slackBotReplyPost(debugChannel,ts,`${appName} finished`);
    await slackBotReactionAdd(debugChannel, ts, 'white_check_mark');
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
};