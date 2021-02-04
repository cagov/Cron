  -- Current vaccine data
  -- JSON ex { "CUMULATIVE_TOTAL": 3984752, "DAILY_CHANGE": 191955, "DATE": "2021-02-04", "PERCENT_DAILY": 33.899984 } 
  -- 1 row
  
  select
    VACCINE_KPI_JSON
  from
    CA_VACCINE.CA_VACCINE.Vw_Website_kpi_Vaccines