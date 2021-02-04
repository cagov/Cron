-- Unknown data for Cases and Deaths for SO and GI
-- 236 Rows
-- by SOGI_CATEGORY (gender_identity,sexual_orientation)
--   by METRIC (cases,deaths)
--   by COUNTY

select
  COUNTY,
  SOGI_CATEGORY,
  METRIC,
  MISSING,
  NOT_MISSING,
  TOTAL,
  PERCENT_COMPLETE,
  PERCENT_COMPLETE_30_DAYS_AGO,
  DIFF_30_DAY,REPORT_DATE
from
  PRODUCTION.VW_CDPH_SOGI_COMPLETENESS
where
  REPORT_DATE = (select max(REPORT_DATE) from PRODUCTION.VW_CDPH_DEMOGRAPHIC_COMPLETENESS)