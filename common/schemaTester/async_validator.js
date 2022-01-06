//@ts-check

const moment = require("moment");
let totalcount = { totalcount: 0 }
const {
  Worker, isMainThread, parentPort, workerData
} = require('worker_threads');

if (isMainThread) {
  /**
   * @param { {} } targetJSON 
   * @param { {} } schemaJSON 
   */
  module.exports = (targetJSON, schemaJSON) =>
    new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { targetJSON, schemaJSON, mycount: totalcount.totalcount++ }
      });
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', code => {
        if (code !== 0)
          reject(new Error(`Worker stopped with exit code ${code}`));
      });
    })

} else {
  /** @type {{ targetJSON:*, schemaJSON:*, mycount:number}} */
  const { targetJSON, schemaJSON, mycount } = workerData;

  console.log(`validating ${mycount}`);

  const Validator = require('jsonschema').Validator; //https://www.npmjs.com/package/jsonschema
  const v = new Validator();

  //Reparse to simplify any Javascript objects like dates

  Date.prototype.toJSON = function () {
    return moment(this).format('YYYY-MM-DD')
  }

  const primaryResult = v.validate(JSON.parse(JSON.stringify(targetJSON)), schemaJSON);

  parentPort.postMessage(primaryResult);

  console.log(`validating ${mycount} Complete`);
}