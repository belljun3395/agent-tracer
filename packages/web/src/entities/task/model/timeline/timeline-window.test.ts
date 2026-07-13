import { KIND } from '@monitor/kernel'
import { describe, expect, it } from 'vitest'
import type { TimelineEventRecord } from '~web/entities/task/model/timeline/event.js'
import {
  appendToTimelineWindow,
  prependPageToTimelineWindow,
} from '~web/entities/task/model/timeline/timeline-window.js'

function makeEvent(id: string): TimelineEventRecord {
  return {
    id: id as TimelineEventRecord['id'],
    taskId: 't1' as TimelineEventRecord['taskId'],
    kind: KIND.userMessage,
    lane: 'user',
    title: id,
    metadata: {},
    classification: { lane: 'user', tags: [] },
    createdAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('appendToTimelineWindow', () => {
  it('상한 이내면 끝에 그대로 추가한다', () => {
    const window = [makeEvent('a'), makeEvent('b')]

    const next = appendToTimelineWindow(window, makeEvent('c'), 5)

    expect(next.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('상한을 넘으면 오래된 쪽(앞)을 버린다', () => {
    const window = [makeEvent('a'), makeEvent('b'), makeEvent('c')]

    const next = appendToTimelineWindow(window, makeEvent('d'), 3)

    expect(next.map((e) => e.id)).toEqual(['b', 'c', 'd'])
  })

  it('이미 있는 id는 재전송돼도 중복 추가하지 않는다', () => {
    const window = [makeEvent('a'), makeEvent('b')]

    const next = appendToTimelineWindow(window, makeEvent('b'), 5)

    expect(next.map((e) => e.id)).toEqual(['a', 'b'])
  })
})

describe('prependPageToTimelineWindow', () => {
  it('과거 페이지를 앞에 붙여도 전체 순서가 오름차순으로 유지된다', () => {
    const window = [makeEvent('c'), makeEvent('d')]
    const olderPage = [makeEvent('a'), makeEvent('b')]

    const next = prependPageToTimelineWindow(window, olderPage, 10)

    expect(next.map((e) => e.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('상한을 넘으면 반대쪽(가장 최근 이벤트)을 버린다', () => {
    const window = [makeEvent('c'), makeEvent('d')]
    const olderPage = [makeEvent('a'), makeEvent('b')]

    const next = prependPageToTimelineWindow(window, olderPage, 3)

    expect(next.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })

  it('이미 창에 있는 id는 페이지에서 걸러낸다', () => {
    const window = [makeEvent('b'), makeEvent('c')]
    const olderPage = [makeEvent('a'), makeEvent('b')]

    const next = prependPageToTimelineWindow(window, olderPage, 10)

    expect(next.map((e) => e.id)).toEqual(['a', 'b', 'c'])
  })
})
