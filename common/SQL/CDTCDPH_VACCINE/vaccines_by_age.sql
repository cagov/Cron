-- Current vaccine administrations by age group (distinct people)
-- 247 rows
--   by county(REGION) + 'California' + 'Outside California'
--   by age(CATEGORY) (0-17,18-49,50-64/65+)
with
ranges as (select * from
  (values
   ('0-17', 0,  17),
   ('18-49',18, 49),
   ('50-64',50, 64),
   ('65+',  65, 119)
  ) as foo (NAME, RMIN, RMAX)
),
GB as ( --Master list of corrected data grouped by region/category
  select
  coalesce(ranges.NAME,'Unknown') "CATEGORY",
  MIXED_COUNTY "REGION",
    count(distinct recip_id) "ADMIN_COUNT", --For total people
	MAX(case when DATE(DS2_ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(DS2_ADMIN_DATE) end) "LATEST_ADMIN_DATE_2" -- new view only includes second dose as the latest dose
  from
    CA_VACCINE.CA_VACCINE.VW_DERIVED_BASE_RECIPIENTS
  left outer join
    ranges
    on RMIN<=RECIP_AGE --changed to RECIP_AGE, no longer calculating by current date.
    and RMAX>=RECIP_AGE --changed to RECIP_AGE, no longer calculating by current date.
  where
    RECIP_ID IS NOT NULL
  group by
      REGION,
      CATEGORY
),
TA as ( -- Region Totals
  select
    REGION,
    SUM(ADMIN_COUNT) "REGION_TOTAL",
    MAX(LATEST_ADMIN_DATE_2) "LATEST_ADMIN_DATE"
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