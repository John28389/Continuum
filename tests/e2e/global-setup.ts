import { runSql } from "./db";

/**
 * The end-to-end user.
 *
 * Created directly in the database rather than through a sign-up call, because
 * sign-up is disabled — which is the point of the deployment being single-user.
 * The credentials are local-only fixtures and exist nowhere but this file.
 */
export const TEST_USER = {
  email: "e2e@continuum.test",
  password: "continuum-e2e-password",
} as const;

/**
 * Two details here were established by experiment rather than assumption, and
 * both fail confusingly if missed:
 *
 *   1. The password must be a real bcrypt hash. The SQL suite's helper uses an
 *      inert one, which is fine for `auth.uid()` but cannot authenticate.
 *   2. The token columns must be empty strings, not NULL. Auth scans them into
 *      a non-nullable string and answers a login attempt with
 *      "Database error querying schema", which reads like a broken database
 *      rather than a malformed fixture.
 *
 * A matching row in `auth.identities` is created too, since that is what a real
 * email sign-up produces.
 */
const CREATE_TEST_USER = `
delete from auth.users where email = '${TEST_USER.email}';

with new_user as (
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token,
    email_change, email_change_token_new, email_change_token_current,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', '${TEST_USER.email}',
    extensions.crypt('${TEST_USER.password}', extensions.gen_salt('bf')),
    now(), now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
    '', '', '', '', '', '', '', ''
  )
  returning id, email
)
insert into auth.identities (
  provider_id, user_id, identity_data, provider,
  last_sign_in_at, created_at, updated_at
)
select
  id::text,
  id,
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
  'email',
  now(), now(), now()
from new_user;
`;

export default function globalSetup() {
  runSql(CREATE_TEST_USER);
}
