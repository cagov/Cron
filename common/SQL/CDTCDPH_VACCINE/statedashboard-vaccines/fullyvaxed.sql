-- Number fully vaccinated in California
select sum(iff(fully_vaccinated,1,0)) as "FULLY_VACCINATED"
from CA_VACCINE.CA_VACCINE.TBL_DERIVED_BASE_RECIPIENTS;
