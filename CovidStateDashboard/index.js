const { slackBotChatPost } = require('./slackBot');
const { doDailyStatsPr } = require('./datasetUpdates');
const targetChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';

module.exports = async function (context, myTimer) {
  //var timeStamp = new Date().toISOString();
  
  //if (myTimer.isPastDue)
  //{
  //    context.log('JavaScript is running late!');
  //}
  //context.log('JavaScript timer trigger function ran!', timeStamp);   

  await slackBotChatPost(targetChannel,'Cron job ran new 10:45am');

  const masterbranch='master', stagingbranch='staging';
  const mergetargets = [masterbranch,stagingbranch];

  await doDailyStatsPr(mergetargets);

  await slackBotChatPost(targetChannel,'Cron job finished');
};