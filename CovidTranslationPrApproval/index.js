const { doTranslationPrUpdate  } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('./slackBot');
const notifyChannel = 'C01AA1ZB05B';
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const appName = 'CovidStateDashboard';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(debugChannel,`${appName} ran`);

  const masterbranch='master';

  await doTranslationPrUpdate(masterbranch);

  await slackBotChatPost(debugChannel,`${appName} finished`);

} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};