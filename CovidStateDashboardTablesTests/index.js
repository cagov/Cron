//@ts-check
const { doCovidStateDashboardTablesTests } = require('./worker');
const { isIdleDay } = require('../common/timeOffCheck');

const SlackConnector = require("@cagov/slack-connector");
const slackBotName = "Covid State Dashboard Tables - Tests"

//const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
//const debugChannel = 'C01DBP67MSQ'; // #testingbot (renamed to #odi-engineering-bot-covid19-cron)
const debugChannel = process.env.debug ? "C02J16U50KE" : 'C01DBP67MSQ' //#jbum-testing vs #testingbot

const slackBotGetToken = () => {
  const token = process.env["SLACKBOT_TOKEN"];

  if (!token) {
      //developers that don't set the creds can still use the rest of the code
      console.error('You need local.settings.json to contain "SLACKBOT_TOKEN" to use slackbot features.');
      return;
  }

  return token;
};

/**
 * @param {{executionContext:{functionName:string}}} context
 */
module.exports = async function (context) {
  const appName = context.executionContext.functionName;
  const slack = new SlackConnector(slackBotGetToken(), debugChannel, {username:slackBotName});

  try {
    await slack.Chat(`${appName} (Every Thursday @ 7:30am)`);

    if (isIdleDay({weekends_off:true, holidays_off:true})) {
      await slack.Reply(`${appName} snoozed (weekend or holiday)`);
      await slack.Top.ReactionAdd('zzz');
    } else {
      const PrResults = await doCovidStateDashboardTablesTests(slack);

      if(PrResults) {
        await slack.Top.ReactionAdd('package');

        for (let PrUrl of PrResults) {
          await slack.Reply(PrUrl);
        }
      }
      await slack.Reply(`${appName} finished`);
      await slack.Top.ReactionAdd('white_check_mark');
    }
  } catch (e) {
    await slack.Reply(`${appName} ERROR!`);
    await slack.Error(e,`${appName} finished`);
    await slack.Top.ReactionAdd('x');
    throw e;
  }
};
