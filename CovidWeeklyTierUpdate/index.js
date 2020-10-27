const { slackBotChatPost } = require('../CovidStateDashboard/slackBot');
const { doWorkPr } = require('./doUpdate');
const targetChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';

module.exports = async function (context, myTimer) {
  await slackBotChatPost(targetChannel,'Weekly Update Ran TUE 9:30');

  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  await doWorkPr(mergetargets);

  await slackBotChatPost(targetChannel,'Weekly Update Finished');
};