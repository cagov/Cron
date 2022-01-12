

const {
  Worker, isMainThread, parentPort, threadId
} = require('worker_threads');


const { async_thread_target_function, threadWork, threadResult } = require("./async_custom");

const os = require("os"); //for grabbing count of CPUs

if (isMainThread) {
  /**
   * validates a list of work on mutliple threads
   * @param {threadWork[]} work List of data to send to `async_thread_target_function`
   * @param {number} [max_threads] Number of CPUs to use.  Blank to detect.
   * @returns {Promise<threadResult[]>}
   */
  module.exports = (work, max_threads) =>
    new Promise((resolve, reject) => {
      max_threads = max_threads ?? Math.floor(os.cpus().length / 2)

      let threadTotal = Math.min(work.length, max_threads);

      if (!threadTotal) {
        reject('No work to do.');
      } else if (threadTotal === 1) {
        //inline
        resolve(work.map(w => async_thread_target_function(w, 0)));
      } else {
        //multi-thread
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
      }
    })

} else {
  parentPort.on("message", (/** @type {*} */ mywork) => {
    if (mywork) {
      let result = async_thread_target_function(mywork, threadId);

      parentPort.postMessage(result);
    } else {
      process.exit(); //nothing to do...ok to stop thread
    }
  });
}