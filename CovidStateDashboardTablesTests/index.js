const { doCovidStateDashboardTablesTests } = require('./worker');
const SlackConnector = require("@cagov/slack-connector");
const slackBotName = "Covid State Dashboard Tables - Tests"

//const notifyChannel = 'C01AA1ZB05B'; // #covid19-state-dash
//const debugChannel = 'C01DBP67MSQ'; // #testingbot
const debugChannel = process.env.debug ? "C01H6RB99E2" : 'C01DBP67MSQ' //#carter-dev vs #testingbot

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
    await slack.Chat(`${appName} (Every weekday @ 7:30am)`);
    const PrResults = await doCovidStateDashboardTablesTests(slack);

    if(PrResults) {
      await slack.Top.ReactionAdd('package');

      for (let Pr of PrResults) {
        await slack.Reply(Pr.html_url);
      }
    }

    await slack.Reply(`${appName} finished`);
    await slack.Top.ReactionAdd('white_check_mark');
  } catch (e) {
    await slack.Reply(`${appName} ERROR!`);
    await slack.Error(e,`${appName} finished`);
    await slack.Top.ReactionAdd('x');
    throw e;
  }
};
