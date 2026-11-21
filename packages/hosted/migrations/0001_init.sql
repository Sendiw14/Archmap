-- ARCHMAP hosted metadata. Graph artifacts live in object storage; no source code is stored.
CREATE TABLE IF NOT EXISTS analyses (
  id                  uuid PRIMARY KEY,
  owner               text NOT NULL,
  repo                text NOT NULL,
  ref                 text,
  commit_sha          char(40) NOT NULL,
  status              text NOT NULL CHECK (status IN ('queued','fetching','analyzing','persisting','completed','completed_with_limitations','failed','cancelled','expired')),
  error_code          text,
  error_message       text,
  management_verifier char(64),
  client_key          char(64) NOT NULL,
  cache_key           char(64) NOT NULL,
  analyzer_version    text NOT NULL,
  schema_version      text NOT NULL,
  artifact_key        text,
  stats               jsonb,
  attempts            integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  expires_at          timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS analyses_cache_idx ON analyses (cache_key, created_at DESC) WHERE status IN ('completed','completed_with_limitations');
CREATE INDEX IF NOT EXISTS analyses_client_idx ON analyses (client_key, created_at);
CREATE INDEX IF NOT EXISTS analyses_expiry_idx ON analyses (expires_at) WHERE status <> 'expired';
CREATE INDEX IF NOT EXISTS analyses_active_idx ON analyses (status) WHERE status IN ('queued','fetching','analyzing','persisting');
