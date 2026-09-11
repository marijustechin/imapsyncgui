export const SYSTEM_PREFIXES: string[]
export const DEVELOPER_PATH_PATTERNS: RegExp[]
export function isSystemDependency(dependency: string): boolean
export function isBundledDependency(dependency: string): boolean
export function isDeveloperDependency(dependency: string): boolean
export function classifyNativeDependency(dependency: string): 'system' | 'bundled' | 'developer' | 'unknown'
export function parseOtoolDependencies(otoolOutput: string): string[]
