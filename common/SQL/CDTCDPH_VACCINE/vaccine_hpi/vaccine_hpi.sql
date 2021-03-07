select  
    LATEST_ADMIN_DATE,
    HPIQUARTILE,
    AGE16_POPULATION,
    FIRST_DOSE,
    FIRST_DOSE_ONLY,
    COMPLETED_DOSE,
    FIRST_DOSE+COMPLETED_DOSE "COMBINED_DOSES",
    FIRST_DOSE_ONLY/AGE16_POPULATION "FIRST_DOSE_RATIO",
    COMPLETED_DOSE/AGE16_POPULATION "COMPLETED_DOSE_RATIO",
    (FIRST_DOSE+COMPLETED_DOSE)/AGE16_POPULATION "COMBINED_DOSES_RATIO"
from 
    (
        select
            MAX(case when DATE(ADMIN_DATE)>CURRENT_DATE() then NULL else DATE(ADMIN_DATE) end) "LATEST_ADMIN_DATE",
            HPIQUARTILE,
            count(distinct case when ifnull(dose_num,'2')='2' or VAX_LABEL='J&J' or recip_id in(select recip_id from CA_VACCINE.VW_TAB_INT_ALL where dose_num = '2') then null else recip_id end) "FIRST_DOSE_ONLY",
            count(distinct case when ifnull(dose_num,'2')='2' or VAX_LABEL='J&J' then null else recip_id end) "FIRST_DOSE",
            count(distinct case when ifnull(dose_num,'2')='2' or VAX_LABEL='J&J' then recip_id else null end) "COMPLETED_DOSE",
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