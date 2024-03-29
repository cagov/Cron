//Loading environment variables
const { Values } = require("../local.settings.json");
Object.keys(Values).forEach(x => (process.env[x] = Values[x])); //Load local settings file for testing

process.env.debug = false; //set to false or remove to run like the real instance
const repeatCount = parseInt(process.argv.slice(2));

const context = { executionContext: { functionName: "debug" }, 
                  done: function() { console.log("Done function called"); } };

//run the indexpage async
const indexCode = require("./index");

(async () => {
    console.log("Testing beginning");
    await indexCode(context,{method:'POST'});
    console.log("Testing ending");
})();
