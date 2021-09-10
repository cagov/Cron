-- Number of people vaccinated in California (fully and partial)
select sum(1) as "TOTAL_VACCINATED"
from CA_VACCINE.CA_VACCINE.TBL_DERIVED_BASE_RECIPIENTS;
