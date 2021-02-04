-- Case rate of median income <40K

select top 1
    DATE,
    STATE_CASE_RATE_PER_100K,
    CASE_RATE_PER_100K,
    POPULATION,
    CASES_7DAYAVG_7DAYSAGO,
    RATE_DIFF_30_DAYS
from
    COVID.PRODUCTION.VW_CDPH_CASE_RATE_BY_SOCIAL_DET
where 
    SOCIAL_DET='income_cumulative' and
    SOCIAL_TIER='below $40K'
order by
    DATE desc