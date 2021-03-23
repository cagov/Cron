
const { doCovidStateDashboarV2 } = require('../CovidStateDashboardV2/worker');
const { slackBotChatPost, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
//const notifyChannel_covid19_state_dash = 'C01AA1ZB05B'; // #covid19-state-dash
const notifyChannel_covid19_state_dash = 'C01H6RB99E2'; // #carter-dev

const runModule = async (moduleName, debugChannel, slackPostTS) => {
  let prResult = null;
  let prMessage = null;

  switch (moduleName) {
    case 'CovidStateDashboardV2':
      prResult = await doCovidStateDashboarV2();

      if(prResult) {
        prMessage = `Daily stats V2 deployed\n${prResult.html_url}`;
        await slackBotReplyPost(debugChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(debugChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_state_dash, prMessage);
      }
      return;
  default:
    throw new Error(`no code match for ${moduleName}`);
  }
};

module.exports = {
  runModule
};