const { doWeeklyUpdatePrs } = require('../CovidWeeklyTierUpdate/doUpdate');
const { slackBotChatPost, slackBotReportError } = require('../common/slackBot');
const debugChannel = 'C01DBP67MSQ'; // 'C01AA1ZB05B';
const notifyChannel = 'C019DS5S6Q2'; // dimmer
const appName = 'CovidWeeklyTierUpdateHTTPTrigger';

module.exports = async function (context, req) {
    let activity = {};
    try {
        await slackBotChatPost(debugChannel,`${appName} ran`);

        const masterbranch='master', stagingbranch='staging';
        const mergetargets = [masterbranch,stagingbranch];

        activity.report = await doWeeklyUpdatePrs(mergetargets);

        for (const val of activity.report) {
            await slackBotChatPost(notifyChannel,`Tier Update Deployed\n${val.Pr.html_url}`);
        }

        await slackBotChatPost(debugChannel,`${appName} finished`);
    } catch (e) {
        await slackBotReportError(debugChannel,`Error running ${appName}`,e,context,myTimer);
    }
    context.res = {
        // status: 200, /* Defaults to 200 */
        body: JSON.stringify(activity)
    };
};