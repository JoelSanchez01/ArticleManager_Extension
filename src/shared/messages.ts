// src/shared/messages.ts

export const MessageType = {
  // Content Script → Background
  SAVE_ARTICLE:           'SAVE_ARTICLE',
  SAVE_HIGHLIGHT:         'SAVE_HIGHLIGHT',
  UPDATE_HIGHLIGHT_NOTE:  'UPDATE_HIGHLIGHT_NOTE',
  DELETE_HIGHLIGHT:       'DELETE_HIGHLIGHT',

  // Dashboard → Background
  CREATE_FOLDER:          'CREATE_FOLDER',
  DELETE_FOLDER:          'DELETE_FOLDER',
  MOVE_ARTICLE:           'MOVE_ARTICLE',
  UPDATE_ARTICLE_STATUS:  'UPDATE_ARTICLE_STATUS',
  DELETE_ARTICLE:         'DELETE_ARTICLE',

  // Background → Content Script
  CAPTURE_SELECTION:      'CAPTURE_SELECTION',

  // Background → cualquiera (respuestas)
  SUCCESS:                'SUCCESS',
  ERROR:                  'ERROR',
} as const

export type MessageType = typeof MessageType[keyof typeof MessageType]

export interface Message<T = unknown> {
  type: MessageType
  payload: T
}

export interface MessageResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}
