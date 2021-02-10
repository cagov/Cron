-- Current vaccine administrations by age group (distinct people)
-- 228 rows
--   by county(REGION) + 'California'
--   by age(CATEGORY) (0-17,18-49,50-64/65+)
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
    ranges.NAME "CATEGORY",
    coalesce(gc.COUNTY,'Unknown') "REGION",
    count(distinct RECIP_ID) "ADMIN_COUNT",
    MAX(case when DATE(ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
      CA_VACCINE.VW_TAB_INT_ALL
  left outer join
    ranges
    on RMIN<=DATEDIFF('yyyy',DATE(RECIP_DOB),GETDATE())
    and RMAX>=DATEDIFF('yyyy',DATE(RECIP_DOB),GETDATE())
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