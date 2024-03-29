const { doCovidEquityData } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd, slackBotDelayedChatPost } = require('../common/slackBot');
const { isIdleDay, isFirstOccurrence } = require('../common/timeOffCheck');
const notifyChannel = 'C01BMCQK0F6'; // main channel
const debugChannel = 'C01DBP67MSQ'; // #testingbot

//const notifyChannel = 'C01H6RB99E2'; //Carter debug
//const debugChannel = 'C01H6RB99E2'; //Carter debug

module.exports = async function (context, myTimer) {
  const appName = context.executionContext.functionName;
  let slackPostTS = null;
  try {
    slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every Monday @ 8:00am -- should snooze unless first Monday after a Friday)`)).json()).ts;

    if (isIdleDay({weekends_off:true, holidays_off:true})
        || ! isFirstOccurrence(first_day = 'Mon', after_first = 'Fri')
       ) {
      await slackBotReplyPost(debugChannel, slackPostTS,`${appName} snoozed`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'zzz');
    } else {

      const Pr = await doCovidEquityData();

      if(Pr) {
        await slackBotReactionAdd(debugChannel, slackPostTS, 'package');
        await slackBotReplyPost(debugChannel, slackPostTS, Pr.html_url);

        //Delay post to main channel to allow for build time.
        const postTime = (new Date().getTime() + 1000 * 300) / 1000;
        await slackBotDelayedChatPost(notifyChannel,`Equity stats Update ready for review in https://staging.covid19.ca.gov/equity/ approve the PR here: \n${Pr.html_url}`, postTime);
    
      }

      await slackBotReplyPost(debugChannel, slackPostTS,`${appName} finished`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'white_check_mark');
    }
  } catch (e) {
    await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);

    if(slackPostTS) {
      await slackBotReplyPost(debugChannel, slackPostTS, `${appName} ERROR!`);
      await slackBotReactionAdd(debugChannel, slackPostTS, 'x');
    }
  }
};
