
select
    COUNTY AS REGION,
    TO_DATE(SF_LOAD_TIMESTAMP) AS DATE,
    SUM(ICU_SUSPECTED_COVID_PATIENTS)+SUM(ICU_COVID_CONFIRMED_PATIENTS) AS ICU_PATIENTS,
    SUM(HOSPITALIZED_COVID_CONFIRMED_PATIENTS) + SUM(HOSPITALIZED_SUSPECTED_COVID_PATIENTS) AS HOSPITALIZED_PATIENTS,
    SUM(ICU_AVAILABLE_BEDS) as ICU_AVAILABLE_BEDS
from
    COVID.PRODUCTION.VW_CHA_HOSPITALDATA_OLD
where
  DATE>='2020-03-30'
group by 
    DATE,
    REGION
order by
    REGION,
    DATE DESC