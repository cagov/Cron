  -- Current vaccine administrations by race (distinct people)
  -- 535 rows
  --   by county(REGION)
  --   by race(CATEGORY) (White/Latino/Asian/etc)
with 
GB as (
  select
    RACE_ETH "CATEGORY",
    ADMIN_ADDRESS_COUNTY "REGION",
    count(distinct RECIP_ID) "ADMIN_COUNT",
    MAX(case when DATE(ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
      CA_VACCINE.VW_TAB_INT_ALL
  where
      RECIP_ID IS NOT NULL
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