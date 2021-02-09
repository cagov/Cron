  -- Current vaccine administrations by gender (distinct people)
  -- 215 rows
  --   by county(REGION)
  --   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
  --      + "COUNTY_POPULATION" CATEGORY

select
    DATE(MAX(ADMIN_DATE)) AS "LATEST_ADMIN_DATE",
    RECIP_ADDRESS_COUNTY AS "REGION",
    coalesce(RECIP_SEX,'COUNTY_POPULATION') AS "CATEGORY",
    coalesce(POPULATION,count(distinct RECIP_ID)) AS "METRIC_VALUE"
from
    CA_VACCINE.VW_TAB_INT_ALL
group by
    RECIP_ADDRESS_COUNTY,
    RECIP_SEX,
    POPULATION
order by
    REGION,
    METRIC_VALUE desc