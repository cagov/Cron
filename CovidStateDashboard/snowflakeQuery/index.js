const snowflake = require('snowflake-sdk');

const queryDataset = async (sql, connection) => {
    connection = connection || getDatabaseConnection();
    if(!connection) return;

    const dataPromise = new Promise((resolve, reject) => {
        connection.execute({
            sqlText : sql,
            complete: function(err, stmt, rows) {
                if (err) {
                    throw new Error(err.message);
                } else {
                    console.log('Successfully executed statement: ' + stmt.getSqlText());
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
}

const getDatabaseConnection = () => {
    const attrs = {
        account: 'cdt.west-us-2.azure',
        username: process.env["SNOWFLAKE_USER"],
        password: process.env["SNOWFLAKE_PASS"],
        warehouse: 'COVID_CDPH_VWH'
    }

    if (!attrs.username || !attrs.password) {
        //developers that don't set the creds can still use the rest of the code
        console.error('You need local.settings.json to contain "SNOWFLAKE_USER" & "SNOWFLAKE_PASS" to use the dataset features');
        return;
    }

    const connection = snowflake.createConnection(attrs);

	// Try to connect to Snowflake, and check whether the connection was successful.
	connection.connect(function(err, conn) {
		if (err) {
            throw new Error('Unable to connect: ' + err.message);
		} else {
            console.log('Successfully connected to Snowflake.');
		}
    });

    return connection;
}

module.exports = {
    getDatabaseConnection,
    queryDataset
}