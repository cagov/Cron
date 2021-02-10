  -- Current vaccine administrations by gender (distinct people)
  -- 160 rows
  --   by county(REGION)
  --   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
with 
ranges as (
    select
        '0-17' as "NAME",
        0 as "RMIN",
        17 as "RMAX"
  union select '18-49',18,49
  union select '50-64',50,64
  union select '65+',65,999
),
GB as (
  select
    ranges.NAME "CATEGORY",
    ADMIN_ADDRESS_COUNTY "REGION",
    count(distinct RECIP_ID) "ADMIN_COUNT"
  from
      CA_VACCINE.VW_TAB_INT_ALL
  left outer join
    ranges
    on RMIN<=DATEDIFF('yyyy',DATE(RECIP_DOB),GETDATE())
    and RMAX>=DATEDIFF('yyyy',DATE(RECIP_DOB),GETDATE())
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