// src/shared/storage.ts
import type { IStorageSchema, AppSettings } from './types'

export const DEFAULT_SETTINGS: AppSettings = {
  defaultHighlightColor: 'yellow',
}

export const DEFAULT_SCHEMA: IStorageSchema = {
  articles: {},
  folders: {},
  settings: DEFAULT_SETTINGS,
}

/**
 * Lee el esquema completo desde chrome.storage.local.
 * Aplica valores por defecto para cualquier clave ausente, de modo
 * que los llamadores siempre reciban un objeto completamente tipado
 * sin necesidad de comprobaciones extra de nulos.
 */
export async function readStorage(): Promise<IStorageSchema> {
  const data = await chrome.storage.local.get(null) as Record<string, unknown>
  return {
    articles:
      (data['articles'] as IStorageSchema['articles'] | undefined) ?? {},
    folders:
      (data['folders'] as IStorageSchema['folders'] | undefined) ?? {},
    settings:
      (data['settings'] as AppSettings | undefined) ?? DEFAULT_SETTINGS,
  }
}
