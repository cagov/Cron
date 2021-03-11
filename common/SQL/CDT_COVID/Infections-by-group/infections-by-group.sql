with good_data as
(select *
  , REPORT_DATE as DATE
  , CASE DEMOGRAPHIC_CATEGORY 
      when 'Age Group' then 'AGE'
      when 'Sex' then 'GENDER' 
      when 'Race Ethnicity' then 'RACE_ETHNICITY' 
    end as DATASET
  , case lower(DEMOGRAPHIC_VALUE) 
        when 'missing' then 'Missing' 
        else DEMOGRAPHIC_VALUE 
    end as CATEGORY
  , max(DATE) over (partition by 1) as MAX_DATE
 from PRODUCTION.CDPH_GOOD_CASES_DEATHS_BY_DEMO_STAGE
    where DEMOGRAPHIC_VALUE!='Total'
)
, triple_union as
(select 
    DATE
    , 'PERCENT_CA_POPULATION' as SUBJECT
    , DATASET
    , CATEGORY
    , PERCENT_OF_CA_POPULATION as METRIC_VALUE
  from good_data
    where DATE=MAX_DATE
union
  select 
    DATE
    , 'CASE_PERCENTAGE' as SUBJECT
    , DATASET
    , CATEGORY
    , PERCENT_CASES as METRIC_VALUE
  from good_data
    where DATE=MAX_DATE
union
  select 
    DATE
    , 'DEATH_PERCENTAGE' as SUBJECT
    , DATASET
    , CATEGORY
    , PERCENT_DEATHS as METRIC_VALUE
  from good_data
    where DATE=MAX_DATE
)
select *
from triple_union
order by subject,dataset,category