select
    HPIQUARTILE
    ,count(vax_event_id)
from CA_VACCINE.CA_VACCINE.VW_DERIVED_BASE_DOSES_ADMIN
group by 1;