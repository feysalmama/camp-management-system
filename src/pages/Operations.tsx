import { useCallback, useState } from 'react';
import { Plus, Pencil, Download, Search, ArrowRight, Bus, CheckCircle2 } from 'lucide-react';
import { useApp, check } from '../context';
import { supabase } from '../lib/supabase';
import { Badge, Empty, Field, Modal, PageHeading } from '../components/ui';
import { canWrite, dateTime, downloadCsv, label } from '../lib/workflow';
import type { Movement, Vacating } from '../lib/types';

const localDate = (value: string) => {
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export function Operations({ vacating = false }: { vacating?: boolean }) {
  const { data, company, membership, run, busy } = useApp();
  const [editing, setEditing] = useState<Movement | Vacating | null | undefined>(undefined),
    [search, setSearch] = useState('');
  const close = useCallback(() => setEditing(undefined), []);
  const rows = vacating ? data.vacatings : data.movements;
  const write = canWrite(membership!.role);
  const table = vacating ? 'camp_vacatings' : 'movements';
  const entries = rows.filter((r) =>
    JSON.stringify(r).toLowerCase().includes(search.toLowerCase()),
  );
  const m = editing as Movement | null;
  const v = editing as Vacating | null;
  return (
    <>
      <PageHeading
        eyebrow="PILGRIM OPERATIONS"
        title={vacating ? 'Camp vacating & reconciliation' : 'Movement between holy sites'}
        subtitle={
          vacating
            ? 'Verify pilgrims, baggage, transport, and the final camp sweep before clearance.'
            : 'Coordinate departure schedules and reconcile arrivals for each pilgrim group.'
        }
        actions={
          <>
            <button
              className="btn secondary"
              disabled={!entries.length}
              onClick={() =>
                downloadCsv(
                  entries as unknown as Record<string, unknown>[],
                  vacating ? 'camp-reconciliation.csv' : 'movements.csv',
                )
              }
            >
              <Download size={16} /> Export
            </button>
            {write && (
              <button className="btn primary" onClick={() => setEditing(null)}>
                <Plus size={16} />
                {vacating ? 'Prepare vacating' : 'Schedule movement'}
              </button>
            )}
          </>
        }
      />
      <div className="notice">
        {vacating ? <CheckCircle2 size={18} /> : <Bus size={18} />}
        <span>
          {vacating
            ? 'The system only permits clearance when pilgrim and baggage counts match, transport is confirmed, and the final sweep is complete.'
            : 'A group can only be marked arrived when the arrival count matches the expected pilgrim count. Record disruptions as Tool 9 incidents.'}
        </span>
      </div>
      <section className="panel">
        <div className="filters">
          <label className="search">
            <Search size={16} />
            <input
              aria-label="Search operations"
              placeholder="Search operational records…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
        </div>
        {entries.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{vacating ? 'Camp' : 'Group / Route'}</th>
                  <th>{vacating ? 'Departure' : 'Scheduled'}</th>
                  <th>Pilgrims verified</th>
                  <th>{vacating ? 'Baggage verified' : 'Transport'}</th>
                  <th>Status</th>
                  {write && <th />}
                </tr>
              </thead>
              <tbody>
                {entries.map((row) => {
                  const movement = row as Movement,
                    vacate = row as Vacating;
                  return (
                    <tr key={row.id}>
                      <td className="strong">
                        {vacating ? (
                          data.camps.find((c) => c.id === vacate.camp_id)?.name
                        ) : (
                          <>
                            {movement.group_name}
                            <small>
                              {movement.origin}{' '}
                              <ArrowRight size={10} style={{ display: 'inline' }} />{' '}
                              {movement.destination}
                            </small>
                          </>
                        )}
                      </td>
                      <td>{dateTime(vacating ? vacate.departure_at : movement.scheduled_at)}</td>
                      <td>
                        {vacating
                          ? `${vacate.pilgrims_verified} / ${vacate.pilgrims_expected}`
                          : `${movement.arrived_count} / ${movement.pilgrim_count}`}
                      </td>
                      <td>
                        {vacating
                          ? `${vacate.baggage_verified} / ${vacate.baggage_expected}`
                          : movement.transport || 'Unassigned'}
                      </td>
                      <td>
                        <Badge value={row.status} />
                      </td>
                      {write && (
                        <td>
                          <button
                            className="icon-btn"
                            onClick={() => setEditing(row)}
                            aria-label="Edit operational record"
                          >
                            <Pencil size={15} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={vacating ? 'No camp departures yet' : 'No movements scheduled'}>
            {vacating
              ? 'Prepare a camp departure to begin reconciliation.'
              : 'Schedule your first group movement between sites.'}
          </Empty>
        )}
      </section>
      {editing !== undefined && (
        <Modal
          title={`${editing ? 'Update' : vacating ? 'Prepare' : 'Schedule'} ${vacating ? 'camp vacating' : 'movement'}`}
          close={close}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const number = (key: string) => Number(f.get(key));
              const payload: Record<string, unknown> = {
                company_id: company!.id,
                status: f.get('status'),
                notes: f.get('notes'),
              };
              if (vacating)
                Object.assign(payload, {
                  camp_id: f.get('camp_id'),
                  departure_at: new Date(String(f.get('departure_at'))).toISOString(),
                  pilgrims_expected: number('pilgrims_expected'),
                  pilgrims_verified: number('pilgrims_verified'),
                  baggage_expected: number('baggage_expected'),
                  baggage_verified: number('baggage_verified'),
                  transport_confirmed: f.get('transport_confirmed') === 'on',
                  final_sweep_done: f.get('final_sweep_done') === 'on',
                });
              else
                Object.assign(payload, {
                  group_name: f.get('group_name'),
                  origin: f.get('origin'),
                  destination: f.get('destination'),
                  scheduled_at: new Date(String(f.get('scheduled_at'))).toISOString(),
                  pilgrim_count: number('pilgrim_count'),
                  arrived_count: number('arrived_count'),
                  transport: f.get('transport'),
                  leader: f.get('leader'),
                  contact_phone: f.get('contact_phone'),
                });
              if (
                await run(
                  () =>
                    check(
                      editing
                        ? supabase!.from(table).update(payload).eq('id', editing.id)
                        : supabase!.from(table).insert(payload),
                    ),
                  'Operational record saved.',
                )
              )
                close();
            }}
          >
            {vacating ? (
              <>
                <Field label="Camp">
                  <select name="camp_id" required defaultValue={v?.camp_id || ''}>
                    <option value="">Select camp</option>
                    {data.camps.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.camp_number} · {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Planned departure (local time)">
                  <input
                    type="datetime-local"
                    name="departure_at"
                    required
                    defaultValue={v ? localDate(v.departure_at) : ''}
                  />
                </Field>
                <div className="form-grid">
                  {(
                    [
                      ['pilgrims_expected', 'Expected pilgrims'],
                      ['pilgrims_verified', 'Verified pilgrims'],
                      ['baggage_expected', 'Expected baggage items'],
                      ['baggage_verified', 'Verified baggage items'],
                    ] as const
                  ).map(([key, name]) => (
                    <Field key={key} label={name}>
                      <input
                        type="number"
                        name={key}
                        min={0}
                        required
                        defaultValue={v?.[key] ?? 0}
                      />
                    </Field>
                  ))}
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="transport_confirmed"
                    defaultChecked={v?.transport_confirmed}
                  />{' '}
                  Transport confirmed
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    name="final_sweep_done"
                    defaultChecked={v?.final_sweep_done}
                  />{' '}
                  Final camp sweep complete — no one left behind
                </label>
                <Field label="Status">
                  <select name="status" defaultValue={v?.status || 'preparing'}>
                    <option value="preparing">Preparing</option>
                    <option value="cleared">Cleared for departure</option>
                  </select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Group name">
                  <input name="group_name" required defaultValue={m?.group_name} />
                </Field>
                <div className="form-grid">
                  {(['origin', 'destination'] as const).map((key) => (
                    <Field key={key} label={label(key)}>
                      <select
                        name={key}
                        defaultValue={m?.[key] || (key === 'origin' ? 'Mina' : 'Arafat')}
                      >
                        {['Mina', 'Arafat', 'Muzdalifah', 'Makkah', 'Other'].map((site) => (
                          <option key={site}>{site}</option>
                        ))}
                      </select>
                    </Field>
                  ))}
                </div>
                <Field label="Scheduled departure (local time)">
                  <input
                    type="datetime-local"
                    name="scheduled_at"
                    required
                    defaultValue={m ? localDate(m.scheduled_at) : ''}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Expected pilgrims">
                    <input
                      type="number"
                      name="pilgrim_count"
                      min={0}
                      required
                      defaultValue={m?.pilgrim_count ?? 0}
                    />
                  </Field>
                  <Field label="Arrived pilgrims">
                    <input
                      type="number"
                      name="arrived_count"
                      min={0}
                      required
                      defaultValue={m?.arrived_count ?? 0}
                    />
                  </Field>
                </div>
                <Field label="Transport / vehicle references">
                  <input name="transport" defaultValue={m?.transport} />
                </Field>
                <div className="form-grid">
                  <Field label="Group leader">
                    <input name="leader" defaultValue={m?.leader} />
                  </Field>
                  <Field label="Contact phone">
                    <input name="contact_phone" type="tel" defaultValue={m?.contact_phone} />
                  </Field>
                </div>
                <Field label="Status">
                  <select name="status" defaultValue={m?.status || 'planned'}>
                    {['planned', 'departed', 'arrived', 'cancelled'].map((s) => (
                      <option key={s} value={s}>
                        {label(s)}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <Field label="Notes / disruptions">
              <textarea name="notes" defaultValue={editing?.notes} rows={3} />
            </Field>
            <div className="form-actions">
              <button type="button" className="btn secondary" onClick={close}>
                Cancel
              </button>
              <button disabled={busy} className="btn primary">
                Save record
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
