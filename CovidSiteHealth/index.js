const { doHealthCheck } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const notifyChannel = 'C01H6RB99E2'; //'C01DBP67MSQ';
const debugChannel = 'C01H6RB99E2'; //'C01DBP67MSQ';
const appName = 'CovidSiteHealth';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(debugChannel,`${appName} ran 10:45am`);

  const report = await doHealthCheck();

  await slackBotChatPost(debugChannel,`${appName} finished`);

  if(report) {
    await slackBotChatPost(notifyChannel,`a thing happened\n${JSON.stringify(report,null,2)}`);
  }
} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};