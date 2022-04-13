const fs = require('fs');
const snowflake = require('snowflake-sdk');
// const fetchRetry = require('fetch-retry')(require('node-fetch'), {retries:3,retryDelay:2000});
const fetch = require('node-fetch');
//https://docs.snowflake.com/en/user-guide/nodejs-driver.html

/**
 * Pull a SQL string out of the snowflakeSqlQueries folder
 * @param {string} path - relative filename (without sql extention)
 * @example
 * const sql = getSQL('CDT_COVID/Metrics');
 * 
 */
const getSQL = path =>
  fs.readFileSync(`${__dirname}/../SQL/${path}.sql`).toString();

/**
 * Runs a name/SQL object and returns a matching object with name/Results.
 * @example
 * const sqlWork = {
 *     myFirstDataset: `select * from data`,
 *     mySecondDataset: `select * from otherdata`
 * }
 * @param {(string|{})} sqlWork single SQL statement string OR name/sql attributes.
 * @param {string|snowflake.Connection} connection connection string OR active snowflake.Connection.
 */
const queryDataset = async (sqlWork, connection) => {
    if(!connection) {
        throw new Error('connection is required : use getDatabaseConnection.');
    }


    var ConnectionOptionsObj = typeof connection === 'string' ? JSON.parse(connection) : connection;

    // if oauth param is in there, get a token and set up oauth params first...
    if ('client_id' in ConnectionOptionsObj) {
        console.log("Obtaining OAuth Token");
        const token = await getToken(ConnectionOptionsObj);
        if (token) {
            console.log("Token obtained");
        } else {
            throw new Error('OAuth token not obtained.');
        }

        // reset parameters for OAuth connection
        ConnectionOptionsObj.token = token;
        ConnectionOptionsObj.authenticator = 'OAUTH';
        ConnectionOptionsObj.client_session_keep_alive = true;
        ConnectionOptionsObj.max_connection_pool = 20;
        // delete this for security
        if ('password' in ConnectionOptionsObj) {
            delete ConnectionOptionsObj['password'];
        }
    }

    console.log("Getting Connection");

    const activeConnection = getDatabaseConnection(ConnectionOptionsObj); //Will return the same connection if it is already one

    console.log("Got Connection");


    const singleResult = typeof sqlWork === 'string';
    const queries = singleResult ? {RESULT1 : sqlWork} : sqlWork;

    const dataPromises = [];
    for(let name of Object.keys(queries)) {
        dataPromises.push(getDbPromise(activeConnection,name,queries[name]));
    }

    const resultDatasets = await Promise.all(dataPromises);

    const result = {};

    //flatten results
    for(let promiseResult of resultDatasets) {
        for(let name of Object.keys(promiseResult)) {
            result[name] = promiseResult[name];
        }
    }

    return singleResult ? result.RESULT1 : result;
};

/**
 * creates a new Snowflake Db Promise with the result set name.
 * @param {snowflake.Connection} connection Active snowflake.Connection.
 * @param {string} name Result set name to return
 * @param {string} sqlText Query to execute
 */
const getDbPromise = (connection, name, sqlText) => new Promise((resolve, reject) => {
    console.log("Getting DB Promise");
    connection.execute({
        sqlText,
        complete: function(err, stmt, rows) {
            if (err) {
                console.error(`Failed to execute statement: ${stmt.getSqlText()}`);
                reject(err);
            } else {
                console.log(`Successfully executed statement: ${stmt.getSqlText()}`);
                const result = {};
                result[name] = rows;
                resolve(result);
            }
        }
    });
});

/**
 * Fetches an OAuth token using the supplied connection parameters.
 * @param {*} ConnectionOptionsObj 
 * @returns 
 */

const getToken = async (ConnectionOptionsObj) => {
    const AUTH_GRANT_TYPE = 'password';
    const SCOPE_URL = "https://1ac25458-542c-4ecb-8105-36c15005b656/session:role-any";
    const TOKEN_URL = "https://login.microsoftonline.com/1f311b51-f6d9-4153-9bac-55e0ef9641b8/oauth2/v2.0/token";
    const   HEADERS = {
        'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'Fetch/ODI'
    };

    // dict payload
    const dict_payload = {
        grant_type:AUTH_GRANT_TYPE,
        client_id:ConnectionOptionsObj.client_id,
        username:ConnectionOptionsObj.username,
        password:ConnectionOptionsObj.password,
        scope:SCOPE_URL};
    var elems = [];
    for (var key in dict_payload) { // doing this to ensure correct encoding...
        elems.push(encodeURIComponent(key) + '=' + encodeURIComponent(dict_payload[key]));
    }
    const payload = elems.join('&');

    // note: the token service does NOT appear to support application/json for the payload.
    return fetch(TOKEN_URL, {
          method: "POST",
          headers: HEADERS,
          body: payload,
              })
        .then((response) => response.json())
        .then((data) => { return data.access_token; } );
 };


/**
 * Returns a configured snowflake.Connection
 * @param {string|snowflake.ConnectionOptions|snowflake.Connection} ConnectionOptions a connection string OR an object with connection info
 * @example let conn = getDatabaseConnection(JSON.parse(process.env["MY_CONNECTION_STRING"]));
 * @example 
 * let conn = getDatabaseConnection({account:"MYACCOUNT", warehouse:"MYWAREHOUSE", username:"MYUSER", password:"12345"});
 */


const getDatabaseConnection = (ConnectionOptions) => {
    var ConnectionOptionsObj = typeof ConnectionOptions === 'string' ? JSON.parse(ConnectionOptions) : ConnectionOptions;
    if(ConnectionOptionsObj.connect) { //already a connection
        return ConnectionOptionsObj;
    }

    if ((!ConnectionOptionsObj.token && !ConnectionOptionsObj.password) ||
        !ConnectionOptionsObj.username ||
        !ConnectionOptionsObj.account || !ConnectionOptionsObj.warehouse) {
        throw new Error('You need local.settings.json to contain a JSON connection string {account,warehouse,username,password/token} to use the dataset features');
    }

    const connection = snowflake.createConnection(ConnectionOptionsObj);

    // Try to connect to Snowflake, and check whether the connection was successful.
    connection.connect(err => {
        if (err) {
            console.error(err);
        } else {
            console.log(`Successfully connected to Snowflake (${ConnectionOptionsObj.account}-${ConnectionOptionsObj.warehouse}).`);
        }
    });

    return connection;
};

module.exports = {
    getDatabaseConnection,
    queryDataset,
    getDbPromise,
    getSQL
};