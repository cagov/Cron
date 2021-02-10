-- Current vaccine administrations by gender (distinct people)
-- 171 rows
--   by county(REGION) + 'California'
--   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
with
GoodCounties as (
    select
        DISTINCT REPLACE(ADMIN_ADDRESS_COUNTY, ' County','') "COUNTY"
    from
        CA_VACCINE.VW_TAB_INT_ALL
    where
        ADMIN_ADDRESS_COUNTY is not null
        and ADMIN_ADDRESS_COUNTY not like 'Unknown%'
    order by
        COUNTY
),
GB as (
  select
    RECIP_SEX "CATEGORY",
    coalesce(gc.COUNTY,REPLACE(ADMIN_ADDRESS_COUNTY, ' County','')) "REGION",
    count(distinct RECIP_ID) "ADMIN_COUNT",
    MAX(case when DATE(ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
      CA_VACCINE.VW_TAB_INT_ALL
  left outer join
    GoodCounties GC
    on GC.COUNTY = RECIP_ADDRESS_COUNTY
  where
      RECIP_ID IS NOT NULL
      and DATE(ADMIN_DATE)>=DATE('2020-12-15')
  group by
      REGION,
      CATEGORY
),
TA as (
  select
    REGION,
    SUM(ADMIN_COUNT) "REGION_TOTAL",
    MAX(LATEST_ADMIN_DATE) "LATEST_ADMIN_DATE"
  from
      GB
  group by
      REGION
),
BD as (
  select
      TA.LATEST_ADMIN_DATE,
      TA.REGION_TOTAL,
      GB.REGION,
      GB.CATEGORY,
      GB.ADMIN_COUNT
  from
      GB
  join
      TA
      on TA.REGION = GB.REGION
)

select
    LATEST_ADMIN_DATE,
    REGION,
    CATEGORY,
    ADMIN_COUNT/REGION_TOTAL "METRIC_VALUE"
    --,ADMIN_COUNT
    --,REGION_TOTAL
from (
  select 
      *
  from
      BD

  union
  select
      MAX(BD.LATEST_ADMIN_DATE),
      SUM(BD.REGION_TOTAL),
      'California',
      BD.CATEGORY,
      SUM(BD.ADMIN_COUNT)
  from
      BD
  group by
      BD.CATEGORY
)
order by
    REGION,
    ADMIN_COUNT desc