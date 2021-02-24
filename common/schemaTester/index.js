const fs = require('fs');


/**
 * Tests (Bad and Good) a JSON schema and then validates the data.  Throws an exception on failed validation.
 * @param {string} errorMessagePrefix Will display in front of error messages
 * @param {{}} [targetJSON] JSON object to validate, null if just checking tests
 * @param {string} schemafilePath JSON schema to use for validation
 * @param {string} [testGoodFilePath] Optional test data file that should pass
 * @param {string} [testBadFilePath] Optional test data file that should fail 
 */
const validateJSON = (errorMessagePrefix, targetJSON, schemafilePath, testGoodFilePath, testBadFilePath) => {
  const validateJSON_getMessage = err => `'${err.instance}' ${err.message}. Location - ${err.path.toString()}`;
  const validateJSON_getJsonFiles = path => 
    fs.readdirSync(`${__dirname}/${path}`)
      .map(f=>({name:f, json:JSON.parse(fs.readFileSync(`${__dirname}/${path}/${f}`))}));

      const Validator = require('jsonschema').Validator; //https://www.npmjs.com/package/jsonschema
      const v = new Validator();

  const schemaJSON = require(schemafilePath);

  validateJSON_getJsonFiles(testGoodFilePath)
    .forEach(({name,json})=> {
      const r = v.validate(json,schemaJSON);

      if (!r.valid) {
        logAndError(`Good JSON test is not 'Good' - ${validateJSON_getMessage(r.errors[0])} -  ${name}`);
      }
    }
  );

  validateJSON_getJsonFiles(testBadFilePath)
    .forEach(({name,json})=> {
          if (v.validate(json,schemaJSON).valid) {
            logAndError(`Bad JSON test is not 'Bad' - ${name}`);
          }
      }
    );

  if(targetJSON) {
    const primaryResult = v.validate(targetJSON,schemaJSON);

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