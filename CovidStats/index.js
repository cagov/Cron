const snowflake = require('snowflake-sdk');
const githubApiUrl = "https://api.github.com/repos/cagov/covid19/";
const githubBranch = "master";
const statsLoc = 'pages/_data/caseStats.json';
const addToGithub = require('./git.js');

module.exports = async function (context, req) {
	const AZURE_STORAGE_CONNECTION_STRING = process.env["AZURE_STORAGE_CONNECTION_STRING"];

	let attrs = {
		account: 'cdt.west-us-2.azure',
		username: process.env["SNOWFLAKE_USER"],
		password: process.env["SNOWFLAKE_PASS"],
		warehouse: 'COVID_CDPH_VWH'
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

	const today = new Date().toISOString().slice(0, 10);
	const yest = new Date()
	yest.setDate(yest.getDate() - 1)
	const yesterday = yest.toISOString().slice(0, 10);

	const testingData = new Promise((resolve, reject) => {
		let sqlStatement = `select * from COVID.PUBLIC.TESTING_TALL where DATE(date) > '${yesterday}'`;
		connection.execute({
			sqlText: sqlStatement,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				let output = {};
				rows.forEach(row => {
					if(row.TESTING === "Approximate Number of Tests Conducted") {
						output.totalTestsConducted = row.TESTED
					}
				})
				resolve({"testing": output})
			}
		});
	});
	const yesterdayCaseData = new Promise((resolve, reject) => {
		connection.execute({
			sqlText: `select * from COVID.PUBLIC.RUNNINGTOTALCASECOUNTS_TALL where DATE(date) = '${yesterday}'`,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				let totalDead = 0;
				let totalCases = 0;
				rows.forEach(row => {
					totalDead += row.NUMBERDIED;
					totalCases += row.TOTALCONFIRMED;	
				})
				resolve({"yesterdayCases": {
					totalDead,
					totalCases,
				}})
			}
		});
	});

	const todayCaseData = new Promise((resolve, reject) => {
		connection.execute({
			sqlText: `select * from COVID.PUBLIC.RUNNINGTOTALCASECOUNTS_TALL where DATE(date) = '${today}'`,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				let totalDead = 0;
				let totalCases = 0;
				countyData = [];
				rows.forEach(row => {
					totalDead += row.NUMBERDIED;
					totalCases += row.TOTALCONFIRMED;
					let truncatedObj = {};
					truncatedObj.NUMBERDIED = row.NUMBERDIED;
					truncatedObj.TOTALCONFIRMEDCASES = row.TOTALCONFIRMED;
					truncatedObj.COUNTY = row.COUNTY;
					truncatedObj.DATE = row.DATE;
					countyData.push(truncatedObj)	
				})
				resolve({"todayCases": {
					totalDead,
					totalCases,
					countyData
				}})
			}
		});
	});	

	let homeStats = {};

	await Promise.all([testingData, yesterdayCaseData, todayCaseData]).then((values) => {
		let caseDiff = values[2].todayCases.totalCases - values[1].yesterdayCases.totalCases;
		let casePercentDiff = (caseDiff/values[1].yesterdayCases.totalCases * 100).toFixed(1);
		let deathDiff = values[2].todayCases.totalDead - values[1].yesterdayCases.totalDead;
		let deathPercentDiff = (deathDiff/values[1].yesterdayCases.totalDead * 100).toFixed(1);
		values[2].todayCases.deadIncrease = deathPercentDiff;
		values[2].todayCases.caseIncrease = casePercentDiff;

		if(values[2].todayCases.totalCases > 80000) {
			homeStats["Table1"] = [
					{
						"0 – year": today.split("-")[0],
						"1 – month": today.split("-")[1],
						"2 – day": today.split("-")[2],
						"3 – total cases": values[2].todayCases.totalCases.toLocaleString(),
						"4 – total cases increase": casePercentDiff,
						"5 – total deaths": values[2].todayCases.totalDead.toLocaleString(),
						"6 – total deaths increase": " "+deathPercentDiff,
						"7 - tests reported": values[0].testing.totalTestsConducted.toLocaleString()
					}
				]
			}
			homeStats["All"] = values
	});

	let writtenFileCount = 0;
	await new Promise((resolve, reject) => {
		addToGithub(JSON.stringify(homeStats), githubBranch, githubApiUrl, statsLoc, (result) => {
			if(result) {
				writtenFileCount++;
				resolve(result);
			} else {
				reject(result);
			}
		})
	})
	
	if(writtenFileCount) {
		context.res = {
			headers: {
				'Content-Type' : 'application/json'
			},
			body: JSON.stringify(homeStats)
		};
	} else {
		context.res = {
			headers: {
				'Content-Type' : 'application/json'
			},
			body: JSON.stringify({"error":"failed to write to github"})
		};
	}

}

// select * from COVID.PUBLIC.DOF_COUNTYPOP
// CA Pop: 39740508