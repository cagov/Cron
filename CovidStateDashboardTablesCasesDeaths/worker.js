//@ts-check
const { queryDataset } = require('../common/snowflakeQuery');
const { validateJSON2, getSqlWorkAndSchemas } = require('../common/schemaTester');
const { GitHubTreePush, TreePushTreeOptions, TreeFileRunStats } = require("@cagov/github-tree-push");
const nowPacTime = (/** @type {Intl.DateTimeFormatOptions} */ options) => new Date().toLocaleString("en-CA", { timeZone: "America/Los_Angeles", ...options });
const todayDateString = () => nowPacTime({ year: 'numeric', month: '2-digit', day: '2-digit' });
const PrLabels = ['Automatic Deployment', 'Add to Rollup', 'Publish at 9:15 a.m. ☀️'];
const githubOwner = 'cagov';
const githubRepo = 'covid-static-data';
const githubPath = 'data/dashboard';
const targetBranch = 'main'
const stagingBranch = 'CovidStateDashboardTables_Staging';
const doInputValidation = false;
const doOutputValidation = true;
const sqlRootPath = '../SQL/CDT_COVID/CovidStateDashboardTablesCasesDeathsTests/';
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
        title: "Covid Dashboard Tables - Cases/Deaths",
        folders: [
            "combined-cases",
            "combined-deaths"
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

const doCovidStateDashboardTablesCasesDeaths = async () => {
    const token = getGitHubToken();

    const sqlWorkAndSchemas = getSqlWorkAndSchemas(sqlRootPath, 'schema/input/[file]/schema.json', 'schema/input/[file]/sample.json', 'schema/input/[file]/fail/', 'schema/output/');

    const allData = await queryDataset(sqlWorkAndSchemas.DbSqlWork, process.env["SNOWFLAKE_CDTCDPH_COVID_OAUTH"]);
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

        let summary_by_region = allData.summary_by_region.find(f => f.REGION === myRegion);
        let rows_by_region = allData.cases_deaths_tests_rows.filter(f => f.REGION === myRegion);
        if (summary_by_region && rows_by_region.length) {
            const case_keys = {
                'confirmed': ['CASES',          'EPISODE_UNCERTAINTY_PERIOD'],
                'probable':  ['PROBABLE_CASES', 'PROBABLE_UNCERTAINTY_PERIOD'],
                'combined':  ['COMBINED_CASES', 'COMBINED_UNCERTAINTY_PERIOD']
            };
            let avg_cases_results = {};

            // precompute daily average cases for last 7 non-pending days - jbum
            for (let key in case_keys) {
                let cases_field_name = case_keys[key][0];
                let period_name = case_keys[key][1];

                let sumCasesCount = 0;
                const caseList = getDateValueRows(rows_by_region, cases_field_name).VALUES;
                const pending_dateC = summary_by_region[period_name].toISOString().split("T")[0];
                let parse_state = 0;
                let summed_days = 0;
                for (let i = 0; i < caseList.length; ++i) {
                    if (parse_state == 0) {
                        if (caseList[i].DATE.toISOString().split("T")[0] == pending_dateC) {
                            parse_state = 1;
                        }
                    }
                    if (parse_state == 1) {
                        sumCasesCount += caseList[i].VALUE;
                        summed_days += 1;
                    }
                    if (summed_days == 7) {
                        break;
                    }
                }
                avg_cases_results[key] = summed_days > 0 ? sumCasesCount / summed_days : NaN;
            }

            allFilesMap.set(`combined-cases/${regionFileName}.json`,
                {
                    meta: {
                        PUBLISHED_DATE: todayDateString(),
                        coverage: myRegion
                    },
                    data: {
                        latest: {
                            CONFIRMED_CASES: { // can be deleted in the future
                                total_confirmed_cases: summary_by_region.total_confirmed_cases,
                                new_cases: summary_by_region.new_cases,
                                new_cases_delta_1_day: summary_by_region.new_cases_delta_1_day,
                                cases_per_100k_7_days: summary_by_region.cases_per_100k_7_days,
                                EPISODE_UNCERTAINTY_PERIOD: summary_by_region.EPISODE_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION,
                                CASES_DAILY_AVERAGE: avg_cases_results['confirmed'],
                            },
                            CASES: {
                                total_confirmed_cases: summary_by_region.total_confirmed_cases,
                                total_probable_cases: summary_by_region.total_probable_cases,
                                total_combined_cases: summary_by_region.total_combined_cases,
                                new_cases: summary_by_region.new_cases,
                                new_cases_delta_1_day: summary_by_region.new_cases_delta_1_day,
                                confirmed_cases_per_100k_7_days: summary_by_region.cases_per_100k_7_days,
                                probable_cases_per_100k_7_days: summary_by_region.probable_cases_per_100k_7_days,
                                combined_cases_per_100k_7_days: summary_by_region.combined_cases_per_100k_7_days,

                                EPISODE_UNCERTAINTY_PERIOD: summary_by_region.EPISODE_UNCERTAINTY_PERIOD,
                                PROBABLE_UNCERTAINTY_PERIOD: summary_by_region.PROBABLE_UNCERTAINTY_PERIOD,
                                COMBINED_UNCERTAINTY_PERIOD: summary_by_region.COMBINED_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION,
                                CONFIRMED_CASES_DAILY_AVERAGE: avg_cases_results['confirmed'],
                                PROBABLE_CASES_DAILY_AVERAGE: avg_cases_results['probable'],
                                COMBINED_CASES_DAILY_AVERAGE: avg_cases_results['combined']
                            }
                        },
                        time_series: {
                            CONFIRMED_CASES_EPISODE_DATE: getDateValueRows(rows_by_region, 'CASES'),
                            CONFIRMED_CASES_REPORTED_DATE: getDateValueRows(rows_by_region, 'REPORTED_CASES'),
                            PROBABLE_CASES_EPISODE_DATE: getDateValueRows(rows_by_region, 'PROBABLE_CASES'),
                            COMBINED_CASES_EPISODE_DATE: getDateValueRows(rows_by_region, 'COMBINED_CASES'),
                            AVG_CASE_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_CASE_RATE_PER_100K_7_DAYS'),
                            AVG_CASE_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_CASE_REPORT_RATE_PER_100K_7_DAYS'),
                            AVG_PROBABLE_CASE_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_PROBABLE_CASE_RATE_PER_100K_7_DAYS'),
                            AVG_COMBINED_CASE_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_COMBINED_CASE_RATE_PER_100K_7_DAYS')
                        }
                    }
                });

            allFilesMap.set(`combined-deaths/${regionFileName}.json`,
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
                                deaths_per_100k_7_days: summary_by_region.confirmed_deaths_per_100k_7_days,
                                DEATH_UNCERTAINTY_PERIOD: summary_by_region.DEATH_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION,
                                DEATHS_DAILY_AVERAGE: summary_by_region.latest_confident_avg_confirmed_deaths_7_days
                            },
                            DEATHS: {
                                total_confirmed_deaths: summary_by_region.total_confirmed_deaths,
                                total_probable_deaths: summary_by_region.total_probable_deaths,
                                total_combined_deaths: summary_by_region.total_combined_deaths,
                                confirmed_deaths_per_100k_7_days: summary_by_region.confirmed_deaths_per_100k_7_days,
                                probable_deaths_per_100k_7_days: summary_by_region.probable_deaths_per_100k_7_days,
                                combined_deaths_per_100k_7_days: summary_by_region.combined_deaths_per_100k_7_days,
                                CONFIRMED_DEATHS_DAILY_AVERAGE: summary_by_region.latest_confident_avg_confirmed_deaths_7_days,
                                PROBABLE_DEATHS_DAILY_AVERAGE: summary_by_region.latest_confident_avg_probable_deaths_7_days,
                                COMBINED_DEATHS_DAILY_AVERAGE: summary_by_region.latest_confident_avg_combined_deaths_7_days,
                                new_deaths: summary_by_region.new_deaths,
                                new_deaths_delta_1_day: summary_by_region.new_deaths_delta_1_day,
                                DEATH_UNCERTAINTY_PERIOD: summary_by_region.DEATH_UNCERTAINTY_PERIOD,
                                POPULATION: summary_by_region.POPULATION,
                            }
                        },
                        time_series: {
                            CONFIRMED_DEATHS_DEATH_DATE: getDateValueRows(rows_by_region, 'DEATHS'),
                            CONFIRMED_DEATHS_REPORTED_DATE: getDateValueRows(rows_by_region, 'REPORTED_DEATHS'),
                            PROBABLE_DEATHS_DEATH_DATE: getDateValueRows(rows_by_region, 'PROBABLE_DEATHS'),
                            COMBINED_DEATHS_DEATH_DATE: getDateValueRows(rows_by_region, 'COMBINED_DEATHS'),
                            AVG_CONFIRMED_DEATH_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_DEATH_RATE_PER_100K_7_DAYS'),
                            AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_DEATH_REPORT_RATE_PER_100K_7_DAYS'),
                            AVG_PROBABLE_DEATH_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_PROBABLE_DEATH_RATE_PER_100K_7_DAYS'),
                            AVG_COMBINED_DEATH_RATE_PER_100K_7_DAYS: getDateValueRows(rows_by_region, 'AVG_COMBINED_DEATH_RATE_PER_100K_7_DAYS')
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

        resultStats.push(await treeObject_staging.treePush());
        if (!stagingOnly) resultStats.push(await treeObject_main.treePush());
    }

    let PrList = resultStats.filter(r => r.Pull_Request_URL).map(r => r.Pull_Request_URL);

    return PrList.length ? PrList : null;
};


module.exports = {
    doCovidStateDashboardTablesCasesDeaths
};
