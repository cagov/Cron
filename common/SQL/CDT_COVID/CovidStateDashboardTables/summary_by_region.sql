select
    area "REGION",
    max(DATE) "DATE",
    SUM(LATEST_TOTAL_CONFIRMED_CASES) "total_confirmed_cases",
    SUM(NEWLY_REPORTED_CASES) "new_cases",
    SUM(LATEST_PCT_CH_CASES_REPORTED_1_DAY) "new_cases_delta_1_day",
    SUM(LATEST_CONFIDENT_AVG_CASE_RATE_PER_100K_7_DAYS) "cases_per_100k_7_days",
    
    SUM(LATEST_TOTAL_CONFIRMED_DEATHS) "total_confirmed_deaths",
    SUM(NEWLY_REPORTED_DEATHS) "new_deaths",
    SUM(LATEST_PCT_CH_DEATHS_REPORTED_1_DAY) "new_deaths_delta_1_day",
    SUM(LATEST_CONFIDENT_AVG_DEATH_RATE_PER_100K_7_DAYS) "deaths_per_100k_7_days",
    
    SUM(LATEST_TOTAL_TESTS_PERFORMED) "total_tests_performed",
    SUM(NEWLY_REPORTED_TESTS) "new_tests_reported",
    SUM(LATEST_PCT_CH_TOTAL_TESTS_REPORTED_1_DAY) "new_tests_reported_delta_1_day",
    
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