  -- Current vaccine administrations by gender (distinct people)
  -- 160 rows
  --   by county(REGION)
  --   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
with 
GB as (
  select
      RECIP_ADDRESS_COUNTY,
      RACE_ETH AS "CATEGORY",
      count(distinct RECIP_ID) AS "ADMIN_COUNT"
  from
      CA_VACCINE.VW_TAB_INT_ALL
  where
      RECIP_ID IS NOT NULL
  group by
      RECIP_ADDRESS_COUNTY,
      CATEGORY
),
TA as (
  select
    RECIP_ADDRESS_COUNTY,
    count(distinct RECIP_ID) AS "REGION_TOTAL"
  from
      CA_VACCINE.VW_TAB_INT_ALL
  where
      RECIP_ID IS NOT NULL
  group by
      RECIP_ADDRESS_COUNTY
)

select
    UNI.*,
    ADMIN_COUNT/REGION_TOTAL AS "METRIC_VALUE"
from (
  select 
      GB.RECIP_ADDRESS_COUNTY AS "REGION",
      GB.CATEGORY,
      GB.ADMIN_COUNT,
      TA.REGION_TOTAL
  from
      GB
  join
      TA
      on TA.RECIP_ADDRESS_COUNTY = GB.RECIP_ADDRESS_COUNTY

  union
  select 
      '_CALIFORNIA',
      GB.CATEGORY,
      SUM(GB.ADMIN_COUNT),
      SUM(TA.REGION_TOTAL)
  from
      GB
  join
      TA
      on TA.RECIP_ADDRESS_COUNTY = GB.RECIP_ADDRESS_COUNTY
  group by
      GB.CATEGORY
) UNI
order by
    REGION,
    METRIC_VALUE desc