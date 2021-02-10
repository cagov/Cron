  -- Current vaccine administrations by race (distinct people)
  -- 535 rows
  --   by county(REGION)
  --   by race(CATEGORY) (White/Latino/Asian/etc)
with 
GB as (
  select
    RACE_ETH "CATEGORY",
    ADMIN_ADDRESS_COUNTY "REGION",
    count(distinct RECIP_ID) "ADMIN_COUNT"
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
    SUM(ADMIN_COUNT) "REGION_TOTAL"
  from
      GB
  group by
      REGION
),
BD as (
  select 
      GB.REGION,
      CATEGORY,
      ADMIN_COUNT,
      REGION_TOTAL
  from
      GB
  join
      TA
      on TA.REGION = GB.REGION
)

select
    *,
    ADMIN_COUNT/REGION_TOTAL "METRIC_VALUE"
from (
  select 
      *
  from
      BD

  union
  select 
      'California',
      BD.CATEGORY,
      SUM(BD.ADMIN_COUNT),
      SUM(BD.REGION_TOTAL)
  from
      BD
  group by
      BD.CATEGORY
)
order by
    REGION,
    ADMIN_COUNT desc