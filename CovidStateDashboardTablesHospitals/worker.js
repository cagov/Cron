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
const sqlRootPath = '../SQL/CDT_COVID/CovidStateDashboardTablesHospitals/';
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
        title: "Covid Dashboard Tables - Hospitals",
        folders: [
            "patients",
            "icu-beds"
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

const doCovidStateDashboardTablesHospitals = async () => {
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
    doCovidStateDashboardTablesHospitals
};