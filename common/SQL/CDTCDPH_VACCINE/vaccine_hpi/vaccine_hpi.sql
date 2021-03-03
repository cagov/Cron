select  
    LATEST_ADMIN_DATE,
    HPIQUARTILE,
    AGE16_POPULATION,
    FIRST_DOSE,
    COMPLETED_DOSE,
    FIRST_DOSE+COMPLETED_DOSE "COMBINED_DOSES",
    FIRST_DOSE/AGE16_POPULATION "FIRST_DOSE_RATIO",
    COMPLETED_DOSE/AGE16_POPULATION "COMPLETED_DOSE_RATIO",
    (FIRST_DOSE+COMPLETED_DOSE)/AGE16_POPULATION "COMBINED_DOSES_RATIO"
from 
    (
        select 
            MAX(case when DATE(ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE",
            HPIQUARTILE,
            count(distinct case ifnull(dose_num, '2') when '2' then null else recip_id end) "FIRST_DOSE",
            count(distinct case ifnull(dose_num, '2') when '2' then recip_id else null end) "COMPLETED_DOSE",
            SUM(AGE16_POPULATION) "AGE16_POPULATION"
        from
            CA_VACCINE.VW_TAB_INT_ALL
        where
            HPIQUARTILE is not null
        group by 
            HPIQUARTILE
    ) foo
order by
    HPIQUARTILE