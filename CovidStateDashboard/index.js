const { slackBotChatPost } = require('./slackBot');

module.exports = async function (context, myTimer) {
  //var timeStamp = new Date().toISOString();
  
  //if (myTimer.isPastDue)
  //{
  //    context.log('JavaScript is running late!');
  //}
  //context.log('JavaScript timer trigger function ran!', timeStamp);   


  const targetChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
  const response = await slackBotChatPost(targetChannel,'Cron job ran');
};