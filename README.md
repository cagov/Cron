# cagov cron jobs

This repository is used to process data and output data files, primarily & initially for the covid19.ca.gov website.

* Data is generally hosted in a number of different Snowflake databases.
* We use the Snowflake API to retreive the data, and nodeJS based script processes that run using Azure FaaS processes.

These are the main components for our published datasets:

* **Snowflake tables & views.** Views and tables that are managed upstream. 
* **Schema tests.** The datasets we aggregate are generally sourced by data generated by many organizations and updated frequently, and can change. To ensure that public websites see the most accurate and high quality information, we created schema tests for our data inputs and outputs. This helps to ensure that we are getting data we expect, and delivering data in reliable formats.
* **Sample data.** We periodically capture date stamped sample datasets. Example: `common/SQL/CDT_COVID/Daily-stats-v2/schema/tests/output/pass/2021-02-25.json`.
* **Meta content.** General information about a dataset. The structure of the `meta` content is based on modern data documentation standards for data packages. We have a simple collaborative data management database (CSV > collaborative spreadsheet > API > NodeJS > `meta` data files > `*.meta` in output JSON file.) This includes publishing schedules and other critical details. We periodically merge any revisions to a `meta` file back into our tracking spreadsheet. Example `coming soon! 🌈`. Since pipeline metadata is published on a per-project basis, you can also look to the main website repo for full context, images, implementation and usage of the datasets.
* **Trigger scripts.** We use [Microsoft Azure FaaS services](https://azure.microsoft.com/en-us/services/functions) to retrieve specific datasets & publish the data to an external git repository.
Example [`CovidEquityData/index.js`](./CovidEquityData/index.js) publishes to [`https://github.com/cagov/covid-static/tree/master/data/reviewed/equitydash`](https://github.com/cagov/covid-static/tree/master/data/reviewed/equitydash), which then moves to the covid19.ca.gov static file server [`https://files.covid19.ca.gov/data/reviewed/equitydash/cumulative-california.json`](https://files.covid19.ca.gov/data/reviewed/equitydash/cumulative-california.json).
* **Function triggers** Part of Microsoft, these settings control how the service runs. We can pull the `schedule` from the git repo and sync our data management database so that our team has an accurate look at current publishing schedules, and can keep track of different cycles with an ever-growing number of datasets in our pipeline. Example `/Users/chachasikes/Work/ca.gov/Cron/CovidStateDashboard/function.json`.
* **Schedule** Our scheduled jobs are with ncrontab expressions. 
    * [Decoder tool](https://crontab.cronhub.io/), Example: `0 22 16 * * *` > "At 04:22 PM"
    * [Ncrobtab interpreter](https://ncrontab.swimburger.net/) 
    
    Example: `0 21/30 16-18 * * *` > 
    ```2021-03-17 16:21:00
2021-03-17 16:51:00
2021-03-17 17:21:00
2021-03-17 17:51:00
2021-03-17 18:21:00
2021-03-17 18:51:00
2021-03-18 16:21:00
2021-03-18 16:51:00
2021-03-18 17:21:00
2021-03-18 17:51:00```

## Contents of this repository

* `common` — shared assets
* `common/SQL` - all Snowflake SQL queries
* `common/slackBot` - Post messages to Slack.
* `common/snowflakeQuery` - Use the [Snowflake NodeJS driver](https://docs.snowflake.com/en/user-guide/nodejs-driver.html) to run a SQL query and return results.
* `common/schemaTester` - Take a JSON file and test validation using a [JSONschema](https://www.npmjs.com/package/jsonschema) file.
* `Covid*` - FaaS data pipelines and cron job triggers
* `qnacrawler` - Question & Answer scraper that scrapes website and pulls Q&A into a database that is made accessible to Google Search Results.
* `perfMonitor` - Lighthouse performance monitoring. Publishes reports to Slack.

## SQL query structure

How our SQL folders are structured:

* `common/SQL/{Database}/{Dataset}/schema/input/schema.json`
* `common/SQL/{Database}/{Dataset}/schema/output/schema.json`
* `common/SQL/{Database}/{Dataset}/schema/tests/pass/YYYY-MM-DD.json`
* `common/SQL/{Database}/{Dataset}/schema/tests/fail/{name}.json`

## Read more about our technology approach
* [Data pipelines](https://teamdocs.covid19.ca.gov/teams/engineering/data-pipelines/)
* [Serverless APIs](https://handbook.digital.ca.gov/tech/serverless/) in our design handbook.
* [Publishing pipeline](https://teamdocs.covid19.ca.gov/teams/engineering/publishing-pipeline/)
* [Public dashboards](https://teamdocs.covid19.ca.gov/teams/engineering/dashboards/)