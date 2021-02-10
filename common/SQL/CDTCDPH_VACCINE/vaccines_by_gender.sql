  -- Current vaccine administrations by gender (distinct people)
  -- 160 rows
  --   by county(REGION)
  --   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
with 
GB as (
  select
    RECIP_SEX AS "CATEGORY",
    RECIP_ADDRESS_COUNTY AS "REGION",
    count(distinct RECIP_ID) AS "ADMIN_COUNT"
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
    SUM(ADMIN_COUNT) AS "REGION_TOTAL"
  from
      GB
  group by
      REGION
)


select
    UNI.*,
    ADMIN_COUNT/REGION_TOTAL AS "METRIC_VALUE"
from (
  select 
      GB.REGION,
      GB.CATEGORY,
      GB.ADMIN_COUNT,
      TA.REGION_TOTAL
  from
      GB
  join
      TA
      on TA.REGION = GB.REGION

  union
  select 
      'California',
      GB.CATEGORY,
      SUM(GB.ADMIN_COUNT),
      SUM(TA.REGION_TOTAL)
  from
      GB
  join
      TA
      on TA.REGION = GB.REGION
  group by
      GB.CATEGORY
) UNI
order by
    REGION,
    METRIC_VALUE desc