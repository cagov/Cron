# CovidEquityStats - JavaScript

This service retrieves information to power the covid19 equity dashboard. It queries snowflake and writes resulting static json files to the cagov/covid-static repo

### Approvals

Data consumed by charts in staging is written into the /to-review folder. A PR is created and merged for these json files.
A separate PR is created in the /reviewed folder but not merged
A slack message is sent to the covid-equity channel with a 5 minute delay to notify people the latest data is available for review in staging and the PR can be approved at will for use in production. The delay is meant to give the covid-static repo time to deploy the staging files just merged and for the short CDN cache on files.covid19 to expire.
