select
    area "REGION",
    max(DATE) "DATE",

    max(IFF(TESTING_UNCERTAINTY_PERIOD,null,DATE)) "TESTING_UNCERTAINTY_PERIOD",

    max(POPULATION) "POPULATION",

    SUM(LATEST_TOTAL_TESTS_PERFORMED) "total_tests_performed",
    SUM(NEWLY_REPORTED_TESTS) "new_tests_reported",
    SUM(LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY) "new_tests_reported_delta_1_day",
    SUM(LATEST_CONFIDENT_AVG_TOTAL_TESTS_7_DAYS) "latest_confident_avg_total_tests_7_days",

    SUM(LATEST_POSITIVITY_RATE_7_DAYS) "test_positivity_7_days",
    SUM(LATEST_INCREASE_POSITIVITY_RATE_7_DAYS) "test_positivity_7_days_delta_7_days"
from
    COVID.PRODUCTION.VW_CDPH_COUNTY_AND_STATE_TIMESERIES_METRICS
where
    area not in ('Out of state','Unknown')
group by
    area
order by
    area
