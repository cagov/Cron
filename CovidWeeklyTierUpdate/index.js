const { doWeeklyUpdatePrs } = require('./doUpdate');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const notifyChannel = 'C019DS5S6Q2'; // dimmer
const appName = 'CoivdWeeklyTierUpdate';

module.exports = async function (context, myTimer) {
try {
  await slackBotChatPost(debugChannel,`${appName} ran`);

  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  const report = await doWeeklyUpdatePrs(mergetargets);

  for (const val of report) {
      await slackBotChatPost(notifyChannel,`Tier Update Deployed\n${val.Pr.html_url}`);
  }

  await slackBotChatPost(debugChannel,`${appName} finished`);
} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};