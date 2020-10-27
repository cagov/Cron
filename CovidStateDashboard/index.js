const { doDailyStatsPr } = require('./datasetUpdates');
const { slackBotChatPost, slackBotReportError } = require('./slackBot');
const targetChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const appName = 'CovidStateDashboard';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(targetChannel,`${appName} ran 10:45am`);

  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  await doDailyStatsPr(mergetargets);

  await slackBotChatPost(targetChannel,`${appName} finished`);
} catch (e) {
  await slackBotReportError(targetChannel,`Error running ${appName}`,e,context,myTimer);
}
};