// Runs the app's migrations against an in-memory Postgres with Supabase-like
// stubs, migrates sample data and checks the row level security rules.
// Usage: npm run test:db
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const migrations = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => path.join(dir, f));
const [m1, ...later] = migrations;
const db = new PGlite();
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`); if (!cond) failures++; };

await db.exec(`
  create role anon; create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, auth, storage to authenticated, anon;
  grant select, insert, delete on storage.objects to authenticated;
`);

await db.exec(fs.readFileSync(m1, "utf8"));
console.log("migration 1 applied");

const A = "00000000-0000-0000-0000-00000000000a"; // Papa (first user, family admin)
const B = "00000000-0000-0000-0000-00000000000b"; // Niko (invited)
await db.query(`insert into auth.users values ($1, '{"display_name":"Papa","cookbook_name":"Familie R"}')`, [A]);
const fam = (await db.query(`select id from public.cookbooks`)).rows[0].id;
await db.query(`insert into public.invites (cookbook_id, created_by) values ($1, $2)`, [fam, A]);
const tok = (await db.query(`select token from public.invites`)).rows[0].token;
await db.query(`insert into auth.users values ($1, $2)`, [B, JSON.stringify({ display_name: "Niko", invite_token: tok })]);
await db.query(`insert into public.recipes (cookbook_id, title, created_by) values ($1, 'Tiramisu Papa', $2), ($1, 'Tiramisu Niko', $3), ($1, 'Ohne Autor', null)`, [fam, A, B]);
const rPapa = (await db.query(`select id from public.recipes where title = 'Tiramisu Papa'`)).rows[0].id;
await db.query(`insert into public.recipe_images (recipe_id, cookbook_id, storage_path) values ($1, $2, $3)`, [rPapa, fam, `${fam}/${rPapa}/a.webp`]);

for (const m of later) await db.exec(fs.readFileSync(m, "utf8"));
console.log(`${later.length} later migration(s) applied\n`);

// --- data migration ---
ok((await db.query(`select count(*)::int n from public.families`)).rows[0].n === 1, "old cookbook became one family");
const books = (await db.query(`select id, owner_id, name from public.cookbooks order by name`)).rows;
ok(books.length === 2, `every member got a cookbook (${books.map((b) => b.name).join(", ")})`);
const bookOf = (u) => books.find((b) => b.owner_id === u).id;
const where = async (title) => (await db.query(`select cookbook_id from public.recipes where title = $1`, [title])).rows[0].cookbook_id;
ok((await where("Tiramisu Papa")) === bookOf(A), "Papa's recipe moved to Papa's cookbook");
ok((await where("Tiramisu Niko")) === bookOf(B), "Niko's recipe moved to Niko's cookbook");
ok((await where("Ohne Autor")) === bookOf(A), "recipe without author moved to the family admin's cookbook");
ok((await db.query(`select family_id from public.recipe_images`)).rows[0].family_id === fam, "image rows keep the family id");

// --- RLS as Papa ---
async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role;`); }
}
const tryQ = async (sql, params) => {
  try {
    return { rows: (await db.query(sql, params)).rows };
  } catch (e) {
    return { error: e.message };
  }
};

await as(A, async () => {
  ok((await db.query(`select count(*)::int n from public.recipes`)).rows[0].n === 3, "Papa can read all family recipes");
  ok((await db.query(`select count(*)::int n from public.cookbooks`)).rows[0].n === 2, "Papa can see all family cookbooks");
  const upd = await db.query(`update public.recipes set title = 'hacked' where title = 'Tiramisu Niko' returning id`);
  ok(upd.rows.length === 0, "Papa cannot edit Niko's recipe");
  const upd2 = await db.query(`update public.recipes set title = 'Tiramisu Papa 2' where title = 'Tiramisu Papa' returning id`);
  ok(upd2.rows.length === 1, "Papa can edit his own recipe");
  const ins = await tryQ(`insert into public.recipes (cookbook_id, title) values ($1, 'x')`, [bookOf(B)]);
  ok(Boolean(ins.error), "Papa cannot add a recipe to Niko's cookbook");
  const del = await db.query(`delete from public.cookbooks where id = $1 returning id`, [bookOf(A)]);
  ok(del.rows.length === 0, "a cookbook with recipes cannot be deleted");
  const nb = await db.query(`insert into public.cookbooks (family_id, owner_id, name) values ($1, $2, 'Backen') returning id`, [fam, A]);
  ok(nb.rows.length === 1, "Papa can create a second cookbook");
  const steal = await tryQ(`insert into public.cookbooks (family_id, owner_id, name) values ($1, $2, 'Fake')`, [fam, B]);
  ok(Boolean(steal.error), "Papa cannot create a cookbook owned by Niko");
  const del2 = await db.query(`delete from public.cookbooks where id = $1 returning id`, [nb.rows[0].id]);
  ok(del2.rows.length === 1, "an empty own cookbook can be deleted");
  const imgDel = await db.query(`delete from public.recipe_images where recipe_id = $1 returning id`, [rPapa]);
  ok(imgDel.rows.length === 1, "Papa can delete images of his recipe");
  const up = await tryQ(`insert into storage.objects (bucket_id, name) values ('recipe-images', $1)`, [`${fam}/new-recipe/x.webp`]);
  ok(!up.error, "family member can upload into the family folder");
  const inv = await db.query(`select count(*)::int n from public.invites`);
  ok(inv.rows[0].n === 1, "family admin can see invites");
});

await as(B, async () => {
  ok((await db.query(`select count(*)::int n from public.invites`)).rows[0].n === 0, "normal member cannot see invites");
  const up = await db.query(`update public.cookbooks set name = 'hacked' where owner_id = $1 returning id`, [A]);
  ok(up.rows.length === 0, "Niko cannot rename Papa's cookbook");
  const del = await db.query(`delete from public.recipes where cookbook_id = $1 returning id`, [bookOf(A)]);
  ok(del.rows.length === 0, "Niko cannot delete Papa's recipes");
});

const STRANGER = "00000000-0000-0000-0000-00000000000f";
await as(STRANGER, async () => {
  ok((await db.query(`select count(*)::int n from public.recipes`)).rows[0].n === 0, "outsider sees no recipes");
  const up = await tryQ(`insert into storage.objects (bucket_id, name) values ('recipe-images', $1)`, [`${fam}/x/y.webp`]);
  ok(Boolean(up.error), "outsider cannot upload into the family folder");
});

// --- sign-up after migration ---
await db.exec(`update public.app_config set signup_mode = 'invite'`);
const C = "00000000-0000-0000-0000-00000000000c";
await db.query(`insert into public.invites (family_id, created_by) values ($1, $2)`, [fam, A]);
const tok2 = (await db.query(`select token from public.invites where accepted_at is null`)).rows[0].token;
await db.query(`insert into auth.users values ($1, $2)`, [C, JSON.stringify({ display_name: "Mama", cookbook_name: "Mamas Kochbuch", invite_token: tok2 })]);
const cBooks = (await db.query(`select name, family_id from public.cookbooks where owner_id = $1`, [C])).rows;
ok(cBooks.length === 1 && cBooks[0].name === "Mamas Kochbuch" && cBooks[0].family_id === fam, "invited user joins the family with her own cookbook");
const D = "00000000-0000-0000-0000-00000000000d";
const blocked = await tryQ(`insert into auth.users values ($1, '{"display_name":"X"}')`, [D]);
ok(Boolean(blocked.error) && blocked.error.includes("signup_disabled"), "sign-up without invite is blocked in invite mode");
ok((await db.query(`select public.get_signup_mode() m`)).rows[0].m === "invite", "get_signup_mode works");
ok((await db.query(`select * from public.get_invite($1)`, [tok2])).rows.length === 0, "used invite is no longer valid");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
