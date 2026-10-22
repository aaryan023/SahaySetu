const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

for (const file of ['index.html', 'report.html', 'success.html', 'admin.html']) {
  fs.copyFileSync(path.join(root, file), path.join(output, file));
}
for (const directory of ['css', 'js', 'assets']) {
  const source = path.join(root, directory);
  if (fs.existsSync(source)) fs.cpSync(source, path.join(output, directory), { recursive: true });
}

esbuild.buildSync({
  stdin: { contents: fs.readFileSync(path.join(root, 'js/firebase-init.js'), 'utf8'), resolveDir: root, sourcefile: 'firebase-init.js' },
  outfile: path.join(output, 'js/firebase-init.js'),
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2017'],
  external: ['firebase/app', 'firebase/analytics'],
  sourcemap: false
});
