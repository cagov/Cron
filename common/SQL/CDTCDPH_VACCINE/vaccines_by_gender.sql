-- Current vaccine administrations by gender (distinct people)
-- 182 rows
--   by county(REGION) + 'California' + 'Outside California'
--   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
with
GB as ( --Master list of corrected data grouped by region/category
  select
    RECIP_SEX "CATEGORY",
    MIXED_COUNTY "REGION", -- ####replacing old REGION code below
    count(distinct recip_id) "ADMIN_COUNT", --For total people
	MAX(case when DATE(DS2_ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(DS2_ADMIN_DATE) end) "LATEST_ADMIN_DATE_2" -- new view only includes second dose as the latest dose
  from
    CA_VACCINE.CA_VACCINE.VW_DERIVED_BASE_RECIPIENTS
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