const { doHealthCheck } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const notifyChannel = 'C01DBP67MSQ'; //testingbot
const debugChannel = 'C01DBP67MSQ'; //testingbot
const appName = 'CovidSiteHealth';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(debugChannel,`${appName} ran 10:45am`);

  const report = await doHealthCheck();

  await slackBotChatPost(debugChannel,`${appName} finished`);

  if(report) {
    await slackBotChatPost(notifyChannel,`*${appName} Report*\n\`\`\`${JSON.stringify(report,null,2)}\`\`\``);
  }
} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};