// Runs the app's migrations against an in-memory Postgres with Supabase-like
// stubs: applies the first migration, adds sample data, applies all later
// migrations (testing the data migration) and checks the row level security.
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
const ok = (cond, msg) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${msg}`);
  if (!cond) failures++;
};
const one = async (sql, params) => (await db.query(sql, params)).rows[0];
const rows = async (sql, params) => (await db.query(sql, params)).rows;
const tryQ = async (sql, params) => {
  try {
    return { rows: (await db.query(sql, params)).rows };
  } catch (e) {
    return { error: e.message };
  }
};
async function as(user, fn) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${user}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role;`);
  }
}

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
  alter default privileges in schema public grant all on tables to authenticated, anon;
`);

// ---------------------------------------------------------------------------
// Data in the original (first migration) structure
// ---------------------------------------------------------------------------
await db.exec(fs.readFileSync(m1, "utf8"));
const A = "00000000-0000-0000-0000-00000000000a"; // Papa (first user, family admin)
const B = "00000000-0000-0000-0000-00000000000b"; // Niko (invited)
await db.query(`insert into auth.users values ($1, '{"display_name":"Papa","cookbook_name":"Familie R"}')`, [A]);
const fam = (await one(`select id from public.cookbooks`)).id;
await db.query(`insert into public.invites (cookbook_id, created_by) values ($1, $2)`, [fam, A]);
const tok = (await one(`select token from public.invites`)).token;
await db.query(`insert into auth.users values ($1, $2)`, [B, JSON.stringify({ display_name: "Niko", invite_token: tok })]);
await db.query(
  `insert into public.recipes (cookbook_id, title, created_by) values ($1, 'Tiramisu Papa', $2), ($1, 'Tiramisu Niko', $3), ($1, 'Ohne Autor', null)`,
  [fam, A, B],
);
const rPapa = (await one(`select id from public.recipes where title = 'Tiramisu Papa'`)).id;
const rNiko = (await one(`select id from public.recipes where title = 'Tiramisu Niko'`)).id;
await db.query(`insert into public.recipe_images (recipe_id, cookbook_id, storage_path) values ($1, $2, $3)`, [rPapa, fam, `${fam}/${rPapa}/a.webp`]);

for (const m of later) await db.exec(fs.readFileSync(m, "utf8"));
console.log(`applied ${migrations.length} migrations\n`);

// ---------------------------------------------------------------------------
// Data migration
// ---------------------------------------------------------------------------
ok((await one(`select count(*)::int n from public.families`)).n === 1, "old cookbook became one family");
const books = await rows(`select id, owner_id, name, is_default from public.cookbooks`);
ok(books.length === 2 && books.every((b) => b.is_default), `every member has one main cookbook (${books.map((b) => b.name).join(", ")})`);
const mainOf = (u) => books.find((b) => b.owner_id === u).id;
const owner = async (title) => (await one(`select owner_id, family_id from public.recipes where title = $1`, [title]));
ok((await owner("Tiramisu Papa")).owner_id === A, "Papa owns his recipe");
ok((await owner("Tiramisu Niko")).owner_id === B, "Niko owns his recipe");
ok((await owner("Ohne Autor")).owner_id === A, "recipe without author belongs to the family admin");
ok((await owner("Tiramisu Niko")).family_id === fam, "recipes keep their family");
ok((await one(`select count(*)::int n from public.cookbook_recipes`)).n === 0, "main cookbooks need no link rows");
ok((await one(`select family_id from public.recipe_images`)).family_id === fam, "image rows keep the family id");

// ---------------------------------------------------------------------------
// Papa
// ---------------------------------------------------------------------------
let papaCollection;
await as(A, async () => {
  ok((await one(`select count(*)::int n from public.recipes`)).n === 3, "Papa can read all family recipes");
  ok((await one(`select count(*)::int n from public.cookbooks`)).n === 2, "Papa can see all family cookbooks");
  ok((await rows(`update public.recipes set title = 'hacked' where id = $1 returning id`, [rNiko])).length === 0, "Papa cannot edit Niko's recipe");
  ok((await rows(`update public.recipes set title = 'Tiramisu Papa 2' where id = $1 returning id`, [rPapa])).length === 1, "Papa can edit his own recipe");
  ok(Boolean((await tryQ(`insert into public.recipes (owner_id, family_id, title) values ($1, $2, 'x')`, [B, fam])).error), "Papa cannot create a recipe owned by Niko");
  ok(!(await tryQ(`insert into public.recipes (owner_id, family_id, title) values ($1, $2, 'Neu')`, [A, fam])).error, "Papa can create his own recipe");
  ok(!(await tryQ(`insert into public.recipes (owner_id, family_id, title, language) values ($1, $2, 'Tiramisù', 'it')`, [A, fam])).error, "recipes can have a content language");
  ok(Boolean((await tryQ(`insert into public.recipes (owner_id, family_id, title, language) values ($1, $2, 'x', 'fr')`, [A, fam])).error), "unknown languages are rejected");

  papaCollection = (await one(`insert into public.cookbooks (family_id, owner_id, name) values ($1, $2, 'Weihnachten') returning id`, [fam, A])).id;
  ok(Boolean(papaCollection), "Papa can create a collection");
  ok(Boolean((await tryQ(`insert into public.cookbooks (family_id, owner_id, name, is_default) values ($1, $2, 'x', true)`, [fam, A])).error), "clients cannot create a main cookbook");
  ok(Boolean((await tryQ(`update public.cookbooks set is_default = false where id = $1`, [mainOf(A)])).error), "clients cannot change is_default");
  ok(Boolean((await tryQ(`insert into public.cookbooks (family_id, owner_id, name) values ($1, $2, 'Fake')`, [fam, B])).error), "Papa cannot create a cookbook owned by Niko");

  ok(!(await tryQ(`insert into public.cookbook_recipes (cookbook_id, recipe_id, added_by) values ($1, $2, $3)`, [papaCollection, rNiko, A])).error, "Papa can add Niko's recipe to his collection");
  ok(!(await tryQ(`insert into public.cookbook_recipes (cookbook_id, recipe_id, added_by) values ($1, $2, $3)`, [papaCollection, rPapa, A])).error, "Papa can add his own recipe to his collection");
  ok(Boolean((await tryQ(`insert into public.cookbook_recipes (cookbook_id, recipe_id, added_by) values ($1, $2, $3)`, [mainOf(A), rNiko, A])).error), "nothing can be linked into a main cookbook");
  ok(Boolean((await tryQ(`insert into public.cookbook_recipes (cookbook_id, recipe_id, added_by) values ($1, $2, $3)`, [mainOf(B), rPapa, A])).error), "Papa cannot add to Niko's cookbooks");
  ok((await rows(`update public.recipes set title = 'hacked' where id = $1 returning id`, [rNiko])).length === 0, "a linked recipe stays read-only for Papa");

  ok((await rows(`delete from public.cookbooks where id = $1 returning id`, [mainOf(A)])).length === 0, "a main cookbook cannot be deleted");
  ok((await rows(`delete from public.recipe_images where recipe_id = $1 returning id`, [rPapa])).length === 1, "Papa can delete images of his recipe");
  ok(!(await tryQ(`insert into storage.objects (bucket_id, name) values ('recipe-images', $1)`, [`${fam}/new-recipe/x.webp`])).error, "family member can upload into the family folder");
  ok((await one(`select count(*)::int n from public.invites`)).n === 1, "family admin can see invites");
});

// ---------------------------------------------------------------------------
// Niko
// ---------------------------------------------------------------------------
await as(B, async () => {
  ok((await one(`select count(*)::int n from public.invites`)).n === 0, "normal member cannot see invites");
  ok((await rows(`select recipe_id from public.cookbook_recipes where cookbook_id = $1`, [papaCollection])).length === 2, "Niko can see what is in Papa's collection");
  ok((await rows(`delete from public.cookbook_recipes where cookbook_id = $1 returning recipe_id`, [papaCollection])).length === 0, "Niko cannot remove recipes from Papa's collection");
  ok((await rows(`update public.cookbooks set name = 'hacked' where id = $1 returning id`, [mainOf(A)])).length === 0, "Niko cannot rename Papa's cookbook");
  ok((await rows(`delete from public.recipes where id = $1 returning id`, [rPapa])).length === 0, "Niko cannot delete Papa's recipes");
  ok((await rows(`update public.cookbooks set name = 'Nikos Kochbuch' where id = $1 returning id`, [mainOf(B)])).length === 1, "Niko can rename his own cookbook");
});

// ---------------------------------------------------------------------------
// Papa removes a link and deletes his collection; recipes stay
// ---------------------------------------------------------------------------
await as(A, async () => {
  ok((await rows(`delete from public.cookbook_recipes where cookbook_id = $1 and recipe_id = $2 returning recipe_id`, [papaCollection, rNiko])).length === 1, "Papa can remove a recipe from his collection");
  ok((await rows(`delete from public.cookbooks where id = $1 returning id`, [papaCollection])).length === 1, "Papa can delete a non-empty collection");
});
ok((await one(`select count(*)::int n from public.recipes where id in ($1, $2)`, [rPapa, rNiko])).n === 2, "recipes survive removing links and deleting collections");
ok((await one(`select count(*)::int n from public.cookbook_recipes`)).n === 0, "links of a deleted collection are gone");

// ---------------------------------------------------------------------------
// Family notes
// ---------------------------------------------------------------------------
let nikoNote;
await as(B, async () => {
  nikoNote = (await one(`insert into public.recipe_notes (recipe_id, author_id, body) values ($1, $2, 'Weniger Zucker') returning id`, [rPapa, B])).id;
  ok(Boolean(nikoNote), "Niko can add a note to Papa's recipe");
  ok(Boolean((await tryQ(`insert into public.recipe_notes (recipe_id, author_id, body) values ($1, $2, 'fake')`, [rPapa, A])).error), "Niko cannot write a note in Papa's name");
  ok((await rows(`update public.recipe_notes set body = 'Viel weniger Zucker' where id = $1 returning id`, [nikoNote])).length === 1, "Niko can edit his note");
});
await as(A, async () => {
  ok((await rows(`select id from public.recipe_notes where recipe_id = $1`, [rPapa])).length === 1, "Papa can read notes on his recipe");
  ok((await rows(`update public.recipe_notes set body = 'hacked' where id = $1 returning id`, [nikoNote])).length === 0, "Papa cannot edit Niko's note");
  const own = (await one(`insert into public.recipe_notes (recipe_id, author_id, body) values ($1, $2, 'Danke!') returning id`, [rNiko, A])).id;
  ok(Boolean(own), "Papa can add a note to Niko's recipe");
});
await as(B, async () => {
  ok((await rows(`delete from public.recipe_notes where recipe_id = $1 and author_id = $2 returning id`, [rNiko, A])).length === 1, "recipe owner can delete notes on his recipe");
});
await as(A, async () => {
  ok((await rows(`delete from public.recipe_notes where id = $1 returning id`, [nikoNote])).length === 1, "family admin can delete any note");
});
await as("00000000-0000-0000-0000-00000000000f", async () => {
  ok(Boolean((await tryQ(`insert into public.recipe_notes (recipe_id, author_id, body) values ($1, $2, 'x')`, [rPapa, "00000000-0000-0000-0000-00000000000f"])).error), "outsider cannot add notes");
});

// ---------------------------------------------------------------------------
// Outsider
// ---------------------------------------------------------------------------
const STRANGER = "00000000-0000-0000-0000-00000000000f";
await as(STRANGER, async () => {
  ok((await one(`select count(*)::int n from public.recipes`)).n === 0, "outsider sees no recipes");
  ok(Boolean((await tryQ(`insert into storage.objects (bucket_id, name) values ('recipe-images', $1)`, [`${fam}/x/y.webp`])).error), "outsider cannot upload into the family folder");
});

// ---------------------------------------------------------------------------
// Sign-up after the migrations
// ---------------------------------------------------------------------------
await db.exec(`update public.app_config set signup_mode = 'invite'`);
const C = "00000000-0000-0000-0000-00000000000c";
await db.query(`insert into public.invites (family_id, created_by) values ($1, $2)`, [fam, A]);
const tok2 = (await one(`select token from public.invites where accepted_at is null`)).token;
await db.query(`insert into auth.users values ($1, $2)`, [C, JSON.stringify({ display_name: "Mama", cookbook_name: "Mamas Kochbuch", invite_token: tok2 })]);
const cBooks = await rows(`select name, family_id, is_default from public.cookbooks where owner_id = $1`, [C]);
ok(cBooks.length === 1 && cBooks[0].name === "Mamas Kochbuch" && cBooks[0].family_id === fam && cBooks[0].is_default, "invited user joins the family with her own main cookbook");
const blocked = await tryQ(`insert into auth.users values ($1, '{"display_name":"X"}')`, ["00000000-0000-0000-0000-00000000000d"]);
ok(Boolean(blocked.error) && blocked.error.includes("signup_disabled"), "sign-up without invite is blocked in invite mode");
ok((await one(`select public.get_signup_mode() m`)).m === "invite", "get_signup_mode works");
ok((await rows(`select * from public.get_invite($1)`, [tok2])).length === 0, "used invite is no longer valid");

console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
