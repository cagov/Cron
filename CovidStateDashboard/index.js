const { doDailyStatsPr } = require('./datasetUpdates');
const { slackBotChatPost, slackBotReportError } = require('./slackBot');
const notifyChannel = 'C01AA1ZB05B';
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const appName = 'CovidStateDashboard';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(debugChannel,`${appName} ran 10:45am`);

  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  const PrResult = await doDailyStatsPr(mergetargets);

  await slackBotChatPost(debugChannel,`${appName} finished`);

  await slackBotChatPost(notifyChannel,`Daily stats deployed\n${PrResult.html_url}`);

} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};