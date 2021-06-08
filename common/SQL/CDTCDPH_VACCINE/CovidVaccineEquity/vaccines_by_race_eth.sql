  -- Current vaccine administrations by race (distinct people)
  -- 549 rows
  --   by county(REGION) (County/California/"Outside California")
  --   by race(CATEGORY) (White/Latino/Asian/etc)
  -- 6/7/2021 Added population metric value
with
SortMap as (select * from
  (values
   (1,'American Indian or Alaska Native','American Indian or Alaska Native (AI/AN)'),
   (2,'Asian','Asian American'),
   (3,'Black or African American','Black'),
   (4,'Latino',null),
   (5,'Multiracial','Multi-race'),
   (6,'Native Hawaiian or Other Pacific Islander','Native Hawaiian or Other Pacific Islander (NHPI)'),
   (7,'White',null),
   (8,'Other Race','Other'),
   (9,'Unknown',null)
  ) as foo (SORT, CATEGORY, REPLACEMENT)
),
GB as ( --Master list of corrected data grouped by region/category
  select
    RECIP_RACE_ETH "CATEGORY",
    MIXED_COUNTY "REGION",
    count(distinct recip_id) "ADMIN_COUNT", --For total people
    MAX(EST_AGE_12PLUS_POP) as "POP_TOTAL",
    MAX(case when DATE(DS2_ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(DS2_ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
    CA_VACCINE.CA_VACCINE.VW_DERIVED_BASE_RECIPIENTS
  left join
    DATA_FROM_WEB.GEOGRAPHIC.VW_EST_COUNTY_POP_BY_RACE_ETH pop
    on pop.county_name=MIXED_COUNTY 
    and pop.race_eth=RECIP_RACE_ETH
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
    MAX(LATEST_ADMIN_DATE) "LATEST_ADMIN_DATE",
    SUM(POP_TOTAL) "POP_REGION_TOTAL"
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
      SM.CATEGORY,
      coalesce(GB.ADMIN_COUNT,0) "ADMIN_COUNT",
      TA.POP_REGION_TOTAL,
      coalesce(POP_TOTAL,0) as "POP_COUNT"
  from
    TA
  cross join
      SortMap SM
  left outer join
     GB
     on GB.REGION=TA.REGION
     and GB.CATEGORY=SM.CATEGORY
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
      SUM(ADMIN_COUNT),
      SUM(POP_REGION_TOTAL),
      SUM(POP_COUNT)
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