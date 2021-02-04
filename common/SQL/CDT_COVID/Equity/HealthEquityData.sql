-- Test positivity rate, Lowest 25% healthy HE index
-- 3,540+ Rows
-- by COUNTY
--   by DATE (All of them?)
--   by METRIC (county_positivity_all_nopris,county_positivity_low_hpi)

select
  COUNTY,
  DATE,
  METRIC, 
  METRIC_VALUE, 
  METRIC_VALUE_30_DAYS_AGO, 
  METRIC_VALUE_DIFF
from
  COVID.PRODUCTION.VW_EQUITY_METRIC_POS_30_DAY_BY_CNT