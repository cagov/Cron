-- Data for COVID-19 Variants Charts

SELECT DATE,VARIANT_NAME,METRIC_NAME,VALUE,REPORT_DATE from COVID.PRODUCTION.VW_CDPH_COVID_VARIANTS WHERE AREA='California' 
ORDER BY DATE,VARIANT_NAME,METRIC_NAME
;

