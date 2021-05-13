const { doTranslationPrUpdate  } = require('./worker');
const { doAutoApprover } = require('./AutoApprover');
const { slackBotReportError, slackBotChatPost, slackBotReactionAdd, slackBotReplyPost } = require('../common/slackBot');
//const notifyChannel = 'C01AA1ZB05B';
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const appName = 'CovidTranslationPrApproval';
const masterbranch='master';

module.exports = async function (context, myTimer) {
try {
  //await slackBotChatPost(debugChannel,`${appName} ran`);

  await doTranslationPrUpdate(masterbranch);
  let report = await doAutoApprover(masterbranch);

  if(report.approvals.length || report.labels.length || report.skips.length) {
    let slackPostTS = (await (await slackBotChatPost(debugChannel,`AutoApprover results`)).json()).ts;

    if(report.labels.length) {
      await slackBotReactionAdd(debugChannel, slackPostTS, 'label');

      for(let url of report.labels) {
        await slackBotReplyPost(debugChannel, slackPostTS, `Labeled\n${url}`);
      }
    }

    if(report.approvals.length) {
      await slackBotReactionAdd(debugChannel, slackPostTS, 'white_check_mark');

      for(let url of report.approvals) {
        await slackBotReplyPost(debugChannel, slackPostTS, `Approved\n${url}`);
      }
    }

    if(report.skips.length) {
      await slackBotReactionAdd(debugChannel, slackPostTS, 'no_entry');

      for(let url of report.skips) {
        await slackBotReplyPost(debugChannel, slackPostTS, `Skipped\n${url}`);
      }
    }
  }

  //await slackBotChatPost(debugChannel,`${appName} finished`);

} catch (e) {
  await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
}
};