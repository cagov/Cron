# CovidEquityStats - JavaScript

This service retrieves information to power the covid19 equity dashboard. It queries snowflake and writes resulting static json files to the cagov/covid-static repo

### ToDo

Right now it writes all data into the /to-review folder. This will be used by charts in the staging environment. Next phase will open PR to write charts to the location used in production. This PR will be merged after stakeholder approval and data integrity checks pass daily.