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
            MAX(DATE(ADMIN_DATE)) "LATEST_ADMIN_DATE",
            HPIQUARTILE,
            count(distinct case when ifnull(dose_num,'2')='2' or VAX_LABEL='J&J' then null else recip_id end) "FIRST_DOSE",
            count(distinct case when ifnull(dose_num,'2')='2' or VAX_LABEL='J&J' then recip_id else null end) "COMPLETED_DOSE",
            SUM(AGE16_POPULATION) "AGE16_POPULATION"
        from
            CA_VACCINE.VW_TAB_INT_ALL
        where
            HPIQUARTILE is not null
            and (ADMIN_DATE is null or DATE(ADMIN_DATE) < CURRENT_DATE())
        group by 
            HPIQUARTILE
    ) foo
order by
    HPIQUARTILE