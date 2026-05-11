import { promises as fs } from 'fs'
import { join, basename, extname } from 'path'

export interface MoveActionParams {
  sourcePath: string
  targetDirectory: string
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
