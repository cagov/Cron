const { doCovidVaccineEquity } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const notifyChannel = 'C01AA1ZB05B';
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';


module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  try {
    await slackBotChatPost(debugChannel,`${appName} (Every 30 mins from 10:15am to 1:45pm)`);

    //turning the whole thing off until it's fixed
    const PrResult = await doCovidVaccineEquity();

    await slackBotChatPost(debugChannel,`${appName} finished`);

    if(PrResult) {
      const prMessage = `Vaccine equity data deployed\n${PrResult.html_url}`;
      await slackBotChatPost(debugChannel,prMessage);
      await slackBotChatPost(notifyChannel,prMessage);
    }
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
};