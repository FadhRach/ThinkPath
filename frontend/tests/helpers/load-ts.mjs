import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * Memuat modul TypeScript tanpa bundler: tiap modul dan semua impor relatifnya (`./x`)
 * ditranspilasi ke satu folder sementara, lalu diimpor. Beberapa jalur dalam satu
 * panggilan berbagi folder itu, jadi kelas yang sama (mis. ApiError) tidak terduplikasi
 * dan `instanceof` tetap benar. Hanya modul bebas alias `@/` dan impor runtime Next.js
 * yang bisa dimuat; itulah sebabnya logika murni dijaga tanpa impor semacam itu.
 *
 * @param {...string} relPaths jalur relatif terhadap akar frontend, mis. "lib/api/messages.ts"
 * @returns ekspor semua modul digabung jadi satu objek
 */
export async function loadTs(...relPaths) {
  const outDir = mkdtempSync(join(tmpdir(), "thinkpath-test-"));
  const seen = new Set();
  const outFile = (absPath) => join(outDir, relative(ROOT, absPath)).replace(/\.tsx?$/, ".mjs");

  function compile(absPath) {
    if (seen.has(absPath)) return;
    seen.add(absPath);
    const source = readFileSync(absPath, "utf8");
    let js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    js = js.replace(/(from\s+|import\s*\()"(\.{1,2}\/[^"]+)"/g, (_match, lead, spec) => {
      compile(resolve(dirname(absPath), `${spec}.ts`));
      return `${lead}"${spec}.mjs"`;
    });
    mkdirSync(dirname(outFile(absPath)), { recursive: true });
    writeFileSync(outFile(absPath), js);
  }

  const entries = relPaths.map((relPath) => resolve(ROOT, relPath));
  entries.forEach(compile);
  const modules = await Promise.all(
    entries.map((entry) => import(pathToFileURL(outFile(entry)).href)),
  );
  return Object.assign({}, ...modules);
}

export { ROOT };
