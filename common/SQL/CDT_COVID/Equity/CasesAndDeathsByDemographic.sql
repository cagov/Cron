-- Case rate of Latino, black + NHPI
-- OLD R/E names
-- 7 Rows
-- by RACE_ETHNICITY (African American,American Indian,etc.)
with demoTab as (
  select 
    case DEMOGRAPHIC_VALUE
        when 'Black' then 'African American'
        when 'American Indian or Alaska Native' then 'American Indian'
        else DEMOGRAPHIC_VALUE
     end as DEMOGRAPHIC_VALUE,
    sum(TOTAL_CASES) as cases,
    sum(DEATHS) as deaths,
    REPORT_DATE
  from
  COVID.PRODUCTION.CDPH_GOOD_CASES_DEATHS_BY_DEMO_STAGE
  where
    DEMOGRAPHIC_CATEGORY='Race Ethnicity'
    and DEMOGRAPHIC_VALUE!='Other' and DEMOGRAPHIC_VALUE!='Total'
    and REPORT_DATE = (SELECT max(REPORT_DATE) from COVID.PRODUCTION.CDPH_GOOD_CASES_DEATHS_BY_DEMO_STAGE)
  group by DEMOGRAPHIC_VALUE,REPORT_DATE
)
select
    *,
    CASES/POPULATION*100000 as CASE_RATE,
    DEATHS/POPULATION*100000 as DEATH_RATE
from
(
select
    DEMOGRAPHIC_VALUE as RACE_ETHNICITY,
    sum(CASES) as cases,
    sum(DEATHS) as deaths,
    (select sum(POPULATION) from COVID.PRODUCTION.CDPH_STATIC_DEMOGRAPHICS d1 where d1.RACE_ETHNICITY = demoTab.DEMOGRAPHIC_VALUE) as POPULATION,
    REPORT_DATE
from 
    demoTab
group by
    DEMOGRAPHIC_VALUE,
    REPORT_DATE
order by
    RACE_ETHNICITY
)