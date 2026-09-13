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
 * ─── Why this is a scanner and not two regexes ────────────────────────────
 * It was two regexes: comments stripped first, then literals. The ORDER was
 * the point — an apostrophe inside a `--` comment ("the module's whole point")
 * is not a string delimiter, and a stripper that ran literals first swallowed
 * everything to the next apostrophe.
 *
 * Getting that order right fixed one direction and left the other one open,
 * because the two cases are symmetric: a `--` inside a STRING LITERAL is not a
 * comment either. 20260914000001 contains
 *
 *     IF p_text ~ '-----BEGIN [A-Z ]*PRIVATE KEY-----' THEN
 *
 * and the comment-first pass deleted from that first `-----` to the end of the
 * line, taking the closing quote with it. Every literal in the remaining 1,800
 * lines was then out of phase, so `strip()` returned nonsense and the checks
 * built on it silently stopped seeing anything. A check that quietly matches
 * nothing is worse than no check, and it is invisible precisely because a
 * passing run looks identical to a correct one.
 *
 * No ordering of two independent passes can be right, because each construct
 * can contain the other. So this walks the text once, left to right, and lets
 * whichever construct OPENS first consume the other — which is exactly what
 * Postgres itself does.
 *
 * Replacements keep the line count intact so reported line numbers stay true.
 */
function strip(sql) {
  let out = '';
  let i = 0;

  while (i < sql.length) {
    // A line comment: drop to end of line, leaving the newline in place.
    if (sql[i] === '-' && sql[i + 1] === '-') {
      while (i < sql.length && sql[i] !== '\n') i += 1;
      continue;
    }

    // A block comment. Postgres nests these; nesting is not reproduced here
    // because none of these files uses one at all — the branch exists so that
    // a `/*` cannot be mistaken for code if somebody adds one.
    if (sql[i] === '/' && sql[i + 1] === '*') {
      const end = sql.indexOf('*/', i + 2);
      const segment = sql.slice(i, end === -1 ? sql.length : end + 2);
      out += '\n'.repeat((segment.match(/\n/g) ?? []).length);
      i = end === -1 ? sql.length : end + 2;
      continue;
    }

    // A string literal, with '' as the escape for a contained apostrophe.
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      const segment = sql.slice(i, j);
      out += "''" + '\n'.repeat((segment.match(/\n/g) ?? []).length);
      i = j;
      continue;
    }

    out += sql[i];
    i += 1;
  }

  return out;
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

  // ─── NULL-swallowing membership tests ──────────────────────────────────
  // `NOT (x IN (…))` where x can be NULL is a validator that fails OPEN.
  // `NULL IN (…)` is NULL, `NOT NULL` is NULL, and a branch on a NULL
  // condition does not fire — so the value that is MISSING sails through the
  // test written to reject invalid ones.
  //
  // 20260914000001's security_validate_event() shipped with three of these
  // and accepted an event carrying no severity at all. It read correctly; the
  // defect was in the three-valued logic, not in the words.
  //
  // The safe idiom, used throughout this schema, is
  // `COALESCE(x, '') NOT IN (…)`, which turns absence into a value that fails
  // like any other. There are no known-good exceptions in this corpus, so
  // every finding here is a real one.
  // strip() preserves the line COUNT but not character offsets, so the line
  // number is taken from the stripped text (where the match is) and the text
  // to quote is taken from the original at that line — the stripped version
  // has had its literals blanked and would read as `p_event ->> ''`.
  const stripped = strip(sql);
  const originalLines = sql.split('\n');
  for (const match of stripped.matchAll(/NOT\s*\(\s*([^()]*?)\s+IN\s*\(/gi)) {
    if (/COALESCE/i.test(match[1])) continue;
    const line = stripped.slice(0, match.index).split('\n').length;
    report(
      file,
      `line ${line}: ${originalLines[line - 1]?.trim()} — NOT (x IN (…)) fails OPEN when x is NULL: a MISSING value passes the test written to reject invalid ones. Use COALESCE(x, '') NOT IN (…).`,
    );
  }

  // ─── RETURNS TABLE column/variable ambiguity ───────────────────────────
  // A plpgsql function declared RETURNS TABLE (id uuid, …) turns every one of
  // those names into a VARIABLE for the whole body. An unqualified column
  // reference to the same name is then ambiguous, and Postgres refuses it with
  //
  //     ERROR:  42702: column reference "id" is ambiguous
  //
  // at RUN time, not at CREATE time. The function is created happily, reads
  // correctly, and fails on its first call — which is where
  // 20260914000001's security_ingest_as_application() was found, by running
  // the test suite against a real database rather than by reading it.
  //
  // Matching is deliberately narrow: an unqualified OUT-param name directly
  // after WHERE, AND, OR or RETURNING, followed by an operator. A qualified
  // reference (`k.id`) carries a dot and is skipped — which is also the fix.
  // The match is anchored on each function's OWN `AS $tag$ … $tag$`, so the
  // lazy header cannot run past the end of one function into the next — the
  // first version of this rule did exactly that and reported two functions
  // that do not return a table at all.
  for (const fn of sql.matchAll(
    /CREATE (?:OR REPLACE )?FUNCTION\s+public\.(\w+)\s*\(([\s\S]*?)\)\s*(RETURNS[\s\S]*?)AS\s+(\$\w*\$)([\s\S]*?)\4/gi,
  )) {
    const name = fn[1];
    const header = fn[3];
    if (!/LANGUAGE\s+plpgsql/i.test(header)) continue;

    const table = header.match(/RETURNS TABLE\s*\(([\s\S]*?)\)\s*LANGUAGE/i);
    if (!table) continue;

    // `id UUID, occurred_at TIMESTAMPTZ` -> ['id', 'occurred_at'].
    const outNames = table[1]
      .split(',')
      .map((entry) => entry.trim().split(/\s+/)[0]?.toLowerCase())
      .filter(Boolean);
    if (outNames.length === 0) continue;

    const body = strip(fn[5]);
    for (const outName of new Set(outNames)) {
      const ambiguous = new RegExp(
        String.raw`\b(?:WHERE|AND|OR|RETURNING)\s+${outName}\b\s*(?:=|<|>|IS\b|IN\b|INTO\b|,)`,
        'i',
      );
      const hit = body.match(ambiguous);
      if (hit) {
        const line = sql.slice(0, fn.index).split('\n').length;
        report(
          file,
          `line ${line}: ${name}() RETURNS TABLE declares "${outName}", and its body references that name unqualified ("${hit[0].trim()}") — Postgres raises 42702 at call time. Qualify it with a table alias.`,
        );
        break;
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
