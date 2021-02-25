-- Current vaccine administrations by gender (distinct people)
-- 171 rows
--   by county(REGION) + 'California'
--   by gender(CATEGORY) (Female,Male,Unknown/undifferentiated)
with
GB as ( --Master list of corrected data grouped by region/category
  select
    RECIP_SEX "CATEGORY",
    case when MIXED_COUNTY in
        ('Alameda','Alpine','Amador','Butte','Calaveras','Colusa','Contra Costa','Del Norte','El Dorado','Fresno','Glenn','Humboldt','Imperial','Inyo','Kern','Kings','Lake','Lassen','Los Angeles','Madera','Marin','Mariposa','Mendocino','Merced','Modoc','Mono','Monterey','Napa','Nevada','Orange','Placer','Plumas','Riverside','Sacramento','San Benito','San Bernardino','San Diego','San Francisco','San Joaquin','San Luis Obispo','San Mateo','Santa Barbara','Santa Clara','Santa Cruz','Shasta','Sierra','Siskiyou','Solano','Sonoma','Stanislaus','Sutter','Tehama','Trinity','Tulare','Tuolumne','Ventura','Yolo','Yuba')
    then MIXED_COUNTY else 'Unknown' end "REGION",
    --count(distinct vax_event_id) "ADMIN_COUNT", --For total doses
    count(distinct recip_id) "ADMIN_COUNT", --For total people
    MAX(case when DATE(ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE"
  from
    (select 
     *,
        replace( 
            iff(RECIP_ADDRESS_STATE = 'CA',
                iff(RECIP_ADDRESS_COUNTY ='Unknown' , 
                   iff(ADMIN_ADDRESS_COUNTY is null,
                       'Unknown'
                   ,ADMIN_ADDRESS_COUNTY)
               ,RECIP_ADDRESS_COUNTY)
            ,'Outside California')
        ,' County') 
       AS Mixed_county
    from CA_VACCINE_UAT.VW_TAB_INT_ALL) foo
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