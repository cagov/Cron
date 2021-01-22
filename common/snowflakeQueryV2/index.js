const snowflake = require('snowflake-sdk');
//https://docs.snowflake.com/en/user-guide/nodejs-driver.html

//runs a name/SQL object and returns a matching object with name/Results 
const queryDataset = async (sqlWork, connection) => {
    if(!connection) {
        console.error('connection is required : use getDatabaseConnection.');
        return;
    }

    const singleResult = typeof sqlWork === 'string';
    const queries = singleResult ? {RESULT1 : sqlWork} : sqlWork;

    const dataPromises = [];
    for(let name of Object.keys(queries)) {
        dataPromises.push(getDbPromise(connection,name,queries[name]));
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

//creates a new Snowflake Db Promise witht the result set name
const getDbPromise = (connection, name, sqlText) => new Promise((resolve, reject) => {
    connection.execute({
        sqlText,
        complete: function(err, stmt, rows) {
            if (err) {
                console.error(`Failed to execute statement due to the following error: ${err.message}`);
                reject(`Failed to execute statement due to the following error: ${err.message}`);
            } else {
                console.log(`Successfully executed statement: ${stmt.getSqlText()}`);
                const result = {};
                result[name] = rows;
                resolve(result);
            }
        }
    });
});

const getDatabaseConnection = ConnectionOptions => {
    if (!ConnectionOptions.username || !ConnectionOptions.password || !ConnectionOptions.account  | !ConnectionOptions.warehouse) {
        //developers that don't set the creds can still use the rest of the code
        console.error('You need local.settings.json to contain a JSON connection string {account,warehouse,username,password} to use the dataset features');
        return;
    }

    const connection = snowflake.createConnection(ConnectionOptions);

    // Try to connect to Snowflake, and check whether the connection was successful.
    connection.connect(err => {
        if (err) {
            console.error(err);
        } else {
            console.log('Successfully connected to Snowflake.');
        }
    });

    return connection;
};

module.exports = {
    getDatabaseConnection,
    queryDataset
};