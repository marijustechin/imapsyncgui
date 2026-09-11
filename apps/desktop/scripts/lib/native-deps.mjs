#!/usr/bin/env node
// Pure helpers for classifying Mach-O dependency paths found in the bundled
// runtime, including native components extracted from the PAR archive.
//
// The packaged runtime must not depend on developer-machine paths such as
// Homebrew (/opt/homebrew, /usr/local/Cellar), MacPorts (/opt/local), user home
// directories, or CI build/cache paths. Only macOS system libraries and
// explicitly bundled (@loader_path / @executable_path) dependencies are
// acceptable. Kept dependency-free so both the runtime scripts and the Vitest
// regression tests can use it.

export const SYSTEM_PREFIXES = ['/usr/lib/', '/System/', '/Library/Apple/']

export const DEVELOPER_PATH_PATTERNS = [
  /^\/opt\/homebrew\//,
  /^\/usr\/local\/Cellar\//,
  /^\/usr\/local\/opt\//,
  /^\/opt\/local\//,
  /^\/Users\//,
  /\/runner\//,
  /\/_work\//,
]

export function isSystemDependency(dependency) {
  return SYSTEM_PREFIXES.some((prefix) => dependency.startsWith(prefix))
}

export function isBundledDependency(dependency) {
  return dependency.startsWith('@loader_path/') || dependency.startsWith('@executable_path/')
}

export function isDeveloperDependency(dependency) {
  return DEVELOPER_PATH_PATTERNS.some((pattern) => pattern.test(dependency))
}

/**
 * Classifies a single Mach-O dependency path.
 *
 * - `system`   — ships with macOS (`/usr/lib`, `/System`, `/Library/Apple`)
 * - `bundled`  — resolved relative to the loaded component (`@loader_path` /
 *                `@executable_path`)
 * - `developer`— build-machine-only path (Homebrew/MacPorts/home/CI)
 * - `unknown`  — anything else (e.g. an unresolved absolute path or `@rpath`)
 */
export function classifyNativeDependency(dependency) {
  if (isSystemDependency(dependency)) return 'system'
  if (isDeveloperDependency(dependency)) return 'developer'
  if (isBundledDependency(dependency)) return 'bundled'
  return 'unknown'
}

/**
 * Parses the output of `otool -L <file>` into a list of dependency paths,
 * skipping the header line.
 */
export function parseOtoolDependencies(otoolOutput) {
  return otoolOutput
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.split(' (')[0])
}
