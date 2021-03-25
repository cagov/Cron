
const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doCovidStateDashboarV2 } = require('../CovidStateDashboardV2/worker');
const { doCovidVaccineEquity } = require('../CovidVaccineEquity/worker');
const { doCovidVaccineHPIV2 } = require('../CovidVaccineHPIV2/worker');
const { slackBotChatPost, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel_covid19_state_dash = 'C01AA1ZB05B'; // #covid19-state-dash
const notifyChannel_covid19_blueprint = 'C019DS5S6Q2'; // #covid19-blueprint
const notifyChannel_covid19_vaccines = 'C01HTTNKHBM'; //covid19-vaccines

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
    case 'CovidStateDashboardV2':
      prResult = await doCovidStateDashboarV2();

      if(prResult) {
        prMessage = `Daily stats V2 deployed\n${prResult.html_url}`;
        await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_state_dash, prMessage);
      }
      return;
    case 'doCovidVaccineEquity':
      prResult = await doCovidVaccineEquity();

      if(prResult) {
        prMessage = `Vaccine equity data deployed\n${prResult.html_url}`;
        await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_vaccines, prMessage);
      }
      return;
    case 'CovidVaccineHPIV2':
      prResult = await doCovidVaccineHPIV2();

      if(prResult) {
        prMessage = `Vaccine HPI data deployed\n${prResult.html_url}`;
        await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_vaccines, prMessage);
      }
      return;
    case 'CovidWeeklyTierUpdate':
      (await doWeeklyUpdatePrs()).forEach(async p=>{
        prMessage = `Tier Update Deployed\n${p.html_url}`;
        await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_blueprint, prMessage);
      });

      return;
    default:
      throw new Error(`no code match for ${moduleName}`);
  }
};

module.exports = {
  runModule
};