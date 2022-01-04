//Loading environment variables
const { Values } = require("../local.settings.json");
Object.keys(Values).forEach(x => (process.env[x] = Values[x])); //Load local settings file for testing

process.env.debug = true; //set to false or remove to run like the real instance
const repeatCount = parseInt(process.argv.slice(2));

const { SchemaInput } = require("./index");
/** @type {SchemaInput[]} */
const input = [
    {
        name: "File 1",
        schema_url: "https://raw.githubusercontent.com/cagov/Cron/c4abfbbe1beeb139fd8ca76b0d9faef5e71d143a/SchemaValidationService/testSchema.json",
        content: require("./testData.json")
    }
];

const req = {
    method: 'POST',
    body: {
        input
    }
};
const context = { executionContext: { functionName: "debug" }, res: undefined };

//run the indexpage async
const indexCode = require("./index");

(async () => {
    for (let step = 0; step < repeatCount; step++) {
        console.log(`****** Iteration ${step + 1} ******`);
        await indexCode(context, req, []);
        console.log(context.res);
    }
})();
