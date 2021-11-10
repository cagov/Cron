-- Eligble population in california
select sum(est_population) as "ELIGIBLE_POPULATION"
from CA_VACCINE.CA_VACCINE.VW_CA_DOF_EST_COUNTY_POP_BY_SEX_RACE_AGE
where age >= 5;

