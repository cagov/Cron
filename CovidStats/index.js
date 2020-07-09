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
	const dayBeforeYest = new Date()
	dayBeforeYest.setDate(dayBeforeYest.getDate() - 2)
	const dayBeforeYesterday = dayBeforeYest.toISOString().slice(0, 10);

	// SELECT * FROM "COVID"."OPEN_DATA"."STATEWIDE_CASES" where DATE(date) > '2020-06-30' -- starts yesterday
	// SELECT * FROM "COVID"."OPEN_DATA"."STATEWIDE_TESTING" where DATE(date) >= '2020-06-30'

	const testingData = new Promise((resolve, reject) => {
		let sqlStatement = `SELECT * FROM "COVID"."OPEN_DATA"."STATEWIDE_TESTING" where DATE(date) = '${yesterday}'`;
		connection.execute({
			sqlText: sqlStatement,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				resolve({"testing": rows[0]})
			}
		});
	});

	const yesterdayCaseData = new Promise((resolve, reject) => {
		connection.execute({
			sqlText: `SELECT * FROM "COVID"."OPEN_DATA"."STATEWIDE_CASES" where DATE(date) = '${yesterday}'`,
			complete: function(err, stmt, rows) {
				if (err) {
					console.error('Failed to execute statement due to the following error: ' + err.message);
				} else {
					console.log('Successfully executed statement: ' + stmt.getSqlText());
				}
				let totalDead = 0;
				let totalCases = 0;
				let newDead = 0;
				let newCases = 0;
				countyData = [];
				rows.forEach(row => {
					totalDead += row.TOTALCOUNTDEATHS;
					totalCases += row.TOTALCOUNTCONFIRMED;
					newDead += row.NEWCOUNTDEATHS;
					newCases += row.NEWCOUNTCONFIRMED;
					let truncatedObj = {};
					truncatedObj.TOTALCOUNTDEATHS = row.TOTALCOUNTDEATHS;
					truncatedObj.TOTALCOUNTCONFIRMED = row.TOTALCOUNTCONFIRMED;
					truncatedObj.COUNTY = row.COUNTY;
					truncatedObj.DATE = row.DATE;
					countyData.push(truncatedObj)	
				})
				resolve({"todayCases": {
					totalDead,
					totalCases,
					newDead,
					newCases,
					countyData
				}})
			}
		});
	});	

	let homeStats = {};

	await Promise.all([testingData, yesterdayCaseData]).then((values) => {
		let caseDiff = values[1].todayCases.newCases;
		let casePercentDiff = (caseDiff/(values[1].todayCases.totalCases - caseDiff) * 100).toFixed(1);
		let deathDiff = values[1].todayCases.newDead;
		let deathPercentDiff = (deathDiff/(values[1].todayCases.totalDead - deathDiff) * 100).toFixed(1);

		if(values[1].todayCases.totalCases > 80000) {
			homeStats["Table1"] = [
					{
						"0 – year": yesterday.split("-")[0],
						"1 – month": yesterday.split("-")[1],
						"2 – day": yesterday.split("-")[2],
						"3 – total cases": values[1].todayCases.totalCases.toLocaleString(),
						"4 – total cases increase": casePercentDiff,
						"5 – total deaths": values[1].todayCases.totalDead.toLocaleString(),
						"6 – total deaths increase": " "+deathPercentDiff,
						"7 - tests reported": values[0].testing.TESTED.toLocaleString()
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

	homeStats.writtenFileCount = writtenFileCount;
	context.res = {
		headers: {
			'Content-Type' : 'application/json'
		},
		body: JSON.stringify(homeStats)
	};

}