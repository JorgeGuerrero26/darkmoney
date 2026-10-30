import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { requestDetectedRegistrationUndo } from "../src/modules/notifications/lib/detection-undo.ts";

// Postgres in memory only. Never reads project credentials or connects to Supabase.
const migrationPath = "supabase/migrations/202610090002_detected_movement_undo.sql";
const readComparable = (path) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const migration = readComparable(resolve(migrationPath));
assert.equal(migration, readComparable(resolve("../DarkMoneyApp", migrationPath)), "Both clients must ship the same RPC");
assert.equal(readComparable("src/modules/notifications/lib/detection-undo.ts"),
  readComparable("../DarkMoneyApp/features/detected-movements/lib/detection-undo.ts"), "Both clients must use the same Undo contract");
const db = new PGlite();
const uid = "11111111-1111-1111-1111-111111111111";
const other = "22222222-2222-2222-2222-222222222222";
try {
  await db.exec(`
    create role authenticated; create role anon;
    create schema auth;
    create function auth.uid() returns uuid language sql as $$
      select nullif(current_setting('app.test_user', true), '')::uuid;
    $$;
    create function public.is_workspace_member(id bigint) returns boolean language sql as $$
      select id = 8 and coalesce(current_setting('app.member', true), 'true') = 'true';
    $$;
    create function public.has_email_detection_pro_access() returns boolean language sql as $$
      select coalesce(current_setting('app.pro', true), 'true') = 'true';
    $$;
    create table public.movements (
      id bigint primary key, workspace_id bigint not null, created_by_user_id uuid,
      movement_type text not null default 'expense', status text not null default 'posted',
      client_dedupe_key text, metadata jsonb not null default '{}', obligation_id bigint,
      source_amount numeric, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
      unique(workspace_id, client_dedupe_key)
    );
    create table public.notification_detected_movement_suggestions (
      id bigint primary key, workspace_id bigint not null, user_id uuid not null,
      status text not null, movement_id bigint references public.movements(id) on delete set null,
      package_name text not null default 'app.bcp', metadata jsonb not null default '{}', updated_at timestamptz not null default now()
    );
    create table public.attachments (id bigint primary key, workspace_id bigint not null, entity_type text, entity_id bigint);
    create table public.feedback (movement_id bigint references public.movements(id) on delete cascade);
    create table public.notifications (status text, read_at timestamptz, archived_at timestamptz, payload jsonb);
    insert into notifications values ('read', '2026-10-09', '2026-10-09', '{"status":"registered"}');
    alter table movements enable row level security;
    alter table notification_detected_movement_suggestions enable row level security;
    alter table attachments enable row level security;
    create policy movement_read on movements for select to authenticated using (is_workspace_member(workspace_id));
    create policy movement_update on movements for update to authenticated using (is_workspace_member(workspace_id)) with check (is_workspace_member(workspace_id));
    create policy movement_delete on movements for delete to authenticated using (
      is_workspace_member(workspace_id) and id::text <> coalesce(current_setting('app.deny_delete', true), '')
    );
    create policy suggestion_read on notification_detected_movement_suggestions for select to authenticated using (user_id = auth.uid() and is_workspace_member(workspace_id));
    create policy suggestion_update on notification_detected_movement_suggestions for update to authenticated
      using (user_id = auth.uid() and is_workspace_member(workspace_id) and (coalesce(current_setting('app.deny_update', true), '') <> 'true' or movement_id is not null))
      with check (user_id = auth.uid() and is_workspace_member(workspace_id));
    create policy attachment_read on attachments for select to authenticated using (is_workspace_member(workspace_id));
    grant usage on schema public, auth to authenticated, anon;
    grant select, update, delete on movements to authenticated;
    grant select, update on notification_detected_movement_suggestions to authenticated;
    grant select on attachments to authenticated;
    create function public.fail_reopen_fixture() returns trigger language plpgsql as $$ begin
      if new.status = 'pending' and current_setting('app.fail_reopen', true) = 'true' then
        raise exception 'fixture reopen failure';
      end if;
      return new;
    end $$;
    create trigger fail_reopen_fixture before update on notification_detected_movement_suggestions
      for each row execute function fail_reopen_fixture();
  `);
  await db.exec(migration);
  const privilege = await db.query(`select
    has_function_privilege('anon', 'public.undo_detected_movement_registration(bigint,bigint,bigint)', 'execute') as anon,
    has_function_privilege('authenticated', 'public.undo_detected_movement_registration(bigint,bigint,bigint)', 'execute') as authenticated,
    (select prosecdef from pg_proc where proname = 'undo_detected_movement_registration') as definer`);
  assert.deepEqual(privilege.rows[0], { anon: false, authenticated: true, definer: false });

  async function seed({ split = false, status = "registered", owner = uid, packageName = "app.bcp" } = {}) {
    await db.exec("reset role; truncate notification_detected_movement_suggestions, movements, attachments, feedback;");
    for (const [key, value] of Object.entries({ test_user: uid, member: "true", pro: "true", deny_delete: "", deny_update: "", fail_reopen: "" })) {
      await db.query("select set_config($1, $2, false)", [`app.${key}`, value]);
    }
    const meta = { source: "notification_detection", suggestionId: 90, ...(split ? { split_group: "suggestion:90", split_index: 1, split_total: 2 } : {}) };
    await db.query("insert into movements(id,workspace_id,created_by_user_id,client_dedupe_key,metadata,source_amount) values (70,8,$1,'suggestion:90',$2,12)", [uid, JSON.stringify(meta)]);
    if (split) await db.query("insert into movements(id,workspace_id,created_by_user_id,client_dedupe_key,metadata,source_amount) values (71,8,$1,'suggestion:90:split-2',$2,8)", [uid, JSON.stringify({ ...meta, split_index: 2 })]);
    await db.query("insert into movements(id,workspace_id,created_by_user_id,metadata,source_amount) values (99,8,$1,'{}',100)", [uid]);
    await db.query("insert into notification_detected_movement_suggestions(id,workspace_id,user_id,status,movement_id,package_name) values (90,8,$1,$2,70,$3)", [owner, status, packageName]);
    await db.exec("insert into feedback values (70); set role authenticated;");
  }
  async function undo(workspace = 8, suggestion = 90, movement = 70) {
    return requestDetectedRegistrationUndo({ rpc: async (name, args) => {
      assert.equal(name, "undo_detected_movement_registration");
      try {
        const result = await db.query("select public.undo_detected_movement_registration($1,$2,$3) as result", [args.p_workspace_id, args.p_suggestion_id, args.p_expected_movement_id]);
        return { data: result.rows[0].result, error: null };
      } catch (error) { return { data: null, error: { message: error.message } }; }
    } }, { workspaceId: workspace, suggestionId: suggestion, movementId: movement });
  }
  async function snapshot() {
    await db.exec("reset role");
    const result = (await db.query(`select
      (select coalesce(jsonb_agg(to_jsonb(m) order by id), '[]') from movements m) as movements,
      (select coalesce(jsonb_agg(to_jsonb(s) order by id), '[]') from notification_detected_movement_suggestions s) as suggestions,
      (select count(*)::int from feedback) as feedback,
      (select jsonb_agg(to_jsonb(n)) from notifications n) as notifications`)).rows[0];
    await db.exec("set role authenticated");
    return result;
  }
  async function failUnchanged(action, pattern) {
    const before = await snapshot();
    await assert.rejects(action(), pattern);
    assert.deepEqual(await snapshot(), before, "Every failure must roll back the full operation");
  }

  await seed();
  const notices = (await snapshot()).notifications;
  const result = await undo();
  assert.deepEqual(result, { suggestionId: 90, workspaceId: 8, status: "pending", movementId: null, deletedMovementIds: [70], alreadyUndone: false });
  let after = await snapshot();
  assert.deepEqual(after.movements.map((row) => row.id), [99]);
  assert.equal(after.feedback, 0);
  assert.equal(after.suggestions[0].status, "pending");
  assert.equal(after.suggestions[0].movement_id, null);
  assert.deepEqual(after.notifications, notices, "Undo must not reset reading/archive/payload");
  assert.equal((await undo()).alreadyUndone, true, "Lost response retry is safe");
  await db.exec("reset role");
  await db.query("insert into movements(id,workspace_id,created_by_user_id,client_dedupe_key,metadata) values (72,8,$1,'suggestion:90',$2)", [uid, JSON.stringify({ source: "notification_detection", suggestionId: 90 })]);
  await db.exec("update notification_detected_movement_suggestions set status='registered',movement_id=72 where id=90; set role authenticated");
  await failUnchanged(() => undo(), /cambió/);

  await seed({ split: true });
  assert.deepEqual((await undo()).deletedMovementIds, [70, 71]);
  after = await snapshot();
  assert.equal(after.movements.reduce((sum, row) => sum + Number(row.source_amount), 0), 100, "Undo removes the whole split, not just its first amount");

  for (const sql of [
    "delete from movements where id=71",
    "update movements set metadata=jsonb_set(metadata,'{split_index}','1') where id=71",
    "update movements set metadata=jsonb_set(metadata,'{split_total}','3') where id=71",
    "update movements set client_dedupe_key='foreign-key' where id=71",
    "update movements set movement_type='income' where id=71",
    `update movements set created_by_user_id='${other}' where id=71`,
  ]) {
    await seed({ split: true });
    await db.exec(`reset role; ${sql}; set role authenticated`);
    await failUnchanged(() => undo(), /división|vinculado/);
  }
  for (const sql of [
    "update movements set metadata='{}' where id=70",
    "update movements set client_dedupe_key='manual' where id=70",
    "update movements set status='voided' where id=70",
    "update movements set updated_at=updated_at+interval '1 second' where id=70",
    "update movements set obligation_id=3 where id=70",
    "insert into attachments values (1,8,'movement',70)",
  ]) {
    await seed(); await db.exec(`reset role; ${sql}; set role authenticated`);
    await failUnchanged(() => undo(), /vinculado|manual|comprobante/);
  }
  await seed({ owner: other }); await failUnchanged(() => undo(), /disponible/);
  await seed({ status: "duplicate" }); await failUnchanged(() => undo(), /cambió/);
  await seed(); await failUnchanged(() => undo(9), /acceso/);
  await failUnchanged(() => undo(8, 91), /disponible/);
  await failUnchanged(() => undo(8, 90, 99), /cambió/);
  await db.query("select set_config('app.test_user', '', false)"); await failUnchanged(() => undo(), /acceso/);
  await seed(); await db.query("select set_config('app.member', 'false', false)"); await failUnchanged(() => undo(), /acceso/);
  await seed({ packageName: "email:inbound" }); await db.query("select set_config('app.pro', 'false', false)"); await failUnchanged(() => undo(), /PRO/);
  await seed({ split: true }); await db.query("select set_config('app.deny_delete', '71', false)"); await failUnchanged(() => undo(), /permiso/);
  await seed(); await db.exec(`reset role;
    insert into notification_detected_movement_suggestions(id, workspace_id, user_id, status, movement_id)
      values (91, 8, '${other}', 'duplicate', 70); set role authenticated`);
  await failUnchanged(() => undo(), /Otro aviso/);
  await assert.rejects(db.query("select public.detected_registration_has_other_links(8,91,array[70]::bigint[])"), /acceso/);
  await seed(); await db.exec(`reset role;
    insert into movements(id,workspace_id,created_by_user_id,client_dedupe_key,metadata)
      values (71,8,'${uid}','suggestion:90:split-2','{"source":"notification_detection","suggestionId":90,"split_group":"suggestion:90","split_index":2,"split_total":2}');
    set role authenticated`);
  await failUnchanged(() => undo(), /otras partes/);
  await seed(); await db.query("select set_config('app.deny_update', 'true', false)"); await failUnchanged(() => undo(), /reabrir/);
  await seed(); await db.query("select set_config('app.fail_reopen', 'true', false)"); await failUnchanged(() => undo(), /fixture reopen failure/);
  for (const bad of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(requestDetectedRegistrationUndo({ rpc: async () => assert.fail("Invalid ID must not call the server") }, { workspaceId: 8, suggestionId: 90, movementId: bad }), /disponible/);
  }
  for (const change of [{ workspaceId: 9 }, { suggestionId: 91 }, { status: "registered" }, { movementId: 70 }, { deletedMovementIds: [] }, { deletedMovementIds: [71] }, { deletedMovementIds: [70, 70] }, { alreadyUndone: "false" }]) {
    await assert.rejects(requestDetectedRegistrationUndo({ rpc: async () => ({ data: { ...result, ...change }, error: null }) }, { workspaceId: 8, suggestionId: 90, movementId: 70 }), /confirmar/);
  }
  let rpcCalls = 0;
  await assert.rejects(requestDetectedRegistrationUndo({ rpc: async () => { rpcCalls++; return { data: null, error: { message: "RPC missing" } }; } }, { workspaceId: 8, suggestionId: 90, movementId: 70 }), /RPC missing/);
  assert.equal(rpcCalls, 1, "No delete/update fallback when the RPC is unavailable");
  const mobileHook = readFileSync("../DarkMoneyApp/features/detected-movements/hooks/useDetectedMovementReview.ts", "utf8");
  assert.match(mobileHook, /undoDetectedRegistration\.mutateAsync\(/);
  assert.doesNotMatch(mobileHook, /deleteMovement\.mutate\(/);
  console.log("detected-movement-undo: OK (in-memory Postgres, RLS, complete splits, FK, rollback, retries; no production connection)");
} catch (error) {
  console.error("detected-movement-undo: FAILED", error.message, error.where ?? "");
  process.exitCode = 1;
} finally {
  await db.close();
}
