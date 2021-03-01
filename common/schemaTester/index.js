const fs = require('fs');

//https://json-schema.org/understanding-json-schema/
//https://www.jsonschemavalidator.net/

const validateJSON_getMessage = err => `'${JSON.stringify(err.instance)}' ${err.message}. Location - ${err.path.toString()}`;

const validateJSON_getJsonFiles = path => 
  fs.readdirSync(`${__dirname}/${path}`)
    .map(f=>({name:f, json:JSON.parse(fs.readFileSync(`${__dirname}/${path}/${f}`))}));

const mergeJSON = (target,stub) => {
  if(stub === null || stub === undefined || typeof stub !== 'object' ) {
    return stub;
  }

  const targetCopy = JSON.parse(JSON.stringify(target));
  Object.keys(stub).forEach(k=>{
    targetCopy[k] = mergeJSON(targetCopy[k],stub[k]);
  });
  return targetCopy;
};

/**
 * Tests (Bad and Good) a JSON schema and then validates the data.  Throws an exception on failed validation.
 * @param {string} errorMessagePrefix Will display in front of error messages
 * @param {{}} [targetJSON] JSON object to validate, null if just checking tests
 * @param {string} schemafilePath JSON schema to use for validation
 * @param {string} [testGoodFilePath] Optional test data file that should pass
 * @param {string} [testBadFilePath] Optional test data file that should fail 
 */
const validateJSON = (errorMessagePrefix, targetJSON, schemafilePath, testGoodFilePath, testBadFilePath) => {
  const Validator = require('jsonschema').Validator; //https://www.npmjs.com/package/jsonschema
  const v = new Validator();

  const schemaJSON = require(schemafilePath);

  let latestGoodData = {};
  validateJSON_getJsonFiles(testGoodFilePath)
    .forEach(({name,json})=> {
      const r = v.validate(json,schemaJSON);

      if (!r.valid) {
        logAndError(`Good JSON test is not 'Good' - ${validateJSON_getMessage(r.errors[0])} -  ${name}`);
      }

      latestGoodData = json;
    }
  );

  validateJSON_getJsonFiles(testBadFilePath)
    .forEach(({name,json})=> {
        const merged = mergeJSON(latestGoodData,json);

        if (v.validate(merged,schemaJSON).valid) {
          logAndError(`Bad JSON test is not 'Bad' - ${name}`);
        }
      }
    );

  if(targetJSON) {
    //Reparse to simplify any Javascript objects like dates
    const primaryResult = v.validate(...targetJSON,schemaJSON);

    if (!primaryResult.valid) {
      logAndError(`${errorMessagePrefix} - ${validateJSON_getMessage(primaryResult.errors[0])}`);
    }
  }
};

/**
 * Logs an error message before throwing the message as an Error
 * @param {string} message Error message to display
 */
const logAndError  = message => {
  console.error(message);
  throw new Error(message);
};

module.exports = {
  validateJSON
};