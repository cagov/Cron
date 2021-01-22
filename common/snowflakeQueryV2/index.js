const snowflake = require('snowflake-sdk');
//https://docs.snowflake.com/en/user-guide/nodejs-driver.html

const queryDataset = async (sql, connection) => {
    connection = connection || getDatabaseConnection();

    const dataPromise = new Promise((resolve, reject) => {
        connection.execute({
            sqlText : sql,
            complete: function(err, stmt, rows) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Successfully executed statement: ${stmt.getSqlText()}`);
                    resolve(rows);
                }
            }
        });
    });
    
    let result = [];

    await Promise.all([dataPromise])
        .then(async values => {
            result.push(values);
        });

    return result;
};

const getDatabaseConnection = () => {
    const attrs = JSON.parse(process.env["SNOWFLAKE_xxx"]);

    if (!attrs.username || !attrs.password) {
        //developers that don't set the creds can still use the rest of the code
        console.error('You need local.settings.json to contain "SNOWFLAKE_USER" & "SNOWFLAKE_PASS" to use the dataset features');
        return;
    }

    const connection = snowflake.createConnection(attrs);

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