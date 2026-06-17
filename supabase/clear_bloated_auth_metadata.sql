update auth.users
set raw_user_meta_data =
  coalesce(raw_user_meta_data, '{}'::jsonb)
  - 'simulationDrafts'
  - 'simulationSummaries'
  - 'simulationResults'
where coalesce(raw_user_meta_data, '{}'::jsonb)
  ?| array['simulationDrafts', 'simulationSummaries', 'simulationResults'];
