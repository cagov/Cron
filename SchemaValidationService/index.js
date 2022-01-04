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
const { ValidatorResultError } = require("jsonschema/lib/helpers");

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
                            if (r.ok) {
                                schemaCache.set(u, await r.json())
                            } else {
                                const body = await r.text();

                                throw new Error(
                                    `${r.status} - ${r.statusText} - ${r.url} - ${body}`
                                );
                            }
                        }));
            }
        });

        await Promise.all(schemaPromises);

        for (let i of input) {
            try {
                v.validate(i.content, schemaCache.get(i.schema_url), { throwFirst: true });
            } catch (e) {
                if (e instanceof ValidatorResultError) {
                    /** @type {ValidatorResultError} */
                    // @ts-ignore
                    const r = e;
                    const e1 = r.errors[0];
                    const body = {
                        name: i.name,
                        message: e1.stack
                    }
                    if (typeof (e1.instance) === "string") {
                        body.value = e1.instance;
                    }
                    if (e1.path.length) {
                        body.path = e1.path.join('/');
                    }

                    context.res = {
                        body

                    };
                    return
                } else {
                    //Non validation error
                    throw e;
                }
            }
        };

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
