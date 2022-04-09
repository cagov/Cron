// debugging trigger

const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const slackDebugChannel = 'C02J16U50KE'; // #jim-testing
const appName = 'CovidTestTrigger';

module.exports = async function (context, req) {

    let slackPostTS = null;

    try { // The entire module
        // const appName = context.executionContext.functionName;
        slackPostTS = (await (await slackBotChatPost(slackDebugChannel,`${appName} triggered`)).json()).ts;
        await slackBotReplyPost(slackDebugChannel, slackPostTS,`${appName} started`);


        await slackBotReactionAdd(slackDebugChannel, slackPostTS, 'white_check_mark');

    } // End Try for the entire module
    catch (e) {
      //some error in the app.  Report it to slack.
      const errorTitle = `Problem running ${appName}`;
      if (slackPostTS) {
        let slackText = `${errorTitle}\n*Error Stack*\n\`\`\`${e.stack}\`\`\``;
        slackText += `\n\n*Request*\n\`\`\`${JSON.stringify(req,null,2)}\`\`\``;
        await slackBotReplyPost(slackDebugChannel, slackPostTS, slackText);
        await slackBotReactionAdd(slackDebugChannel, slackPostTS, 'x');
    } else {
          await slackBotReportError(slackDebugChannel,errorTitle,e,req);
      }
  
      context.res = {
        body: `<html><title>${errorTitle}</title><body><h1>${errorTitle}</h1><h2>Error Text</h2><pre>${e.stack}</pre><h2>Original Request</h2><pre>${JSON.stringify(req,null,2)}</pre></body></html>`,
        status: 500,
        headers: {
          'Content-Type' : 'text/html'
        }
      };
    }
    context.done();
}
