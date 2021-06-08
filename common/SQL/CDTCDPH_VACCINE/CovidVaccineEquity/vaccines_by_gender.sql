-- Current vaccine administrations by gender (distinct people)
-- 180 rows
--   by county(REGION) + 'California'
--   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
-- 6/7/2021 Added population metric value
with
SortMap as (select * from
  (values
   (1,'F','Female'),
   (2,'M','Male'),
   (3,'U','Unknown/undifferentiated')
  ) as foo (SORT, CATEGORY, REPLACEMENT)
),
GB as ( --Master list of corrected data grouped by region/category
  select
    RECIP_SEX "CATEGORY",
    MIXED_COUNTY "REGION", -- ####replacing old REGION code below
    coalesce(count(distinct recip_id),0) "ADMIN_COUNT", --For total people
    max(EST_AGE_12PLUS_POP) as "POP_TOTAL",
    MAX(case when DATE(DS2_ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(DS2_ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
    CA_VACCINE.CA_VACCINE.VW_DERIVED_BASE_RECIPIENTS
  left outer join
    DATA_FROM_WEB.GEOGRAPHIC.VW_EST_COUNTY_POP_BY_SEX pop
    on pop.county_name= MIXED_COUNTY
    and (case when pop.sex='Male' then 'M' else 'F' end )=RECIP_SEX
  where
    RECIP_ID IS NOT NULL
    and REGION <> 'Outside California'
  group by
      REGION,
      CATEGORY
),
TA as ( -- Region Totals
  select
    REGION,
    SUM(ADMIN_COUNT) "REGION_TOTAL",
    sum(POP_TOTAL) "POP_REGION_TOTAL",
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
      TA.REGION,
      sm.CATEGORY,
      TA.POP_REGION_TOTAL,
      GB.ADMIN_COUNT,
      GB.POP_TOTAL "POP_COUNT"
  from
    TA
  cross join
      SortMap sm
  left outer join
     GB
     on GB.REGION=TA.REGION
     and GB.CATEGORY=sm.CATEGORY
)

select
    LATEST_ADMIN_DATE,
    REGION,
    coalesce(sm.REPLACEMENT,sm.CATEGORY) "CATEGORY",
    coalesce(ADMIN_COUNT/REGION_TOTAL,0) "METRIC_VALUE",
    coalesce(POP_COUNT/POP_REGION_TOTAL,0) "POP_METRIC_VALUE"
from (
  select 
      *
  from
      BD
  union
  select
      MAX(LATEST_ADMIN_DATE),
      SUM(REGION_TOTAL),
      'California',
      CATEGORY,
      sum(POP_REGION_TOTAL),
      SUM(ADMIN_COUNT),
      sum(POP_COUNT)
  from
      BD
  group by
      CATEGORY
) main
join
    sortmap sm
    on sm.CATEGORY = main.CATEGORY
order by
    REGION,
    SORT