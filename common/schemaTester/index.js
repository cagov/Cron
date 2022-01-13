const fs = require('fs');

const async_validator = require('./async_thread');
const {threadResult, threadWork} = require('./async_custom');

const fetch = require("fetch-retry")(require("node-fetch/lib"), {
  retries: 3,
  retryDelay: 2000
});

//https://json-schema.org/understanding-json-schema/
//https://www.jsonschemavalidator.net/

const getSqlWorkAndSchemas_getFileNames = passTestPath =>
      (passTestPath.endsWith('/') 
      ? fs.readdirSync(passTestPath).map(testFile=>passTestPath+testFile)
      : [passTestPath])
    .filter(f=>fs.existsSync(f))
    .map (testPath=>({
        name:testPath.split('/').pop(),
        json:JSON.parse(fs.readFileSync(testPath))}));

const getSqlWorkAndSchemas = (sqlPath, schemaPathFormat, PassTestPathFormat, FailTestPathFormat, outputSchemaPath) => {
  const sqlFullPath = `${__dirname}/${sqlPath}`;
  const sqlFiles = fs.readdirSync(sqlFullPath)
      .filter(f=>f.endsWith('.sql'))
      .map(filename=>({name: filename.replace(/\.sql$/,''), filename, fullfilename:`${sqlFullPath}/${filename}`}));

  const JsonOutput = {
    DbSqlWork:{},
    schema:{},
    outputSchema: []
  };

  if(outputSchemaPath) {
    JsonOutput.outputSchema = fs.readdirSync(sqlFullPath+outputSchemaPath)
    .filter(f=>f.endsWith('.json'))
    .map(filename=>({name: filename.replace(/\.json$/,''), json: JSON.parse(fs.readFileSync(`${sqlFullPath}${outputSchemaPath}${filename}`))}));
  }


  sqlFiles.forEach(sql=>{
    JsonOutput.DbSqlWork[sql.name] = fs.readFileSync(sql.fullfilename).toString();

    if(schemaPathFormat) {
      const schemaPath =  sqlFullPath + schemaPathFormat.replace(/\[file\]/,sql.name);
      if(fs.existsSync(schemaPath)) {

        const newSchema = {
          schema : JSON.parse(fs.readFileSync(schemaPath))
        };

        if(PassTestPathFormat) {
          let PassTestPath = sqlFullPath + PassTestPathFormat.replace(/\[file\]/,sql.name);
          if (fs.existsSync(PassTestPath)) {
            newSchema.passTests = getSqlWorkAndSchemas_getFileNames(PassTestPath);
          }
        }

        if(FailTestPathFormat) {
          let FailTestPath = sqlFullPath + FailTestPathFormat.replace(/\[file\]/,sql.name);
          if (fs.existsSync(FailTestPath)) {
            newSchema.failTests = getSqlWorkAndSchemas_getFileNames(FailTestPath);
          }
        }

        JsonOutput.schema[sql.name] = newSchema;
      }
    }
  });

  return JsonOutput;
};


const validateJSON_getMessage = err =>
  `${err.stack} (${err.name}).\nValue = ${JSON.stringify(err.instance).substring(0, 50)}`;

const validateJSON_getJsonFiles = path => 
(
  fullpath => 
    (fs.lstatSync(fullpath).isDirectory()
    ? fs.readdirSync(fullpath)
      .map(name=>({name, fullfilename:`${fullpath}/${name}`}))
    : [{name:path, fullfilename:fullpath}])
      .map(f=>({name:f.name, json:JSON.parse(fs.readFileSync(f.fullfilename))}))
)(`${__dirname}/${path}`);

const mergeJSON = (target,stub) => {
  if(stub === null || stub === undefined || typeof stub !== 'object') {
    return stub;
  }

  if(Array.isArray(stub)) {
    const targetCopy = target === undefined || target === null ? [] : [...target]; //deep copy
    stub.forEach((a,i)=>{
      targetCopy[i] = mergeJSON(targetCopy[i],stub[i]);
    });
    return targetCopy;
  } else {
    const targetCopy = {...target}; //deep copy
    Object.keys(stub).forEach(k=>{
      targetCopy[k] = mergeJSON(targetCopy[k],stub[k]);
    });
    return targetCopy;
  }
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
  validateJSON2(
      errorMessagePrefix,
      targetJSON,
      require(schemafilePath),
      testGoodFilePath ? validateJSON_getJsonFiles(testGoodFilePath) : null,
      testBadFilePath ? validateJSON_getJsonFiles(testBadFilePath) : null
      );
};


/**
 * Tests (Bad and Good) a JSON schema and then validates the data.  Throws an exception on failed validation.
 * @param {string} errorMessagePrefix Will display in front of error messages
 * @param {{}} [targetJSON] JSON object to validate, null if just checking tests
 * @param {{}} schemaJSON JSON schema to use for validation
 * @param {[]} [testGoodFiles] Optional test data file that should pass
 * @param {[]} [testBadFiles] Optional test data file that should fail 
 */
 const validateJSON2 = (errorMessagePrefix, targetJSON, schemaJSON, testGoodFiles, testBadFiles) => {
  const Validator = require('jsonschema').Validator; //https://www.npmjs.com/package/jsonschema
  const v = new Validator();

  if (testGoodFiles) {
    let latestGoodData = {};
    testGoodFiles
      .forEach(({name,json})=> {
        //console.log({name,json});
        const r = v.validate(json,schemaJSON);
  
        if (!r.valid) {
          logAndError(`${errorMessagePrefix} - Good JSON test is not 'Good' - ${validateJSON_getMessage(r.errors[0])} -  ${name}`);
        }
  
        latestGoodData = json;
      }
    );
  
    if(testBadFiles) {
      testBadFiles
        .forEach(({name,json})=> {
          //console.log({name,json});
          const merged = mergeJSON(latestGoodData,json);
          const r = v.validate(merged,schemaJSON);

          if (r.valid) {
            logAndError(`${errorMessagePrefix} - Bad JSON test is not 'Bad' - ${name}`);
          }
        }
      );
    }
  }


  if(targetJSON) {
    //Reparse to simplify any Javascript objects like dates
    const primaryResult = v.validate(JSON.parse(JSON.stringify(targetJSON)),schemaJSON);

    if (!primaryResult.valid) {
      logAndError(`${errorMessagePrefix} - ${validateJSON_getMessage(primaryResult.errors[0])}`);
    }
  }
};

/**
 * Tests (Bad and Good) a JSON schema and then validates the data.  Throws an exception on failed validation.
 * @param {string} errorMessagePrefix Will display in front of error messages
 * @param {threadWork[]} work An array of work to process
 * @param {number} [max_threads] Number of threads to process work.  Too many threads creates overhead.  Blank to detect.
 * @returns {Promise<threadResult[]>}
 */
 const validateJSON_Async = async (errorMessagePrefix, work, max_threads) => new Promise(async (resolve, reject) =>
 async_validator(work, max_threads)
   .then(results => {
     results.forEach(result => {
       if (result.result.errors.length) {
         const message = `${errorMessagePrefix} - ${result.name} - ${validateJSON_getMessage(result.result.errors[0])}`;
         reject(message);
         return;
       }
     });
     resolve();
   })
   .catch(reason => {
      reject(reason);
  })
);

/**
 * @typedef {object} ValidationServiceWorkRow
 * @property {string} name
 * @property {*} content
 */

/**
 * @typedef {object} ValidationServiceBody
 * @property {Schema} schema
 * @property {ValidationServiceWorkRow[]} work
 */
const remoteValidatorURL = "https://kzg1dzzr6f.execute-api.us-west-1.amazonaws.com/default/jsonValidator";
/**
 * Tests (Bad and Good) a JSON schema and then validates the data.  Throws an exception on failed validation.
 * @param {string} errorMessagePrefix Will display in front of error messages
 * @param {ValidationServiceWorkRow[]} work An array of work to process
 */
 const validateJSON_Remote = async (errorMessagePrefix, schema, work) => new Promise(async (resolve, reject) => {
   /** @type {ValidationServiceBody} */
  const bodyJSON = {
    schema,
    work
  };

  const bodyBase64 = Buffer.from(JSON.stringify(bodyJSON), 'utf-8').toString('base64');

  const bodylength = Buffer.byteLength(bodyBase64);
  if(bodylength>5000000) {
    console.log(`Sending ${bodyJSON.work.length} work items with a request size of ${bodylength} bytes. 6MB max!`);
  }

  return fetch(remoteValidatorURL,{method:"POST", body:bodyBase64})
    .then(async result=>{
      if(result.status!==204) {
        const text = await result.text();
        reject(errorMessagePrefix + ':' + text);
      }
    
      resolve();
    })
 });


/**
 * Logs an error message before throwing the message as an Error
 * @param {string} message Error message to display
 */
const logAndError  = message => {
  console.error(message);
  throw new Error(message);
};

/**
 * Returns an array separated into smaller arrays
 * @param {*[]} array
 * @param {number} chunk
 */
const splitArrayIntoChunks = (array, chunk) => {
  let results = [];

  for (let i = 0, j = array.length; i < j; i += chunk) {
    results.push(array.slice(i, i + chunk));
  }

  return results;
}

module.exports = {
  validateJSON,
  validateJSON2,
  validateJSON_Async,
  validateJSON_Remote,
  getSqlWorkAndSchemas,
  splitArrayIntoChunks
};