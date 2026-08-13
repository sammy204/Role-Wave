-- Keep storage references internal. The application displays resume_name;
-- resume_url stores only the object path used by the storage helper.

update public.candidate_profiles
set resume_url = regexp_replace(
  resume_url,
  '^https?://[^/]+/storage/v1/object/public/candidate-assets/',
  ''
)
where resume_url ~ '^https?://[^/]+/storage/v1/object/public/candidate-assets/';
