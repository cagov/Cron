select  
    LATEST_ADMIN_DATE,
    HPIQUARTILE,
    AGE16_POPULATION,
    FIRST_DOSE,
    SECOND_DOSE,
    FIRST_DOSE+SECOND_DOSE "COMBINED_DOSES",
    FIRST_DOSE/AGE16_POPULATION "FIRST_DOSE_RATIO",
    SECOND_DOSE/AGE16_POPULATION "SECOND_DOSE_RATIO",
    (FIRST_DOSE+SECOND_DOSE)/AGE16_POPULATION "COMBINED_DOSES_RATIO"
from 
    (
        select 
            MAX(case when DATE(ADMIN_DATE)>DATE(GETDATE()) then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE",
            HPIQUARTILE,
            SUM(case DOSE_NUM when '2' then 0 else 1 end) "FIRST_DOSE",
            SUM(case DOSE_NUM when '2' then 1 else 0 end) "SECOND_DOSE",
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