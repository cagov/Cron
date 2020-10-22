const snowflake = require('snowflake-sdk');
const statsFileName = 'tableauCovidMetrics.json';

const {
    gitHubMessage,
    gitHubBranchCreate,
    gitHubBranchMerge,
    gitHubFileUpdate,
    gitHubFileGet,
    gitHubBranchExists,
    gitHubPrGetByBranchName
} = require('../gitHub');

const PrLabels = ['Automatic Deployment'];

//Check to see if we need stats update PRs, make them if we do.
const doDailyStatsPr = async mergetargets => {
    let sqlResults = null;
    const today = getTodayPacificTime().replace(/\//g,'-');

    for(const mergetarget of mergetargets) {
        const branch = `auto-stats-update-${mergetarget}-${today}`;

        if(await gitHubBranchExists(branch)) {console.log(`Branch "${branch}" found...skipping`); continue;} //branch exists, probably another process working on it...skip

        const PR = await gitHubPrGetByBranchName(mergetarget,branch);
        if(PR) {console.log(`PR "${branch}" found...skipping`); continue;}; //PR found, nothing to do

        sqlResults = sqlResults || await getStatsDataset(); //only run the query if needed
        if (sqlResults) {
            const content = Buffer.from(JSON.stringify([sqlResults],null,2)).toString('base64');
                
            await gitHubBranchCreate(branch,mergetarget);
            const targetfile = await gitHubFileGet(`pages/_data/${statsFileName}`,branch);
            await gitHubFileUpdate(content,targetfile.url,targetfile.sha,gitHubMessage(`${today} Update`,statsFileName),branch);
            const autoApproveMerge = mergetarget !== mergetargets[0]; //auto-push non-master
            await gitHubBranchMerge(branch,mergetarget,true,`${today} Stats Update`,PrLabels,autoApproveMerge);
        }
    }
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

const getTodayPacificTime = () =>
    new Date().toLocaleString("en-US", {year: 'numeric', month: 'numeric', day: 'numeric', timeZone: "America/Los_Angeles"});

const getStatsDataset = async () => {
    const connection = getDatabaseConnection();
    if(!connection) return;

    const statsPromise = new Promise((resolve, reject) => {
        const sqlText = `SELECT TOP 1 * from COVID.PRODUCTION.VW_TABLEAU_COVID_METRICS_STATEWIDE ORDER BY DATE DESC`;
        connection.execute({
            sqlText,
            complete: function(err, stmt, rows) {
                if (err) {
                    throw new Error(err.message);
                } else {
                    console.log('Successfully executed statement: ' + stmt.getSqlText());
                    resolve({"stats": rows[0]})
                }
            }
        });
    });
    
    let result = {}

    await Promise.all([statsPromise])
        .then(values => {
            result = values[0].stats;
        });

    return result;
}

module.exports = {
  doDailyStatsPr
}