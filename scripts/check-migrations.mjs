/**
 * Static checks over supabase/migrations/*.sql.
 *
 * ─── What this is for, and what it is not ─────────────────────────────────
 * Migrations in this directory are applied by hand, by pasting into the Studio
 * SQL editor. There is no `supabase db push` step that would catch a syntax
 * error before it reached production, and no CI database to apply them to.
 *
 * This does NOT parse SQL and cannot tell you a statement is valid — only
 * Postgres can do that, and the apply-time assertions at the end of each file
 * are what verify behaviour. What it does catch is the class of mistake that
 * is invisible when reading and fatal when pasting:
 *
 *   · an unbalanced dollar-quote tag, which silently swallows the rest of the
 *     file into a function body;
 *   · a SECURITY DEFINER function with no pinned search_path, which is the
 *     defect behind two production incidents this project has already had
 *     (see 20260905000001 §2);
 *   · a function granted to `anon` that was not meant to be;
 *   · a table created without RLS enabled.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────
 *     node scripts/check-migrations.mjs
 *
 * Exits non-zero on a finding, so it can be run before pasting anything.
 */

import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

/** Every `$tag$` occurrence, in order. */
function dollarTags(sql) {
  return [...sql.matchAll(/\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$/g)].map((m) => m[0]);
}

/**
 * Whether every dollar-quote tag is closed.
 *
 * Tags nest by name, not by position: `$fn$ … $blk$ … $blk$ … $fn$` is legal
 * and common here. So the check is per tag name, and an odd count for any name
 * means one is unclosed.
 */
function unbalancedTags(sql) {
  const counts = new Map();
  for (const tag of dollarTags(sql)) {
    counts.set(tag, (counts.get(tag) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n % 2 !== 0)
    .map(([tag, n]) => `${tag} appears ${n} times`);
}

/** Function bodies, as `{ header, body }` pairs. */
function functions(sql) {
  const out = [];
  const re =
    /CREATE (?:OR REPLACE )?FUNCTION\s+([\w.]+)\s*\(([\s\S]*?)\)([\s\S]*?)AS\s+(\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$)/gi;

  for (const match of sql.matchAll(re)) {
    out.push({
      name: match[1],
      header: match[3],
      index: match.index ?? 0,
    });
  }
  return out;
}

/**
 * SQL with comments and string literals removed, so a match means code.
 *
 * ─── The order matters, and getting it wrong is subtle ────────────────────
 * Comments FIRST. An apostrophe inside a `--` comment — "the module's whole
 * point" — is not a string delimiter, but a stripper that runs literals first
 * reads it as one and swallows everything to the next apostrophe, which can be
 * several lines of real code. That produced a false finding on the one block
 * that had just been fixed, which is the most misleading possible output.
 *
 * Replacements keep the line count intact so reported line numbers stay true.
 */
function strip(sql) {
  return sql
    .replace(/--[^\n]*/g, '')
    .replace(/'(?:[^']|'')*'/g, (match) => "''" + '\n'.repeat(
      (match.match(/\n/g) ?? []).length,
    ));
}

const findings = [];

function report(file, message) {
  findings.push(`${file}: ${message}`);
}

const files = (await readdir(DIR))
  .filter((name) => name.endsWith('.sql'))
  .sort();

for (const file of files) {
  const sql = await readFile(DIR + file, 'utf8');

  for (const problem of unbalancedTags(sql)) {
    report(file, `unbalanced dollar-quote tag — ${problem}`);
  }

  // ─── psql meta-commands ────────────────────────────────────────────────
  // `\i`, `\set`, `\copy` and friends are interpreted by the psql CLIENT, not
  // by Postgres. These files are pasted into the Studio SQL editor, which
  // sends them to the server as-is — so a meta-command arrives as SQL and
  // fails with `syntax error at or near "\"`.
  //
  // This check exists because exactly that happened: a `\i /dev/null`
  // placeholder survived into 20260912000002 and was found by somebody
  // running the migration, which is the worst place to find it. A line
  // starting with a backslash is never valid in a file meant for Studio.
  sql.split('\n').forEach((line, i) => {
    if (/^\s*\\/.test(line)) {
      report(
        file,
        `line ${i + 1}: psql meta-command "${line.trim()}" — these files are pasted into the Studio SQL editor, which sends them to the server verbatim`,
      );
    }
  });

  for (const fn of functions(sql)) {
    // `SET search_path = ''` makes name resolution independent of the caller.
    // Without it, a SECURITY DEFINER function can be made to resolve an
    // unqualified name against a schema the caller controls.
    if (!/SET\s+search_path\s*=/i.test(fn.header)) {
      report(
        file,
        `${fn.name}() does not pin search_path — required for every function in this schema`,
      );
    }

    // ─── Volatility is deliberately NOT checked ──────────────────────────
    // It was, briefly. It reported nine functions, every one of them a
    // pre-existing trigger or writer that omits the keyword — and omitting it
    // means VOLATILE, which is both the safe default and the correct answer
    // for all nine. A check whose every finding is a non-defect trains people
    // to ignore the output, which costs more than the rule was worth.
    //
    // The rules kept below are the ones where a finding is always a real
    // problem.
  }

  // ─── Subqueries inside a CHECK constraint ──────────────────────────────
  // Postgres refuses them outright:
  //
  //     ERROR:  0A000: cannot use subquery in check constraint
  //
  // The restriction is syntactic, so it fires even for `unnest()` of the
  // row's own column, which is the innocent case people reach for. A function
  // CALL is allowed, and the function's body may contain whatever it likes —
  // which is the shape every list rule in this schema uses.
  //
  // This check exists because 20260912000002 shipped with two of them and
  // failed on apply. Matching is deliberately crude: find `CHECK (`, walk to
  // its closing parenthesis, and look for a SELECT. Anything it flags is
  // worth a human look, and it cannot miss one.
  for (const match of sql.matchAll(/\bCHECK\s*\(/gi)) {
    const start = (match.index ?? 0) + match[0].length;
    let depth = 1;
    let i = start;
    while (i < sql.length && depth > 0) {
      if (sql[i] === '(') depth += 1;
      else if (sql[i] === ')') depth -= 1;
      i += 1;
    }
    const expression = sql.slice(start, i - 1);
    if (/\bSELECT\b/i.test(expression)) {
      const line = sql.slice(0, match.index).split('\n').length;
      report(
        file,
        `line ${line}: CHECK constraint contains a subquery — Postgres refuses this (0A000). Move the rule into an IMMUTABLE function and call it.`,
      );
    }
  }

  // ─── Apply-time assertions that need an authenticated caller ───────────
  // These files are applied by pasting them into the Studio SQL editor, where
  // there is no JWT: auth.uid() is NULL, so every "may this person…" predicate
  // is correctly FALSE.
  //
  // An assertion that calls a function gated on one of those predicates
  // therefore fails on apply — not because anything is wrong, but because the
  // session is not a person. That happened to 20260912000004, and the error it
  // produced ("not authorized to issue preview links") reads exactly like a
  // real authorization defect, which is the expensive part.
  //
  // The gated functions are DERIVED rather than listed: any function whose
  // body raises insufficient_privilege is one. A DO block that calls one must
  // also mention unchained_manages_content(), which is how a guarded probe
  // skips itself.
  const gated = [...sql.matchAll(
    /CREATE (?:OR REPLACE )?FUNCTION\s+public\.(\w+)\s*\([\s\S]*?\$(\w+)\$([\s\S]*?)\$\2\$/gi,
  )]
    .filter(([, , , body]) => /insufficient_privilege/i.test(body))
    .map(([, name]) => name);

  if (gated.length > 0) {
    for (const block of sql.matchAll(/DO\s+\$(\w+)\$([\s\S]*?)\$\1\$/gi)) {
      const body = strip(block[2]);
      const called = gated.filter((name) =>
        new RegExp(`\\b${name}\\s*\\(`).test(body),
      );
      if (called.length > 0 && !/unchained_manages_content\s*\(/.test(body)) {
        const line = sql.slice(0, block.index).split('\n').length;
        report(
          file,
          `line ${line}: an apply-time assertion calls ${called.join(', ')}(), which refuses a caller with no auth.uid() — guard it with unchained_manages_content() and RAISE NOTICE '[skip] …' instead`,
        );
      }
    }
  }

  // ─── plpgsql IF / END IF balance ───────────────────────────────────────
  // Cheap, and it catches the mistake a re-indent or a hand edit makes: an
  // unclosed IF swallows everything after it into the branch, which parses and
  // then behaves nothing like the file reads.
  //
  // ELSIF also ends in THEN but opens no new block, so it is subtracted.
  for (const block of sql.matchAll(/DO\s+\$(\w+)\$([\s\S]*?)\$\1\$/gi)) {
    const body = block[2];
    const opens =
      (body.match(/\bIF\b[\s\S]*?\bTHEN\b/gi) ?? []).length -
      (body.match(/\bELSIF\b/gi) ?? []).length;
    const closes = (body.match(/\bEND\s+IF\s*;/gi) ?? []).length;
    if (opens !== closes) {
      const line = sql.slice(0, block.index).split('\n').length;
      report(
        file,
        `line ${line}: DO block opens ${opens} IF blocks and closes ${closes}`,
      );
    }
  }

  // Every table this schema creates must enable RLS. A table without it is
  // readable by anyone holding the anon key.
  for (const match of sql.matchAll(
    /CREATE TABLE IF NOT EXISTS\s+(public\.[\w]+)/gi,
  )) {
    const table = match[1];
    const enabled = new RegExp(
      `ALTER TABLE\\s+${table.replace('.', '\\.')}\\s+ENABLE ROW LEVEL SECURITY`,
      'i',
    );
    if (!enabled.test(sql)) {
      report(file, `${table} is created without ENABLE ROW LEVEL SECURITY`);
    }
  }

  // A GRANT to anon is occasionally correct — the public list functions are
  // granted deliberately — so this only reports TABLE grants, which never are.
  for (const match of sql.matchAll(
    /GRANT[^;]*\bON\s+TABLE\s+([\w.]+)[^;]*\bTO\b[^;]*\banon\b/gi,
  )) {
    report(file, `${match[1]} grants table access to anon`);
  }
}

console.log(`Checked ${files.length} migration files.`);

if (findings.length > 0) {
  console.error(`\n${findings.length} finding(s):`);
  for (const finding of findings) console.error(`  · ${finding}`);
  process.exit(1);
}

console.log('No findings.');
