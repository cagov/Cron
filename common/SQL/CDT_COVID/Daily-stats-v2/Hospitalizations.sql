-- Hospitalizations and ICU
-- 1 Row

WITH HOSPITALIZATIONS as (
    select TO_DATE(SF_LOAD_TIMESTAMP) as SF_LOAD_TIMESTAMP
      , SUM(HOSPITALIZED_COVID_CONFIRMED_PATIENTS) AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS
      , SUM(HOSPITALIZED_SUSPECTED_COVID_PATIENTS) AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS
      , SUM(ICU_COVID_CONFIRMED_PATIENTS) AS ICU_COVID_CONFIRMED_PATIENTS
      , SUM(ICU_SUSPECTED_COVID_PATIENTS) AS ICU_SUSPECTED_COVID_PATIENTS
      , SUM(HOSPITALIZED_COVID_CONFIRMED_PATIENTS) + SUM(HOSPITALIZED_SUSPECTED_COVID_PATIENTS) AS TOTAL_PATIENTS
    FROM COVID.PRODUCTION.VW_CHA_HOSPITALDATA_OLD
    group by TO_DATE(SF_LOAD_TIMESTAMP)
)
, CHANGES as (
    select SF_LOAD_TIMESTAMP
        , HOSPITALIZED_COVID_CONFIRMED_PATIENTS
            , ZEROIFNULL(HOSPITALIZED_COVID_CONFIRMED_PATIENTS - LAG(HOSPITALIZED_COVID_CONFIRMED_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY
            , HOSPITALIZED_COVID_CONFIRMED_PATIENTS - LAG(HOSPITALIZED_COVID_CONFIRMED_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS
        , HOSPITALIZED_SUSPECTED_COVID_PATIENTS
            , ZEROIFNULL(HOSPITALIZED_SUSPECTED_COVID_PATIENTS - LAG(HOSPITALIZED_SUSPECTED_COVID_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY
            , HOSPITALIZED_SUSPECTED_COVID_PATIENTS - LAG(HOSPITALIZED_SUSPECTED_COVID_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS
        , ICU_COVID_CONFIRMED_PATIENTS
            , ZEROIFNULL(ICU_COVID_CONFIRMED_PATIENTS - LAG(ICU_COVID_CONFIRMED_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS ICU_COVID_CONFIRMED_PATIENTS_DAILY
            , ICU_COVID_CONFIRMED_PATIENTS - LAG(ICU_COVID_CONFIRMED_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS
        , ICU_SUSPECTED_COVID_PATIENTS
            , ZEROIFNULL(ICU_SUSPECTED_COVID_PATIENTS - LAG(ICU_SUSPECTED_COVID_PATIENTS,1,0) OVER (ORDER BY SF_LOAD_TIMESTAMP)) AS ICU_SUSPECTED_COVID_PATIENTS_DAILY
            , ICU_SUSPECTED_COVID_PATIENTS - LAG(ICU_SUSPECTED_COVID_PATIENTS,14,0) OVER (ORDER BY SF_LOAD_TIMESTAMP) AS ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS
        , TOTAL_PATIENTS
    FROM HOSPITALIZATIONS
)
select TOP 1 SF_LOAD_TIMESTAMP
    , HOSPITALIZED_COVID_CONFIRMED_PATIENTS
        , HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY
        , CASE HOSPITALIZED_COVID_CONFIRMED_PATIENTS
            WHEN 0 THEN 0
            WHEN HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY THEN 1
            ELSE HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY / (HOSPITALIZED_COVID_CONFIRMED_PATIENTS-HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILY)
        END AS HOSPITALIZED_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG
        , HOSPITALIZED_COVID_CONFIRMED_PATIENTS_LAST14DAYS
    , HOSPITALIZED_SUSPECTED_COVID_PATIENTS
        , HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY
        , CASE HOSPITALIZED_SUSPECTED_COVID_PATIENTS
            WHEN 0 THEN 0
            WHEN HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY THEN 1
            ELSE HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY / (HOSPITALIZED_SUSPECTED_COVID_PATIENTS-HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILY)
        END AS HOSPITALIZED_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG
        , HOSPITALIZED_SUSPECTED_COVID_PATIENTS_LAST14DAYS
    , ICU_COVID_CONFIRMED_PATIENTS
        , ICU_COVID_CONFIRMED_PATIENTS_DAILY
        , CASE ICU_COVID_CONFIRMED_PATIENTS
            WHEN 0 THEN 0
            WHEN ICU_COVID_CONFIRMED_PATIENTS_DAILY THEN 1
            ELSE ICU_COVID_CONFIRMED_PATIENTS_DAILY / (ICU_COVID_CONFIRMED_PATIENTS-ICU_COVID_CONFIRMED_PATIENTS_DAILY)
        END AS ICU_COVID_CONFIRMED_PATIENTS_DAILYPCTCHG
        , ICU_COVID_CONFIRMED_PATIENTS_LAST14DAYS
    , ICU_SUSPECTED_COVID_PATIENTS
        , ICU_SUSPECTED_COVID_PATIENTS_DAILY
        , CASE ICU_SUSPECTED_COVID_PATIENTS
            WHEN 0 THEN 0
            WHEN ICU_SUSPECTED_COVID_PATIENTS_DAILY THEN 1
            ELSE ICU_SUSPECTED_COVID_PATIENTS_DAILY / (ICU_SUSPECTED_COVID_PATIENTS-ICU_SUSPECTED_COVID_PATIENTS_DAILY)
        END AS ICU_SUSPECTED_COVID_PATIENTS_DAILYPCTCHG
        , ICU_SUSPECTED_COVID_PATIENTS_LAST14DAYS
    , TOTAL_PATIENTS
FROM CHANGES
ORDER BY SF_LOAD_TIMESTAMP DESC