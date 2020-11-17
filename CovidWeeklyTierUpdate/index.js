const { doWeeklyUpdatePrs } = require('./doUpdate');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const targetChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const appName = 'CoivdWeeklyTierUpdate';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(targetChannel,`${appName} ran TUE 9:30`);

  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  await doWeeklyUpdatePrs(mergetargets);

  await slackBotChatPost(targetChannel,`${appName} finished`);
} catch (e) {
  await slackBotReportError(targetChannel,`Error running ${appName}`,e,context,myTimer);
}
};