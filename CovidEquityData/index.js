const snowflake = require('snowflake-sdk');
const sha1 = require('sha1');
const githubApiUrl = "https://api.github.com/repos/cagov/covid-static/";
const githubBranch = "master";
const missingnessLoc = 'data/to-review/missingness/';
const {
    gitHubMessage,
    gitHubBranchCreate,
    gitHubBranchMerge,
    gitHubFileDelete,
    gitHubFileUpdate,
    gitHubFileAdd,
    gitHubFileGet,
    gitHubFileGetBlob
} = require('./gitHub');

module.exports = async function (context, req) {
	const AZURE_STORAGE_CONNECTION_STRING = process.env["AZURE_STORAGE_CONNECTION_STRING"];

	let attrs = {
		account: 'cdt.west-us-2.azure',
		username: process.env["SNOWFLAKE_USER"],
		password: process.env["SNOWFLAKE_PASS"],
        warehouse: 'COVID_CDPH_VWH',
        database: 'COVID'
	}
	var connection = snowflake.createConnection(attrs);
	// Try to connect to Snowflake, and check whether the connection was successful.
	connection.connect(function(err, conn) {
		if (err) {
				console.error('Unable to connect: ' + err.message);
		} else {
			console.log('Successfully connected to Snowflake.');
			// Optional: store the connection ID.
			connection_ID = conn.getId();
		}
	});

	const missingnessData = new Promise((resolve, reject) => {
        let sqlStatement = `select COUNTY, METRIC, MISSING, NOT_MISSING, TOTAL, PERCENT_COMPLETE from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS)`;
		connection.execute({
			sqlText: sqlStatement,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				resolve({"missingness": rows})
			}
		});
	});

	const cumulativeData = new Promise((resolve, reject) => {
		connection.execute({
			sqlText: `select COUNTY, DEMOGRAPHIC_SET, DEMOGRAPHIC_SET_CATEGORY, METRIC, METRIC_VALUE, METRIC_VALUE_PER_100K, REPORT_DATE, POPULATION from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE);`,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				resolve({"cumulative": rows})
			}
		});
	});	

	const socialData = new Promise((resolve, reject) => {
		connection.execute({
			sqlText: `select DATE, SOCIAL_DET, SOCIAL_TIER, SORT, CASES, POPULATION, CASE_RATE_PER_100K, STATE_CASE_RATE_PER_100K from PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET where DATE = (select max(DATE) from PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET)`,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				resolve({"social": rows})
			}
		});
	});	

	let allData = {};

	await Promise.all([missingnessData, cumulativeData, socialData]).then((values) => {
        allData = values;
	});

    let newBranchName = `data-${new Date().toISOString().split('T')[0]}-missingness`;
    await gitHubBranchCreate(newBranchName, githubBranch);

    const targetfiles = (await gitHubFileGet(missingnessLoc,newBranchName))
        .filter(x=>x.type==='file'&&(x.name.endsWith('.json'))); 

    //Add custom columns to targetfile data
    targetfiles.forEach(x=>{
        //just get the filename, special characters and all
        x.filename = x.url.split(`${missingnessLoc}`)[1].split('?ref')[0].toLowerCase();
    });

	let writtenFileCount = 0;

    let countyMissingNess = new Map();
    allData[0].missingness.forEach(item => {
        let countyInfo = countyMissingNess.get(item.COUNTY);
        if(!countyInfo) {
            countyInfo = {};
        }
        countyInfo[item.METRIC] = {};
        countyInfo[item.METRIC].MISSING = item.MISSING;
        countyInfo[item.METRIC].NOT_MISSING = item.NOT_MISSING;
        countyInfo[item.METRIC].TOTAL = item.TOTAL;
        countyInfo[item.METRIC].PERCENT_COMPLETE = item.PERCENT_COMPLETE;
        countyMissingNess.set(item.COUNTY,countyInfo)
    })
    
    async function putFile(value,key,callback) {
        const newFileName = `${key.toLowerCase().replace(/ /g,'')}.json`;
        const newFilePath = `${missingnessLoc}${newFileName}`;
        console.log('new file name is: '+newFilePath)
        const targetfile = targetfiles.find(y=>newFileName===y.filename);
        const content = Buffer.from(JSON.stringify(value)).toString('base64');
        const mysha = sha1(JSON.stringify(value));

        if(targetfile) {
            //UPDATE
            const targetcontent = await gitHubFileGetBlob(targetfile.sha);
            
            if(content!==targetcontent.content.replace(/\n/g,'')) {
                //Update file
                let message = `Update page - ${targetfile.name}`;
                const updateResult = await gitHubFileUpdate(content,targetfile.url,targetfile.sha,message,newBranchName)
                    .then(r => {
                        console.log(`UPDATE Success: ${newFileName}`);
                        return r;
                    });
                // await gitHubBranchMerge(branch, mergetarget);
                
            } else {
                console.log(`File compare matched: ${newFileName}`);
            }
        } else {
            let message = `Add page - ${newFileName}`;
                    
            const addResult = await gitHubFileAdd(content,newFilePath,message,newBranchName)
                .then(r => {console.log(`ADD Success: ${newFileName}`);return r;})   
                
            console.log(addResult)
        }
        callback();
    }

    // trying to run these one at a time to see if that lets them not interfere
    const iterator1 = countyMissingNess.keys();
    async function getNext() {
        let nextVal = iterator1.next().value;
        if(nextVal) {
            console.log('getting '+nextVal)
            putFile(countyMissingNess.get(nextVal),nextVal,getNext);    
        } else {
            console.log('done')
            await gitHubBranchMerge(newBranchName, githubBranch);
        }
    }
    getNext();


	allData.writtenFileCount = writtenFileCount;
	context.res = {
		headers: {
			'Content-Type' : 'application/json'
		},
		body: JSON.stringify(allData)
	};

}

/*module.exports = async function (context, myTimer) {
    var timeStamp = new Date().toISOString();
    
    if (myTimer.isPastDue)
    {
        context.log('JavaScript is running late!');
    }
    context.log('JavaScript timer trigger function ran!', timeStamp);   
};*/