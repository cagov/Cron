const { doHealthCheck } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const notifyChannel = 'C01DBP67MSQ'; //testingbot
const debugChannel = 'C01DBP67MSQ'; //testingbot
const tempChannel = 'C01H6RB99E2'; //carterDev
const appName = 'CovidSiteHealth';

module.exports = async function (context, myTimer) {
try {
  const report = await doHealthCheck();

  if(report) {
    await slackBotChatPost(notifyChannel,`*${appName} Report*\n\`\`\`${JSON.stringify(report,null,2)}\`\`\``);
  }
} catch (e) {
  if(e && e.stack && e.stack.includes('ECONNRESET')) {
    await slackBotReportError(tempChannel,`Error running ${appName}`,e,context,myTimer);
  } else {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
  }
}
};