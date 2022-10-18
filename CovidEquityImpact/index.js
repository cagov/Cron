const { doCovidEquityImpact } = require('./worker');
const { slackBotChatPost, slackBotReportError, slackBotReplyPost, slackBotReactionAdd } = require('../common/slackBot');
const { isIdleDay } = require('../common/timeOffCheck');
const debugChannel = 'C01DBP67MSQ'; // #testingbot

module.exports = async function (context, myTimer) {
    const appName = context.executionContext.functionName;

    let slackPostTS = null;
    try {
        slackPostTS = (await (await slackBotChatPost(debugChannel,`${appName} (Every Thursday @ 8:05am -- should snooze unless first Wednesday after a Friday)`)).json()).ts;

        if (isIdleDay({weekends_off:true, holidays_off:true, check_first_wed_after_fri:true})) {
            await slackBotReplyPost(debugChannel, slackPostTS,`${appName} snoozed`);
            await slackBotReactionAdd(debugChannel, slackPostTS, 'zzz');
        } else {

            const TreeRunResults = await doCovidEquityImpact(false);

            if (TreeRunResults.Pull_Request_URL) {
                const prMessage = `Weekly Equity Impact data ready\n${TreeRunResults.Pull_Request_URL}`;
                await slackBotReplyPost(debugChannel, slackPostTS, prMessage);
                await slackBotReactionAdd(debugChannel, slackPostTS, 'package');
                await slackBotChatPost(debugChannel, prMessage);
            }

            await slackBotReplyPost(debugChannel, slackPostTS,`${appName} finished`);
            await slackBotReactionAdd(debugChannel, slackPostTS, 'white_check_mark');
        }
    } catch (e) {
        await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);

        if (slackPostTS) {
            await slackBotReplyPost(debugChannel, slackPostTS, `${appName} ERROR!`);
            await slackBotReactionAdd(debugChannel, slackPostTS, 'x');
        }
    }
};
