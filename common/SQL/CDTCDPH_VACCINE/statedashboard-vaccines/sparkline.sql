-- Data for Vaccines sparkline chart for state dashboard

SELECT TOP 100 TO_DATE(admin_date) as ADMIN_DATE, count(vax_event_id) AS COUNT 
FROM CA_VACCINE.VW_DERIVED_BASE_DOSES_ADMIN 
GROUP BY TO_DATE(ADMIN_DATE) 
ORDER BY TO_DATE(ADMIN_DATE) DESC;
