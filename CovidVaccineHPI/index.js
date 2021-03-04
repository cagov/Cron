const { doCovidVaccineHPI } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const notifyChannel = 'C01HTTNKHBM'; //covid19-vaccines
const debugChannel = 'C01DBP67MSQ'; // testingbot

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  try {
    await slackBotChatPost(debugChannel,`${appName} (Every 30 mins from 10:15am to 1:45pm)`);

    const PrResult = await doCovidVaccineHPI();

    if(PrResult) {
      const prMessage = `Vaccine HPI data deployed\n${PrResult.html_url}`;
      await slackBotChatPost(debugChannel,prMessage);
      await slackBotChatPost(notifyChannel,prMessage);
    }

    await slackBotChatPost(debugChannel,`${appName} finished`);
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
};