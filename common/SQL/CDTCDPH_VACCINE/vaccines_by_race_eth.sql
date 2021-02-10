  -- Current vaccine administrations by race (distinct people)
  -- 535 rows
  --   by county(REGION)
  --   by race(CATEGORY) (White/Latino/Asian/etc)
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
GB as ( --Master list of corrected data by category
  select
    RACE_ETH "CATEGORY",
    coalesce(gc.COUNTY,'Unknown') "REGION",
    count(distinct RECIP_ID) "ADMIN_COUNT",
    MAX(case when DATE(ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
      CA_VACCINE.VW_TAB_INT_ALL
  left outer join --For validating CA counties and replacing with 'Unknown'
    GoodCounties GC
    on RECIP_ADDRESS_STATE='CA'
    and GC.COUNTY = RECIP_ADDRESS_COUNTY 
  where
      RECIP_ID IS NOT NULL
      and DATE(ADMIN_DATE)>=DATE('2020-12-15')
  group by
      REGION,
      CATEGORY
),
TA as ( -- Region Totals
  select
    REGION,
    SUM(ADMIN_COUNT) "REGION_TOTAL",
    MAX(LATEST_ADMIN_DATE) "LATEST_ADMIN_DATE"
  from
      GB
  group by
      REGION
),
BD as ( -- Region Totals added to category data
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