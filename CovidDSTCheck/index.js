const { slackBotChatPost } = require('../common/slackBot');
const dstNotifyChannel = 'C02J16U50KE'; // #jbum-testing
const appName = 'CovidDSTCheck';

module.exports = async function (context, myTimer) {
  let dtString = (new Date()).toLocaleDateString() + ' ' + (new Date()).toLocaleTimeString();
  await slackBotChatPost(dstNotifyChannel,`*${appName} firing at ${dtString}`);
};
