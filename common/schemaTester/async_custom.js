//@ts-check

const moment = require("moment");

const {Validator,ValidatorResult} = require('jsonschema'); //https://www.npmjs.com/package/jsonschema

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

/**
 * @param {threadWork} mywork 
 * @param {number} [threadId]
 */
 const async_thread_target_function = (mywork, threadId) => {
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
  
    return resultData;
  }

  module.exports = {
    async_thread_target_function
  }