const { slackBotChatPost } = require('../CovidStateDashboard/slackBot');
const { doWorkPr } = require('./doUpdate');
const targetChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';

module.exports = async function (context, myTimer) {
  await slackBotChatPost(targetChannel,'Cron job ran new 10:45am');

  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  await doWorkPr(mergetargets);

  await slackBotChatPost(targetChannel,'Cron job finished');
};