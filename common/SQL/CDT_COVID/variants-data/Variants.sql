-- Data for COVID-19 Variants Charts

with main_q as
(select *
from COVID.PRODUCTION.VW_CDPH_COVID_VARIANTS) 
select  DATE,VARIANT_NAME,METRIC_NAME,VALUE,REPORT_DATE from main_q
where AREA='California' and  REPORT_DATE = (select max(REPORT_DATE) from main_q)
ORDER BY DATE,VARIANT_NAME,METRIC_NAME
;


