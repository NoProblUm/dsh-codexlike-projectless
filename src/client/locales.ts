import type { LocaleDictOf } from '@deepseek-ai/dsh-client-ui-slots'

export const PROJECTLESS_LOCALE_NS = 'dsh-codexlike-projectless'

export const zh = {
  'picker.projectless': '无项目',
  'entry.new': '切换至无项目',
  'settings.title': '无项目会话',
  'settings.root': '工作区根目录',
  'settings.browse': '浏览…',
  'settings.save': '保存',
  'settings.active': '当前生效路径',
  'settings.saved': '已保存，之后首次发送的新会话使用此路径。',
  'picker.addWorkspace': '添加工作区…',
  'modal.createFailed': '无法创建无工作区会话',
  'modal.close': '知道了',
} as const

export type ProjectlessLocaleKey = keyof typeof zh

export const en: Record<ProjectlessLocaleKey, string> = {
  'picker.projectless': 'No project',
  'entry.new': 'Switch to no project',
  'settings.title': 'Projectless sessions',
  'settings.root': 'Workspace root directory',
  'settings.browse': 'Browse…',
  'settings.save': 'Save',
  'settings.active': 'Active directory',
  'settings.saved': 'Saved. New sessions use this directory on first send.',
  'picker.addWorkspace': 'Add workspace…',
  'modal.createFailed': 'Could not create session without workspace',
  'modal.close': 'Got it',
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Projectless-session picker and error copy. */
    'dsh-codexlike-projectless': ProjectlessLocaleKey
  }
}

/** Typed bilingual dictionaries consumed by the DSH locale runtime. */
export const projectlessLocales: Record<'zh' | 'en', LocaleDictOf<typeof PROJECTLESS_LOCALE_NS>> = {
  zh,
  en,
}
