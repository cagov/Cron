
//const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { doCovidStateDashboarV2 } = require('../CovidStateDashboardV2/worker');
const { doCovidVaccineEquity } = require('../CovidVaccineEquity/worker');
const { doCovidVaccineHPIV2 } = require('../CovidVaccineHPIV2/worker');
const { slackBotChatPost, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const notifyChannel_covid19_state_dash = 'C01AA1ZB05B'; // #covid19-state-dash
//const notifyChannel_covid19_blueprint = 'C019DS5S6Q2'; // #covid19-blueprint
const notifyChannel_covid19_vaccines = 'C01HTTNKHBM'; //covid19-vaccines


/**
 * 
 * @param {{html_url:string}} [prResult] PR if created
 * @param {string} prMessageHeader 
 * @param {string} [notifyChannel]
 * @param {string} feedChannel 
 * @param {string} slackPostTS 
 */
const slackPrResult = async (prResult, prMessageHeader,notifyChannel, feedChannel, slackPostTS)  => {
  if(prResult) {
    const prMessage = `${prMessageHeader}\n${prResult.html_url}`;
    await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
    await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
    if(notifyChannel) {
      await slackBotChatPost(notifyChannel, prMessage);
    }
  }
};

/**
 * Runs a CRON module by name
 * @param {string} moduleName The module to run
 * @param {string} feedChannel The Slack channel to post updates to
 * @param {string} slackPostTS The Slack TimeStamp to post replies to
 */
const runModule = async (moduleName, feedChannel, slackPostTS) => {
  switch (moduleName) {
    case 'CovidStateDashboardV2':
      await slackPrResult(await doCovidStateDashboarV2(),
        'Daily stats V2 deployed',
        notifyChannel_covid19_state_dash,
        feedChannel,slackPostTS);
      return;
    case 'doCovidVaccineEquity':
      await slackPrResult(await doCovidVaccineEquity(),
        'Vaccine equity data deployed',
        notifyChannel_covid19_vaccines,
        feedChannel,slackPostTS);
      return;
    case 'CovidVaccineHPIV2':
      await slackPrResult(await doCovidVaccineHPIV2(),
        'Vaccine HPI data deployed',
        notifyChannel_covid19_vaccines,
        feedChannel,slackPostTS);
      return;
      /*
    case 'CovidWeeklyTierUpdate':
      (await doWeeklyUpdatePrs()).forEach(async p=>{
        prMessage = `Tier Update Deployed\n${p.html_url}`;
        await slackBotReplyPost(feedChannel, slackPostTS, prMessage);
        await slackBotReactionAdd(feedChannel, slackPostTS, 'package');
        await slackBotChatPost(notifyChannel_covid19_blueprint, prMessage);
      });
        return;
      */
    default:
      throw new Error(`no code match for ${moduleName}`);
  }
};

module.exports = {
  runModule
};