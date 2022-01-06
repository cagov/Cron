//@ts-check

const moment = require("moment");

const {
  Worker, isMainThread, parentPort, threadId
} = require('worker_threads');

const { Validator, ValidatorResult } = require('jsonschema'); //https://www.npmjs.com/package/jsonschema

/**
 * @typedef {object} threadWork
 * @property {string} name
 * @property { {} } targetJSON 
 * @property { {} } schemaJSON 
 */

/**
 * @typedef {object} threadResult
 * @property {number} threadId
 * @property {string} name
 * @property {ValidatorResult} result
 */

if (isMainThread) {
  /**
   * validates a list of work on mutliple threads
   * @param {threadWork[]} work 
   * @param {number} max_threads 
   * @returns {Promise<threadResult[]>}
   */
  module.exports = (work, max_threads) =>
    new Promise((resolve, reject) => {
      let threadTotal = Math.min(work.length, max_threads);

      const expectedResults = work.length;

      /** @type {threadResult[]} */
      let results = [];

      for (let i = 0; i < threadTotal; i++) {
        let worker = new Worker(__filename);

        let workHandler = (/** @type {threadResult} */ m) => {
          if (m) {
            results.push(m);
          }

          worker.postMessage(work.pop()); //null work will tell the worker to exit

          if (results.length === expectedResults) {
            resolve(results);
          }
        };

        worker.on('online', workHandler);
        worker.on('message', workHandler);
        worker.on('error', reject);
        worker.on('exit', code => {
          if (code !== 0)
            reject(new Error(`Worker stopped with exit code ${code}`));
        });
      }
    })

} else {
  parentPort.on("message", (/** @type {threadWork} */ mywork) => {
    if (mywork) {
      //console.log(`validating ${mywork.name} on ${threadId}`);

      let v = new Validator();

      //Reparse to simplify any Javascript objects like dates
      Date.prototype.toJSON = function () {
        return moment(this).format('YYYY-MM-DD')
      }

      let targetObject = JSON.parse(JSON.stringify(mywork.targetJSON));

      /** @type {threadResult} */
      let resultData = {
        threadId,
        name: mywork.name,
        result: v.validate(targetObject, mywork.schemaJSON)
      }

      //console.log(`validating ${mywork.name} on ${threadId}...complete`);
      parentPort.postMessage(resultData);
    } else {
      process.exit(); //nothing to do...ok to stop thread
    }
  });
}