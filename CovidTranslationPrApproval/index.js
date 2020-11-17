const { doTranslationPrUpdate  } = require('./worker');
const { slackBotChatPost, slackBotReportError } = require('../CovidStateDashboard/slackBot');
const notifyChannel = 'C01AA1ZB05B';
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const appName = 'CovidTranslationPrApproval';
const masterbranch='master';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(debugChannel,`${appName} ran`);

  await doTranslationPrUpdate(masterbranch);

  await slackBotChatPost(debugChannel,`${appName} finished`);

} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};