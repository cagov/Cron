const snowflake = require('snowflake-sdk');
const sha1 = require('sha1');
const githubApiUrl = "https://api.github.com/repos/cagov/covid-static/";
const githubBranch = "master";
const stagingFileLoc = 'data/to-review/equitydash/';
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

const fs = require('fs')

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
    
    // cumulative for R/E per 100K, R/E by % pop. there used to be a REPORT_DATE here and we used to have to do where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE); but that has been removed and we expect a single cumulative value here now
	const cumulativeData = new Promise((resolve, reject) => {
		connection.execute({
			sqlText: `select * from PRODUCTION.VW_CDPH_DEMOGRAPHIC_RATE_CUMULATIVE`,
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

    // statewide stats for comparison
	const statewideData = new Promise((resolve, reject) => {
		connection.execute({
            sqlText: `select AGE_GROUP, GENDER, RACE_ETHNICITY, POPULATION, SF_LOAD_TIMESTAMP from COVID.PRODUCTION.CDPH_STATIC_DEMOGRAPHICS where SF_LOAD_TIMESTAMP = (select max(SF_LOAD_TIMESTAMP) from PRODUCTION.CDPH_STATIC_DEMOGRAPHICS)`,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				resolve({"statewide": rows})
			}
		});
    });

	const missingnessData = new Promise((resolve, reject) => {
        let sqlStatement = `select COUNTY, METRIC, MISSING, NOT_MISSING, TOTAL, PERCENT_COMPLETE, PERCENT_COMPLETE_30_DAYS_PRIOR, PERCENT_COMPLETE_30_DAYS_DIFF, REPORT_DATE from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS)`;
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
    // missingness sexual orientation, gender identity
	const missingnessSOGIData = new Promise((resolve, reject) => {
        let sqlStatement = `select COUNTY, SOGI_CATEGORY, METRIC,MISSING, NOT_MISSING, TOTAL,PERCENT_COMPLETE, PERCENT_COMPLETE_30_DAYS_AGO, DIFF_30_DAY,REPORT_DATE from PRODUCTION.VW_CDPH_SOGI_COMPLETENESS where REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS)`;
		connection.execute({
			sqlText: sqlStatement,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				resolve({"missingnessSOGI": rows})
			}
		});
    });

	const socialData = new Promise((resolve, reject) => {
		connection.execute({
            sqlText: `select DATE, SOCIAL_DET, SOCIAL_TIER, SORT, CASES_7DAYAVG_7DAYSAGO, POPULATION, CASE_RATE_PER_100K, STATE_CASE_RATE_PER_100K, CASE_RATE_PER_100K_30_DAYS_AGO, RATE_DIFF_30_DAYS from PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET where DATE = (select max(DATE) from PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET)`,
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
    
    // equity metric line chart
	const healthEquityData = new Promise((resolve, reject) => {
		connection.execute({
            sqlText: `select COUNTY, DATE, METRIC, METRIC_VALUE, METRIC_VALUE_30_DAYS_AGO, METRIC_VALUE_DIFF from COVID.PRODUCTION.VW_EQUITY_METRIC_POS_30_DAY_BY_CNT`,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				resolve({"healthequity": rows})
			}
		});
    });	

	let allData = {};

	await Promise.all([missingnessData, cumulativeData, socialData, statewideData, missingnessSOGIData, healthEquityData]).then((values) => {
        allData = values;
	});

    let newBranchName = `data-${new Date().toISOString().split('T')[0]}-equitydash`;
    await gitHubBranchCreate(newBranchName, githubBranch);

    const targetfiles = (await gitHubFileGet(stagingFileLoc,newBranchName))
        .filter(x=>x.type==='file'&&(x.name.endsWith('.json'))); 

    //Add custom columns to targetfile data
    targetfiles.forEach(x=>{
        //just get the filename, special characters and all
        x.filename = x.url.split(`${stagingFileLoc}`)[1].split('?ref')[0].toLowerCase();
    });

	let writtenFileCount = 0;

    let allFilesMap = new Map();
    // this is combining cases, testing and deaths metrics
    allData[0].missingness.forEach(item => {
        let mapKey = `missingness-${item.COUNTY}`;
        let countyInfo = allFilesMap.get(mapKey);
        if(!countyInfo) {
            countyInfo = {};
            countyInfo.race_ethnicity = {};
        }
        countyInfo.race_ethnicity[item.METRIC] = item;
        allFilesMap.set(mapKey,countyInfo)
    })
    // combining sogi missingness with regular missingness so I can write less files
    allData[4].missingnessSOGI.forEach(item => {
        let mapKey = `missingness-${item.COUNTY}`;
        let countyInfo = allFilesMap.get(mapKey);
        if(!countyInfo) {
            countyInfo = {};
        }
        if(!countyInfo[item.SOGI_CATEGORY]) {
            countyInfo[item.SOGI_CATEGORY] = {};
        }
        countyInfo[item.SOGI_CATEGORY][item.METRIC] = {};
        countyInfo[item.SOGI_CATEGORY][item.METRIC].MISSING = item.MISSING;
        countyInfo[item.SOGI_CATEGORY][item.METRIC].NOT_MISSING = item.NOT_MISSING;
        countyInfo[item.SOGI_CATEGORY][item.METRIC].TOTAL = item.TOTAL;
        countyInfo[item.SOGI_CATEGORY][item.METRIC].PERCENT_COMPLETE = item.PERCENT_COMPLETE;
        countyInfo[item.SOGI_CATEGORY][item.METRIC].PERCENT_COMPLETE_30_DAYS_DIFF = item.DIFF_30_DAY;
        countyInfo[item.SOGI_CATEGORY][item.METRIC].REPORT_DATE = item.REPORT_DATE;
        allFilesMap.set(mapKey,countyInfo)
    })


    // for cumulative go through all, add each county to map with cumulative key, all records for that county should be in that one file
    allData[1].cumulative.forEach(item => {
        let mapKey = `cumulative-${item.COUNTY}`;
        let countyInfo = allFilesMap.get(mapKey);
        if(!countyInfo) {
            countyInfo = [];
        }

        item.SORT_METRIC = item.METRIC_TOTAL_PERCENTAGE / item.POPULATION_PERCENTAGE;
        item.METRIC_TOTAL_DELTA = 100 - item.METRIC_TOTAL_PERCENTAGE;
        item.POPULATION_PERCENTAGE_DELTA = 100 - item.POPULATION_PERCENTAGE;
        item.WORST_VALUE = [...allData[1].cumulative].reduce((a, e ) => e["METRIC_VALUE_PER_100K"] > a["METRIC_VALUE_PER_100K"] ? e : a).METRIC_VALUE_PER_100K;
        item.LOWEST_VALUE = [...allData[1].cumulative].filter(item => item["METRIC_VALUE_PER_100K"] != null).reduce((a, e ) => e["METRIC_VALUE_PER_100K"] < a["METRIC_VALUE_PER_100K"] ? e : a).METRIC_VALUE_PER_100K;
        item.WORST_VALUE_DELTA = item.WORST_VALUE - item.METRIC_VALUE_PER_100K;
        item.PCT_FROM_LOWEST_VALUE = item.METRIC_VALUE_PER_100K / item.LOWEST_VALUE;
        countyInfo.push(item)
        allFilesMap.set(mapKey,countyInfo)
    })

    // social data should all go in one file
    allData[2].social.forEach(item => {
        let mapKey = `social-data-${item.SOCIAL_DET}`;
        let countyInfo = allFilesMap.get(mapKey);
        if(!countyInfo) {
            countyInfo = [];
        }
        countyInfo.push(item)
        allFilesMap.set(mapKey,countyInfo)
    })

    // healthequity data
    allData[5].healthequity.forEach(item => {
        let mapKey = `healthequity-${item.COUNTY}`;
        let countyInfo = allFilesMap.get(mapKey);
        if(!countyInfo) {
            countyInfo = {};
        }
        if(!countyInfo[item.METRIC]) {
            countyInfo[item.METRIC] = [];
        }
        countyInfo[item.METRIC].push(item);        
        allFilesMap.set(mapKey,countyInfo)
    })

    // write one file for statewide data
    let statewideMapKey = `statewide-data`;
    let statewidePopData = [];
    allData[3].statewide.forEach(item => {
        statewidePopData.push(item)
    })
    allFilesMap.set(statewideMapKey,statewidePopData)

    // this fails unless it runs one at a time
    const iterator1 = allFilesMap.keys();
    async function getNext() {
        let nextVal = iterator1.next().value;
        if(nextVal) {
            console.log('getting '+nextVal)
            putFile(allFilesMap.get(nextVal),nextVal,getNext);    
        } else {
            console.log('done')
            await gitHubBranchMerge(newBranchName, githubBranch);
        }
    }
    getNext();


    // reusable file write function
    async function putFile(value,key,callback) {
        const newFileName = `${key.toLowerCase().replace(/ /g,'')}.json`;
        const newFilePath = `${stagingFileLoc}${newFileName}`;
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