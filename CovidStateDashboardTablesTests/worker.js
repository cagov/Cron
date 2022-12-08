//@ts-check
const { queryDataset } = require('../common/snowflakeQuery');
const { splitArrayIntoChunks, getSqlWorkAndSchemas, validateJSON_Remote, ValidationServiceWorkRow } = require('../common/schemaTester');
const { GitHubTreePush, TreePushTreeOptions, TreeFileRunStats } = require("@cagov/github-tree-push");
const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString("en-CA", { timeZone: "America/Los_Angeles", ...options });
const todayDateString = () => nowPacTime({ year: 'numeric', month: '2-digit', day: '2-digit' });
const PrLabels = ['Automatic Deployment', 'Add to Rollup', 'Publish at 9:15 a.m. ☀️'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
const githubPath = 'data/dashboard-new';
const targetBranch = 'main'
const stagingBranch = 'CovidStateDashboardTables_Staging';
const doInputValidation = true;
const doOutputValidation = true;
const sqlRootPath = '../SQL/CDT_COVID/CovidStateDashboardTablesTests/';
const stagingOnly = false; //Set to true to only work on staging

const regionList = ["California", "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa", "Del Norte", "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo", "Kern", "Kings", "Lake", "Lassen", "Los Angeles", "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa", "Nevada", "Orange", "Placer", "Plumas", "Riverside", "Sacramento", "San Benito", "San Bernardino", "San Diego", "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo", "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta", "Sierra", "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama", "Trinity", "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba"];

const getGitHubToken = () => {
    const token = process.env["GITHUB_TOKEN"];

    if (!token) {
        //developers that don't set the creds can still use the rest of the code
        console.error(
            `You need local.settings.json to contain "GITHUB_TOKEN" to use GitHub features.`
        );
        return;
    }

    return token;
};

const PrInfoList = [
    {
        title: "Covid Dashboard Tables - Tests",
        folders: [
            "total-tests",
            "positivity-rate"
        ]
    },
];

const getDateValueRows = (dataset, valueColumnName) => {
    let DateValueRange = dataset
        .filter(m => m[valueColumnName] !== null) //0s are ok
        .map(m => m.DATE);

    let MINIMUM = DateValueRange[DateValueRange.length - 1];
    let MAXIMUM = DateValueRange[0];

    return {
        DATE_RANGE: {
            MINIMUM,
            MAXIMUM
        },
        VALUES: dataset
            .filter(f => f.DATE >= MINIMUM && f.DATE <= MAXIMUM)
            .map(m => ({ DATE: m.DATE, VALUE: m[valueColumnName] ?? 0 }))
    };
};

const SlackConnector = require("@cagov/slack-connector");

/**
 * Does a slack reply if slack is defined
 * @param {SlackConnector | undefined} slack
 * @param {string} message
 */
const slackIfConnected = async (slack, message) =>  slack ? slack.Reply(message) : null;

/**
 * 
 * @param {SlackConnector} [slack] 
 */
const doCovidStateDashboardTablesTests = async (slack) => {
    const token = getGitHubToken();

    await slackIfConnected(slack, 'Scanning for schemas...');
    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath, 'schema/input/[file]/schema.json', 'schema/input/[file]/sample.json', 'schema/input/[file]/fail/', 'schema/output/');

    await slackIfConnected(slack, 'Running queries...');
    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork, process.env["SNOWFLAKE_CDTCDPH_COVID_OAUTH"]);
    if (doInputValidation) {
        await slackIfConnected(slack, 'Validating input...');

        let promises = [];

        for(let file of Object.keys(sqlWorkAndSchemas.schema)) {
            const schemaObject = sqlWorkAndSchemas.schema[file].schema;
            const targetJSON = allData[file];
            //require('fs').writeFileSync(`${file}_sample.json`, JSON.stringify(targetJSON,null,2), 'utf8');

            splitArrayIntoChunks(targetJSON, 5000).forEach((a, i) => {
                /** @type {ValidationServiceWorkRow[]} */
                const workForValidation = [];

                /** @type {ValidationServiceWorkRow} */
                let newWork = {
                    name: file + i,
                    content: a
                };

                workForValidation.push(newWork)

                promises.push(validateJSON_Remote("failed validation", schemaObject, workForValidation));
            })
        }
        console.log(`Validating input...`);
        await Promise.all(promises)
            .catch(reason => {
                throw new Error(reason);
            });

        console.log(`Validating input...done`);
    }

    await slackIfConnected(slack, 'Converting Data...');

    /** @type {Map<string,*>} */
    let allFilesMap = new Map();

    regionList.forEach(myRegion => {
        let regionFileName = myRegion.toLowerCase().replace(/ /g, '_');

        let summary_by_region = allData.summary_by_region.find(f => f.REGION === myRegion);
        let rows_by_region = allData.tests_rows.filter(f => f.REGION === myRegion);
        if (summary_by_region && rows_by_region.length) {
            allFilesMap.set(`total-tests/${regionFileName}.json`,
                {
                    meta: {
                        PUBLISHED_DATE: todayDateString(),
                        coverage: myRegion
                    },
                    data: {
                        latest: {
                            TOTAL_TESTS: {
                                total_tests_performed: summary_by_region.total_tests_performed,
                                new_tests_reported: summary_by_region.new_tests_reported,
                                new_tests_reported_delta_1_day: summary_by_region.new_tests_reported_delta_1_day,
                                avg_total_tests_7_days: summary_by_region.latest_confident_avg_total_tests_7_days,
                                TESTING_UNCERTAINTY_PERIOD: summary_by_region.TESTING_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION
                            }
                        },
                        time_series: {
                            TOTAL_TESTS: getDateValueRows(rows_by_region, 'TOTAL_TESTS'),
                            REPORTED_TESTS: getDateValueRows(rows_by_region, 'REPORTED_TESTS'),
                            AVG_TEST_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_TEST_RATE_PER_100K_7_DAYS'),
                            AVG_TEST_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_TEST_REPORT_RATE_PER_100K_7_DAYS')
                        }
                    }
                });

            allFilesMap.set(`positivity-rate/${regionFileName}.json`,
                {
                    meta: {
                        PUBLISHED_DATE: todayDateString(),
                        coverage: myRegion
                    },
                    data: {
                        latest: {
                            POSITIVITY_RATE: {
                                test_positivity_7_days: summary_by_region.test_positivity_7_days,
                                test_positivity_7_days_delta_7_days: summary_by_region.test_positivity_7_days_delta_7_days,
                                TESTING_UNCERTAINTY_PERIOD: summary_by_region.TESTING_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION
                            }
                        },
                        time_series: {
                            TEST_POSITIVITY_RATE_7_DAYS: getDateValueRows(rows_by_region, 'TEST_POSITIVITY_RATE_7_DAYS'),
                            DAILY_TEST_POSITIVITY_RATE: getDateValueRows(rows_by_region, 'DAILY_TEST_POSITIVITY_RATE'),
                            TOTAL_TESTS: getDateValueRows(rows_by_region, 'TOTAL_TESTS')
                        }
                    }
                });
        } //if(summary_by_region.length)
    });

    if (doOutputValidation) {
        await slackIfConnected(slack, 'Validating Output...');
        //Validate tree output
        let promises = [];

        for(let outputSchema of sqlWorkAndSchemas.outputSchema) {
            /** @type {ValidationServiceWorkRow[]} */
            const workForValidation = [];

            for (let [fileName, content] of allFilesMap) {
                let rootFolder = fileName.split('/')[0];

                if(outputSchema.name===rootFolder) {
                    /** @type {ValidationServiceWorkRow} */
                    let newWork = {
                        name: fileName,
                        content
                    };

                    workForValidation.push(newWork)
                }
            }
            splitArrayIntoChunks(workForValidation, 20).forEach(a => {
                promises.push(validateJSON_Remote("failed validation", outputSchema.json, a));
            })
        }

        console.log(`Validating output...${allFilesMap.size} files...`);
        await Promise.all(promises)
            .catch(reason => {
                throw new Error(reason);
            });

        console.log(`Validating output...done`);
    }
    //console.log('planned stop here'); return; throw new Error("STOP");

    /** @type {TreePushTreeOptions} */
    let defaultTreeOptions = {
        repo: githubRepo,
        owner: githubOwner,
        path: githubPath,
        base: targetBranch,
        removeOtherFiles: false
    };

    //Filter the tree and create Prs
    /** @type {TreeFileRunStats[]} */
    const resultStats = [];

    for (let PrInfo of PrInfoList) {
        /** @type {TreePushTreeOptions} */
        let options_main = {
            ...defaultTreeOptions,
            commit_message: PrInfo.title,
            pull_request: true,
            pull_request_options: {
                title: `${todayDateString()} ${PrInfo.title}`,
                automatic_merge: false,
                issue_options: {
                    labels: PrLabels
                }
            }
        };
        /** @type {TreePushTreeOptions} */
        let options_staging = {
            ...defaultTreeOptions,
            commit_message: PrInfo.title,
            base: stagingBranch,
            pull_request: false
        };
        let treeObject_main = new GitHubTreePush(token, options_main);
        let treeObject_staging = new GitHubTreePush(token, options_staging);

        let filterFiles = [...allFilesMap.keys()].filter(t => PrInfo.folders.some(f => t.startsWith(f)));
        filterFiles.forEach(f => {
            let json = allFilesMap.get(f);
            treeObject_main.syncFile(f, json);
            treeObject_staging.syncFile(f, json);
        });

        await slackIfConnected(slack, 'Pushing Staging...');
        resultStats.push(await treeObject_staging.treePush());
        if (!stagingOnly) {
            await slackIfConnected(slack, 'Pushing Main...');
            resultStats.push(await treeObject_main.treePush());
        }
    }

    let PrList = resultStats.filter(r => r.Pull_Request_URL).map(r => r.Pull_Request_URL);

    return PrList.length ? PrList : null;
};


module.exports = {
    doCovidStateDashboardTablesTests
};
