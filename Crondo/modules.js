
const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doDailyStatsPr } = require('../CovidStateDashboard/datasetUpdates');
const { doCovidStateDashboarV2 } = require('../CovidStateDashboardV2/worker');
const { doCovidVaccineEquity } = require('../CovidVaccineEquity/worker');
const { doCovidVaccineHPI } = require('../CovidVaccineHPI/worker');
const { doCovidVaccineHPIV2 } = require('../CovidVaccineHPIV2/worker');
const { slackBotChatPost, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
//const notifyChannel_covid19_state_dash = 'C01AA1ZB05B'; // #covid19-state-dash
//const notifyChannel_covid19_blueprint = 'C019DS5S6Q2'; // #covid19-blueprint
const notifyChannel_covid19_state_dash = 'C01H6RB99E2'; // #carter-dev
const notifyChannel_covid19_blueprint =  'C01H6RB99E2'; // #carter-dev

/**
 * Runs a CRON module by name
 * @param {string} moduleName The module to run
 * @param {string} feedChannel The Slack channel to post updates to
 * @param {string} slackPostTS The Slack TimeStamp to post replies to
 */
const runModule = async (moduleName, feedChannel, slackPostTS) => {
  let prResult = null;
  let prMessage = null;

  switch (moduleName) {
    case 'CovidStateDashboard':  
      prResult = await doDailyStatsPr(['master','staging']);
  
      if(prResult) {
        prMessage = `Daily stats deployed\n${prResult.html_url}`;
        await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_state_dash, prMessage);
      }
      return;
    case 'CovidStateDashboardV2':
      prResult = await doCovidStateDashboarV2();

      if(prResult) {
        prMessage = `Daily stats V2 deployed\n${prResult.html_url}`;
        await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_state_dash, prMessage);
      }
      return;
      case 'CovidWeeklyTierUpdate':
        (await doWeeklyUpdatePrs()).forEach(async p=>{
          const PrMessage = `Tier Update Deployed\n${p.html_url}`;
          await slackBotReplyPost(feedChannel, slackPostTS, PrMessage);
          await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
          await slackBotChatPost(notifyChannel_covid19_blueprint, PrMessage);
        });
  
        return;
  default:
    throw new Error(`no code match for ${moduleName}`);
  }
};

module.exports = {
  runModule
};