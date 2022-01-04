// @ts-check

const debugChannel = "C01H6RB99E2"; //#carter-dev

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
 * @typedef {object} Response
 * @property {number} [status]
 * @property {*} [body]
 * @property {{"Content-Type":string}} [headers]
 */

/**
 * @param {{executionContext:{functionName:string},res:Response}} context
 * @param {{method:string,headers:{"user-agent":string},query?:*,params:*,body:*}} req
 */
module.exports = async function (context, req) {
    const SlackConnector = require("@cagov/slack-connector");
    const slack = new SlackConnector(slackBotGetToken(), debugChannel);

    if (req.method !== "POST") {
        context.res = {
            body: `Service is running, but is expecting a POST.`
        };
        return;
    }
    try {

        context.res = {
            status: 204 //OK - No content
        };
    } catch (e) {
        await slack.Error(e, req);

        context.res = {
            status: 500,
            body: `Error - ${e.message}`
        };
    }
};
