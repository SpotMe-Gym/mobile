import { fingerprint } from '@/features/sync/hash';
import { planTable } from '@/features/sync/plan';

type W = { client_id: string; v: number };
const row = (id: string, v: number): W => ({ client_id: id, v });
const shadowOf = (...rows: W[]) => Object.fromEntries(rows.map((r) => [r.client_id, fingerprint(r)]));
const local = (...rows: W[]) => new Map(rows.map((r) => [r.client_id, r]));

describe('planTable', () => {
  it('first sync merges both sides and deletes nothing', () => {
    const p = planTable<W>({
      local: local(row('a', 1)),
      shadow: {},
      remote: [row('b', 2)],
      remoteDeleted: [],
    });
    expect(p.localUpserts).toEqual([row('b', 2)]);
    expect(p.pushUpserts).toEqual([row('a', 1)]);
    expect(p.pushDeletes).toEqual([]);
    expect(p.shadow).toEqual(shadowOf(row('a', 1), row('b', 2)));
  });

  it('our own write coming back is not applied again', () => {
    const p = planTable<W>({
      local: local(row('a', 1)),
      shadow: shadowOf(row('a', 1)),
      remote: [row('a', 1)],
      remoteDeleted: [],
    });
    expect(p).toMatchObject({ localUpserts: [], pushUpserts: [], pushDeletes: [], localDeletes: [] });
  });

  it('a change on the phone is sent; a change on the website is applied', () => {
    const phone = planTable<W>({
      local: local(row('a', 2)),
      shadow: shadowOf(row('a', 1)),
      remote: [],
      remoteDeleted: [],
    });
    expect(phone.pushUpserts).toEqual([row('a', 2)]);
    const web = planTable<W>({
      local: local(row('a', 1)),
      shadow: shadowOf(row('a', 1)),
      remote: [row('a', 5)],
      remoteDeleted: [],
    });
    expect(web.localUpserts).toEqual([row('a', 5)]);
    expect(web.pushUpserts).toEqual([]);
  });

  it('when both changed, the website wins', () => {
    const p = planTable<W>({
      local: local(row('a', 2)),
      shadow: shadowOf(row('a', 1)),
      remote: [row('a', 5)],
      remoteDeleted: [],
    });
    expect(p.localUpserts).toEqual([row('a', 5)]);
    expect(p.pushUpserts).toEqual([]);
    expect(p.shadow.a).toBe(fingerprint(row('a', 5)));
  });

  it('deleted on the phone → deleted on the website, only if it was synced', () => {
    const p = planTable<W>({ local: local(), shadow: shadowOf(row('a', 1)), remote: [], remoteDeleted: [] });
    expect(p.pushDeletes).toEqual(['a']);
    expect(p.shadow).toEqual({});
  });

  it('deleted on the website → deleted on the phone', () => {
    const p = planTable<W>({
      local: local(row('a', 1), row('b', 1)),
      shadow: shadowOf(row('a', 1), row('b', 1)),
      remote: [],
      remoteDeleted: ['a'],
    });
    expect(p.localDeletes).toEqual(['a']);
    expect(p.pushDeletes).toEqual([]);
    expect(p.shadow).toEqual(shadowOf(row('b', 1)));
  });

  it('deleted and created again on the website: the row wins', () => {
    const p = planTable<W>({
      local: local(row('a', 1)),
      shadow: shadowOf(row('a', 1)),
      remote: [row('a', 3)],
      remoteDeleted: ['a'],
    });
    expect(p.localDeletes).toEqual([]);
    expect(p.localUpserts).toEqual([row('a', 3)]);
  });

  it('records the server would reject stay on the phone and are not sent', () => {
    const p = planTable<W>({
      local: local(row('ok', 1), row('bad', -1)),
      shadow: {},
      remote: [],
      remoteDeleted: [],
      valid: (w) => w.v >= 0,
    });
    expect(p.pushUpserts).toEqual([row('ok', 1)]);
    expect(p.shadow).toEqual(shadowOf(row('ok', 1)));
  });
});
