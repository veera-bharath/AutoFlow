import { promises as fs } from 'fs'
import { join, basename, extname, dirname } from 'path'
import { spawn } from 'child_process'

export interface MoveActionParams {
  sourcePath: string
  targetDirectory: string
}

export interface RenameActionParams {
  sourcePath: string
  pattern: string
}

export interface DeleteActionParams {
  sourcePath: string
  permanent?: boolean
  trashFn?: (path: string) => Promise<void>
}

export interface ShellActionParams {
  command: string
  filePath: string
  watchPath?: string
}

function isNodeError(err: unknown): err is NodeJS.ErrnoException {
  return err instanceof Error && 'code' in err
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.access(path)
    return true
  } catch {
    return false
  }
}

function resolveRenamePattern(pattern: string, filePath: string): string {
  const ext = extname(filePath)
  const name = basename(filePath, ext)
  const now = new Date()
  const date = now.toISOString().slice(0, 10)
  const datetime = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 15)

  return pattern
    .replace(/\{name\}/g, name)
    .replace(/\{ext\}/g, ext)
    .replace(/\{date\}/g, date)
    .replace(/\{datetime\}/g, datetime)
}

export async function moveFile(params: MoveActionParams): Promise<string> {
  const { sourcePath, targetDirectory } = params
  const filename = basename(sourcePath)

  await fs.mkdir(targetDirectory, { recursive: true })

  let targetPath = join(targetDirectory, filename)
  let counter = 1
  while (await fileExists(targetPath)) {
    const ext = extname(filename)
    const base = ext ? filename.slice(0, -ext.length) : filename
    targetPath = join(targetDirectory, `${base} (${counter})${ext}`)
    counter++
  }

  try {
    await fs.rename(sourcePath, targetPath)
  } catch (err: unknown) {
    // EXDEV: cross-device rename (different drives on Windows)
    if (isNodeError(err) && err.code === 'EXDEV') {
      await fs.copyFile(sourcePath, targetPath)
      await fs.unlink(sourcePath)
    } else {
      throw err
    }
  }

  return targetPath
}

export async function renameFile(params: RenameActionParams): Promise<string> {
  const { sourcePath, pattern } = params
  const dir = dirname(sourcePath)
  const newName = resolveRenamePattern(pattern, sourcePath)
  let targetPath = join(dir, newName)
  let counter = 1
  while ((await fileExists(targetPath)) && targetPath !== sourcePath) {
    const ext = extname(newName)
    const base = ext ? newName.slice(0, -ext.length) : newName
    targetPath = join(dir, `${base} (${counter})${ext}`)
    counter++
  }

  await fs.rename(sourcePath, targetPath)
  return targetPath
}

export async function deleteFile(params: DeleteActionParams): Promise<void> {
  const { sourcePath, permanent = true, trashFn } = params
  if (!permanent && trashFn) {
    await trashFn(sourcePath)
  } else {
    await fs.unlink(sourcePath)
  }
}

export async function runShellCommand(params: ShellActionParams): Promise<void> {
  const { filePath, watchPath = '' } = params
  const cmd = params.command
    .replace(/\{filePath\}/g, filePath)
    .replace(/\{watchPath\}/g, watchPath)

  await new Promise<void>((resolve, reject) => {
    const child = spawn(cmd, { shell: true, stdio: 'pipe' })
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command exited with code ${code}`))
    })
    child.on('error', reject)
  })
}
