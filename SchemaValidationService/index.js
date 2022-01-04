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

const fetch = require("fetch-retry")(require("node-fetch/lib"), {
    retries: 3,
    retryDelay: 2000
});


const { Validator, Schema } = require('jsonschema'); //https://www.npmjs.com/package/jsonschema

/** @type {Map<string,Schema>} */
const schemaCache = new Map();

/**
 * @typedef {object} Response
 * @property {number} [status]
 * @property {*} [body]
 * @property {{"Content-Type":string}} [headers]
 */

/**
 * @typedef {object} SchemaInput
 * @property {string} name
 * @property {string} schema_url
 * @property {*} content
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

    if (!req.body) {
        context.res = {
            body: `POST body missing.`,
            status: 422
        };
        return;
    }

    try {




        //POST
        /** @type {SchemaInput[]} */
        const input = req.body.input;



        const v = new Validator();

        const schemaUrls = [...new Set(input.map(i => i.schema_url))];

        const schemaPromises = [];


        schemaUrls.forEach(async u => {
            if (!schemaCache.has(u)) {
                schemaPromises
                    .push(fetch(u)
                        .then(async r => {
                            schemaCache.set(u, await r.json())
                        }));
            }
        });

        await Promise.all(schemaPromises);


        input.forEach(i => {
            const out = v.validate(i.content, schemaCache.get(i.schema_url));

            const x = 1;
        });


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
