//@ts-check
const { queryDataset } = require('../common/snowflakeQuery');
const { validateJSON2, getSqlWorkAndSchemas } = require('../common/schemaTester');
const { GitHubTreePush, TreePushTreeOptions, TreeFileRunStats } = require("@cagov/github-tree-push");
const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString("en-CA", { timeZone: "America/Los_Angeles", ...options });
const todayDateString = () => nowPacTime({ year: 'numeric', month: '2-digit', day: '2-digit' });
//const PrLabels = ['Automatic Deployment', 'Add to Rollup', 'Publish at 9:15 a.m. ☀️'];
const PrLabels = ['Do not publish 🚫'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
const githubPath = 'data/dashboard';
const targetBranch = 'carter_dev_statedashcron_main'
const stagingBranch = 'carter_dev_statedashcron_staging';
const doInputValidation = false;
const doOutputValidation = true;
const sqlRootPath = '../SQL/CDT_COVID/CovidStateDashboardTables/';
const stagingOnly = false; //Set to true to only work on staging

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

const regionList = ["California", "Alameda", "Alpine", "Amador", "Butte", "Calaveras", "Colusa", "Contra Costa", "Del Norte", "El Dorado", "Fresno", "Glenn", "Humboldt", "Imperial", "Inyo", "Kern", "Kings", "Lake", "Lassen", "Los Angeles", "Madera", "Marin", "Mariposa", "Mendocino", "Merced", "Modoc", "Mono", "Monterey", "Napa", "Nevada", "Orange", "Placer", "Plumas", "Riverside", "Sacramento", "San Benito", "San Bernardino", "San Diego", "San Francisco", "San Joaquin", "San Luis Obispo", "San Mateo", "Santa Barbara", "Santa Clara", "Santa Cruz", "Shasta", "Sierra", "Siskiyou", "Solano", "Sonoma", "Stanislaus", "Sutter", "Tehama", "Trinity", "Tulare", "Tuolumne", "Ventura", "Yolo", "Yuba"];

const PrInfoList = [
    {
        title: "Covid Dashboard Tables - Tests",
        folders: [
            "total-tests",
            "positivity-rate"
        ]
    },
    {
        title: "Covid Dashboard Tables - Patients",
        folders: [
            "patients",
            "icu-beds"
        ]
    },
    {
        title: "Covid Dashboard Tables - Cases/Deaths",
        folders: [
            "confirmed-cases",
            "confirmed-deaths"
        ]
    }
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

const doCovidStateDashboardTables = async () => {
    const token = getGitHubToken();

    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath, 'schema/input/[file]/schema.json', 'schema/input/[file]/sample.json', 'schema/input/[file]/fail/', 'schema/output/');

    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork, process.env["SNOWFLAKE_CDT_COVID"]);
    if (doInputValidation) {
        Object.keys(sqlWorkAndSchemas.schema).forEach(file => {
            const schemaObject = sqlWorkAndSchemas.schema[file];
            const targetJSON = allData[file];
            //require('fs').writeFileSync(`${file}_sample.json`, JSON.stringify(targetJSON,null,2), 'utf8');
            console.log(`Validating - ${file}`);
            validateJSON2(`${file} - failed SQL input validation`, targetJSON, schemaObject.schema, schemaObject.passTests, schemaObject.failTests);
        });
    }

    /** @type {Map<string,*>} */
    let allFilesMap = new Map();

    regionList.forEach(myRegion => {
        let regionFileName = myRegion.toLowerCase().replace(/ /g, '_');
        let hospitals_and_icus_byRegion = allData.hospitals_and_icus.filter(f => f.REGION === myRegion);

        if (hospitals_and_icus_byRegion.length) {
            const latestData = hospitals_and_icus_byRegion[0];

            allFilesMap.set(`patients/${regionFileName}.json`,
                {
                    meta: {
                        PUBLISHED_DATE: todayDateString(),
                        coverage: myRegion
                    },
                    data: {
                        latest: {
                            HOSPITALIZED_PATIENTS: {
                                TOTAL: latestData.HOSPITALIZED_PATIENTS,
                                CHANGE: latestData.HOSPITALIZED_PATIENTS_CHANGE,
                                CHANGE_FACTOR: latestData.HOSPITALIZED_PATIENTS_CHANGE_FACTOR,
                                POPULATION: latestData.POPULATION
                            },
                            ICU_PATIENTS: {
                                TOTAL: latestData.ICU_PATIENTS,
                                CHANGE: latestData.ICU_PATIENTS_CHANGE,
                                CHANGE_FACTOR: latestData.ICU_PATIENTS_CHANGE_FACTOR,
                                POPULATION: latestData.POPULATION
                            }
                        },
                        time_series: {
                            HOSPITALIZED_PATIENTS: getDateValueRows(hospitals_and_icus_byRegion, 'HOSPITALIZED_PATIENTS'),
                            ICU_PATIENTS: getDateValueRows(hospitals_and_icus_byRegion, 'ICU_PATIENTS'),
                            HOSPITALIZED_PATIENTS_14_DAY_AVG: getDateValueRows(hospitals_and_icus_byRegion, 'HOSPITALIZED_PATIENTS_14_DAY_AVG'),
                            ICU_PATIENTS_14_DAY_AVG: getDateValueRows(hospitals_and_icus_byRegion, 'ICU_PATIENTS_14_DAY_AVG')
                        }
                    }
                });

            allFilesMap.set(`icu-beds/${regionFileName}.json`,
                {
                    meta: {
                        PUBLISHED_DATE: todayDateString(),
                        coverage: myRegion
                    },
                    data: {
                        latest: {
                            ICU_BEDS: {
                                TOTAL: latestData.ICU_AVAILABLE_BEDS,
                                CHANGE: latestData.ICU_AVAILABLE_BEDS_CHANGE,
                                CHANGE_FACTOR: latestData.ICU_AVAILABLE_BEDS_CHANGE_FACTOR,
                                POPULATION: latestData.POPULATION
                            }
                        },
                        time_series: {
                            ICU_BEDS: getDateValueRows(hospitals_and_icus_byRegion, 'ICU_AVAILABLE_BEDS')
                        }
                    }
                });
        } //if(hospitals_and_icus_byRegion.length>0)

        let summary_by_region = allData.summary_by_region.find(f => f.REGION === myRegion);
        let rows_by_region = allData.cases_deaths_tests_rows.filter(f => f.REGION === myRegion);
        if (summary_by_region && rows_by_region.length) {
            // precompute daily average cases for last 7 non-pending days - jbum
            let sumCasesCount = 0;
            let CONFIRMED_CASES_EPISODE_DATE = getDateValueRows(rows_by_region, 'CASES');
            const pending_dateC = summary_by_region.EPISODE_UNCERTAINTY_PERIOD.toISOString().split("T")[0];
            const caseList = CONFIRMED_CASES_EPISODE_DATE.VALUES;
            let parse_state = 0;
            let summed_days = 0;
            for (let i = 0; i < caseList.length; ++i) {
                if (parse_state == 0) {
                    if (caseList[i].DATE.toISOString().split("T")[0] == pending_dateC) {
                        parse_state = 1;
                    }
                } else {
                    sumCasesCount += caseList[i].VALUE;
                    summed_days += 1;
                }
                if (summed_days == 7) {
                    break;
                }
            }
            let CASES_DAILY_AVERAGE = summed_days > 0 ? sumCasesCount / summed_days : NaN;
            // if(myRegion == 'California') {
            //     console.log("CASES DAILY AVG",CASES_DAILY_AVERAGE,myRegion,summed_days,pending_dateC);
            // }
            // precompute daily average deaths for last 7 non-pending days - jbum
            let sumDeathsCount = 0;
            let CONFIRMED_DEATHS_DEATH_DATE = getDateValueRows(rows_by_region, 'DEATHS')
            const pending_dateD = summary_by_region.DEATH_UNCERTAINTY_PERIOD.toISOString().split("T")[0];
            const deathsList = CONFIRMED_DEATHS_DEATH_DATE.VALUES;
            parse_state = 0;
            summed_days = 0;
            for (let i = 0; i < deathsList.length; ++i) {
                if (parse_state == 0) {
                    if (deathsList[i].DATE.toISOString().split("T")[0] == pending_dateD) {
                        parse_state = 1;
                    }
                } else {
                    sumDeathsCount += deathsList[i].VALUE;
                    summed_days += 1;
                }
                if (summed_days == 7) {
                    break;
                }
            }
            let DEATHS_DAILY_AVERAGE = summed_days > 0 ? sumDeathsCount / summed_days : NaN;

            allFilesMap.set(`confirmed-cases/${regionFileName}.json`,
                {
                    meta: {
                        PUBLISHED_DATE: todayDateString(),
                        coverage: myRegion
                    },
                    data: {
                        latest: {
                            CONFIRMED_CASES: {
                                total_confirmed_cases: summary_by_region.total_confirmed_cases,
                                new_cases: summary_by_region.new_cases,
                                new_cases_delta_1_day: summary_by_region.new_cases_delta_1_day,
                                cases_per_100k_7_days: summary_by_region.cases_per_100k_7_days,
                                EPISODE_UNCERTAINTY_PERIOD: summary_by_region.EPISODE_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION,
                                CASES_DAILY_AVERAGE: CASES_DAILY_AVERAGE
                            }
                        },
                        time_series: {
                            CONFIRMED_CASES_EPISODE_DATE: CONFIRMED_CASES_EPISODE_DATE,
                            CONFIRMED_CASES_REPORTED_DATE: getDateValueRows(rows_by_region, 'REPORTED_CASES'),
                            AVG_CASE_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_CASE_RATE_PER_100K_7_DAYS'),
                            AVG_CASE_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_CASE_REPORT_RATE_PER_100K_7_DAYS')
                        }
                    }
                });

            allFilesMap.set(`confirmed-deaths/${regionFileName}.json`,
                {
                    meta: {
                        PUBLISHED_DATE: todayDateString(),
                        coverage: myRegion
                    },
                    data: {
                        latest: {
                            CONFIRMED_DEATHS: {
                                total_confirmed_deaths: summary_by_region.total_confirmed_deaths,
                                new_deaths: summary_by_region.new_deaths,
                                new_deaths_delta_1_day: summary_by_region.new_deaths_delta_1_day,
                                deaths_per_100k_7_days: summary_by_region.deaths_per_100k_7_days,
                                DEATH_UNCERTAINTY_PERIOD: summary_by_region.DEATH_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION,
                                DEATHS_DAILY_AVERAGE: DEATHS_DAILY_AVERAGE
                            }
                        },
                        time_series: {
                            CONFIRMED_DEATHS_DEATH_DATE: CONFIRMED_DEATHS_DEATH_DATE,
                            CONFIRMED_DEATHS_REPORTED_DATE: getDateValueRows(rows_by_region, 'REPORTED_DEATHS'),
                            AVG_DEATH_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_DEATH_RATE_PER_100K_7_DAYS'),
                            AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS')
                        }
                    }
                });

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
        //Validate tree output
        console.log(`Validating ${allFilesMap.size} output files.`);

        for (let [fileName, content] of allFilesMap) {
            let rootFolder = fileName.split('/')[0];
            let schema = sqlWorkAndSchemas.outputSchema.find(f => rootFolder === f.name);

            if (schema) {
                validateJSON2(`${fileName} failed validation`, content, schema.json);
            } else {
                throw new Error(`Missing validator for ${fileName}.`);
            }
        }

        console.log(`Validation of output complete.`);
    }

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

        resultStats.push(await treeObject_staging.treePush());
        if (!stagingOnly) resultStats.push(await treeObject_main.treePush());
    }

    let PrList = resultStats.filter(r => r.Pull_Request_URL).map(r => r.Pull_Request_URL);

    return PrList.length ? PrList : null;
};


module.exports = {
    doCovidStateDashboardTables
};