-- Current vaccine administrations by age group (distinct people)
-- 305 rows
--   by county(REGION) + 'California' + 'Outside California'
--   by age(CATEGORY) (0-17,18-49,50-64/65+)
  -- 6/7/2021 Added population metric value
with
ranges as (select * from
  (values
   ('12-17', 12,  17),
   ('18-49',18, 49),
   ('50-64',50, 64),
   ('65+',  65, 119)
  ) as foo (NAME, RMIN, RMAX)
),
SortMap as (select * from
  (values
   (1,'12-17',null),
   (2,'18-49',null),
   (3,'50-64',null),
   (4,'65+',null),
   (5,'Unknown',null)
  ) as foo (SORT, CATEGORY, REPLACEMENT)
),
GB as ( --Master list of corrected data grouped by region/category
  select
  coalesce(ranges.NAME,'Unknown') "CATEGORY",
  MIXED_COUNTY "REGION",
    count(distinct recip_id) "ADMIN_COUNT", --For total people
    max(EST_AGE_12PLUS_POP) as "POP_TOTAL",
    MAX(case when DATE(DS2_ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(DS2_ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
    CA_VACCINE.CA_VACCINE.VW_DERIVED_BASE_RECIPIENTS
  left outer join
    ranges
    on RMIN<=RECIP_AGE --changed to RECIP_AGE, no longer calculating by current date.
    and RMAX>=RECIP_AGE --changed to RECIP_AGE, no longer calculating by current date.
  left join
    DATA_FROM_WEB.GEOGRAPHIC.VW_EST_COUNTY_POP_BY_AGE_GRP pop
    on pop.county_name=MIXED_COUNTY
    and pop.AGE_GROUP=coalesce(ranges.NAME,'Unknown')
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
      coalesce(GB.ADMIN_COUNT,0) "ADMIN_COUNT",
      coalesce(POP_TOTAL,0) as "POP_COUNT"
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
    ADMIN_COUNT/REGION_TOTAL "METRIC_VALUE",
    POP_COUNT/POP_REGION_TOTAL "POP_METRIC_VALUE"
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