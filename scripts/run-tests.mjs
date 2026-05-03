import {spawn} from 'node:child_process'
import {mkdir, readdir, rm, writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const outDir = join(root, 'build', 'test')

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: 'inherit'
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} exited with ${code}`))
    })
  })

const collectTests = async (directory) => {
  const entries = await readdir(directory, {withFileTypes: true})
  const tests = []

  for (const entry of entries) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      tests.push(...(await collectTests(fullPath)))
      continue
    }

    if (entry.name.endsWith('.test.js')) {
      tests.push(fullPath)
    }
  }

  return tests
}

await rm(outDir, {recursive: true, force: true})
await run(join(root, 'node_modules', '.bin', 'tsc'), [
  '-p',
  'tsconfig.test.json'
])
await mkdir(outDir, {recursive: true})
await writeFile(join(outDir, 'package.json'), '{"type":"commonjs"}\n')

const tests = await collectTests(join(outDir, 'src'))
await run(process.execPath, ['--test', ...tests])
