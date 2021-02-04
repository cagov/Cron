-- Case rate of Latino, black + NHPI
-- 7 Rows
-- by RACE_ETHNICITY (African American,American Indian,etc.)

select
    *,
    CASES/POPULATION*100000 as CASE_RATE,
    DEATHS/POPULATION*100000 as DEATH_RATE
from
(
select
    RACE_ETHNICITY,
    sum(cases) as cases,
    sum(deaths) as deaths,
    (select sum(POPULATION) from COVID.PRODUCTION.CDPH_STATIC_DEMOGRAPHICS d1 where d1.RACE_ETHNICITY = demoTab.RACE_ETHNICITY) as POPULATION,
    REPORT_DATE
from 
    COVID.PRODUCTION.VW_CDPH_CASE_DEMOGRAPHICS as demoTab
where
    RACE_ETHNICITY!='Other'
    and REPORT_DATE = (SELECT max(REPORT_DATE) from COVID.PRODUCTION.VW_CDPH_CASE_DEMOGRAPHICS)
group by
    RACE_ETHNICITY,
    REPORT_DATE
order by
    RACE_ETHNICITY
)