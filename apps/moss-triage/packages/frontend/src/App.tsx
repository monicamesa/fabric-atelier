import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Coffee,
  Info,
  Keyboard,
  Moon,
  Radio,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Sun,
  Terminal,
  Users,
  X,
  Zap,
} from 'lucide-react';

import { useTheme } from '@/hooks/theme.context';
import { getRayfinClient } from '@/lib/rayfin-client';
import { PingScene } from '@/components/PingScene';
import { PixelAvatar } from '@/components/PixelAvatar';
import { PixelFlame } from '@/components/PixelFlame';
import { AskRic } from '@/components/AskRic';
import type {
  TicketAssignmentRecord,
  TicketEventRecord,
} from '@rayfin-app/shared';
import type { Customers } from '../../../rayfin/connectors/ricsupport/Customers';
import type { SupportTeam } from '../../../rayfin/connectors/ricsupport/SupportTeam';
import type { Tickets } from '../../../rayfin/connectors/ricsupport/Tickets';

type Ticket = Pick<
  Tickets,
  | 'ticketId'
  | 'customerId'
  | 'createdAt'
  | 'category'
  | 'subject'
  | 'description'
  | 'priority'
  | 'channel'
  | 'status'
  | 'assignedTo'
  | 'resolvedAt'
  | 'slaHours'
  | 'slaBreached'
>;
type Customer = Pick<Customers, 'customerId' | 'customerName' | 'contactName'>;
type TeamMember = Pick<SupportTeam, 'memberId' | 'memberName' | 'role'>;
type QueueData = {
  tickets: Ticket[];
  customers: Customer[];
  team: TeamMember[];
  assignments: TicketAssignmentRecord[];
  events: TicketEventRecord[];
  loadedAt: number;
  persistenceWarning: string | null;
};
type Page<Row> = {
  items: Row[];
  hasNextPage: boolean;
  endCursor?: string;
};
type QueueTab = 'cola' | 'mios' | 'curso' | 'resueltos' | 'activos';
type DiagnosisKind =
  | 'PEBKAC'
  | 'PICNIC'
  | 'Error ID-10T'
  | 'Error de capa 8'
  | 'Hardware de verdad';
type Diagnosis = {
  kind: DiagnosisKind;
  probability: number;
  explanation: string;
};
type LiveTicket = {
  ticket: Ticket;
  assignment?: TicketAssignmentRecord;
  latestEvent?: TicketEventRecord;
  assignedMember?: TeamMember;
  isResolved: boolean;
  isAssigned: boolean;
};

const priorityOrder: Record<string, number> = {
  Crítica: 0,
  Alta: 1,
  Media: 2,
  Baja: 3,
};
const pageSize = 15;
const quickReplies = [
  '¿Has probado a apagarlo y encenderlo de nuevo?',
  '¿Está enchufado?',
  'Por favor, no toques nada más.',
  'Lo escalo a N2: gente con más café.',
];
const categoryFilters = [
  'Acceso / Login',
  'Hardware',
  'Rendimiento',
  'Integraciones',
  'Exportación de datos',
];
const priorityFilters = ['Crítica', 'Alta', 'Media', 'Baja'];
const channelFilters = ['Email', 'Chat', 'Teléfono', 'Portal'];
const closureReasons = [
  'Lo apagué y lo encendí de nuevo',
  'Estaba desenchufado',
  'PEBKAC confirmado',
  'Error de capa 8',
  'Se arregló solo (nadie sabe cómo)',
  'Funciona en mi máquina',
  'Arreglo de verdad',
];
const loadingMessages = [
  'Reiniciando el servidor…',
  'Buscando el cable que alguien ha desenchufado…',
  'Comprobando la capa 8…',
  'Consultando con el becario…',
];
const basementTips = [
  'Antes de abrir un ticket, comprueba que está enchufado.',
  "Tu contraseña no puede ser 'contraseña'.",
  'El 80 % de los problemas se arreglan reiniciando. El 20 % restante, también.',
  'Internet no cabe en un pendrive.',
];
const relativeTime = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

function stableHash(value: string): number {
  let hash = 0;
  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function ticketDiagnosis(ticket: Ticket): Diagnosis {
  const hash = stableHash(ticket.ticketId ?? '');
  const knownPebkac = /apagado|enchufado|contrase(?:ñ|n)a|p[oó]sit/i.test(
    `${ticket.subject ?? ''} ${ticket.description ?? ''}`
  );
  const diagnoses: { kind: DiagnosisKind; explanation: string }[] = [
    {
      kind: 'PEBKAC',
      explanation: 'Problem Exists Between Keyboard And Chair: la incidencia está entre el teclado y la silla.',
    },
    {
      kind: 'PICNIC',
      explanation: 'Problem In Chair, Not In Computer: el ordenador parece inocente por ahora.',
    },
    {
      kind: 'Error ID-10T',
      explanation: 'ID-10T parece un código técnico; léelo en voz alta para descubrir el chiste.',
    },
    {
      kind: 'Error de capa 8',
      explanation: 'La capa 8 es la persona que está por encima de las siete capas del modelo OSI.',
    },
    {
      kind: 'Hardware de verdad',
      explanation: 'Puede que esta vez sí sea una pieza física. Raro, pero pasa.',
    },
  ];
  const diagnosis = knownPebkac ? diagnoses[0] : diagnoses[hash % diagnoses.length];
  const probability = knownPebkac ? 72 + (hash % 25) : 25 + (hash % 70);
  return { ...diagnosis, probability };
}

function matchesCategory(ticketCategory: string | null | undefined, filter: string): boolean {
  const value = (ticketCategory ?? '').toLocaleLowerCase('es');
  switch (filter) {
    case 'Acceso / Login':
      return /acceso|login|contrase|autenticaci/i.test(value);
    case 'Hardware':
      return /hardware|impresora|port[aá]til|monitor|rat[oó]n|teclado/i.test(value);
    case 'Rendimiento':
      return /rendim|lento|velocidad/i.test(value);
    case 'Integraciones':
      return /integr/i.test(value);
    case 'Exportación de datos':
      return /export/i.test(value);
    default:
      return false;
  }
}

function matchesChannel(ticketChannel: string | null | undefined, filter: string): boolean {
  const normalize = (value: string) =>
    value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  const channel = normalize(ticketChannel ?? '');
  switch (filter) {
    case 'Email':
      return /email|e-mail|correo/.test(channel);
    case 'Chat':
      return channel.includes('chat');
    case 'Teléfono':
      return /telefono|phone|tel/.test(channel);
    case 'Portal':
      return channel.includes('portal');
    default:
      return false;
  }
}

function isLayer8Resolved(event: TicketEventRecord): boolean {
  if (event.type !== 'resuelto') return false;
  const text = event.text.toLocaleLowerCase('es');
  return /pebkac|picnic|id-10t|capa\s*8/i.test(text);
}

async function collectPages<Row>(
  readPage: (cursor?: string) => Promise<Page<Row>>
): Promise<Row[]> {
  const rows: Row[] = [];
  let cursor: string | undefined;

  while (true) {
    const page = await readPage(cursor);
    rows.push(...page.items);
    if (!page.hasNextPage) return rows;
    if (!page.endCursor) {
      throw new Error('La consulta paginada no devolvió el cursor siguiente.');
    }
    cursor = page.endCursor;
  }
}

async function loadQueue(): Promise<QueueData> {
  const client = await getRayfinClient();
  const [tickets, customers, team] = await Promise.all([
    collectPages<Ticket>((cursor) => {
      const query = client.connectors.ricsupport.Tickets
        .select([
          'ticketId',
          'customerId',
          'createdAt',
          'category',
          'subject',
          'description',
          'priority',
          'channel',
          'status',
          'assignedTo',
          'resolvedAt',
          'slaHours',
          'slaBreached',
        ])
        .orderBy({ createdAt: 'asc' })
        .first(500);
      return cursor
        ? query.after(cursor).executePaginated()
        : query.executePaginated();
    }),
    collectPages<Customer>((cursor) => {
      const query = client.connectors.ricsupport.Customers
        .select(['customerId', 'customerName', 'contactName'])
        .orderBy({ customerId: 'asc' })
        .first(500);
      return cursor
        ? query.after(cursor).executePaginated()
        : query.executePaginated();
    }),
    collectPages<TeamMember>((cursor) => {
      const query = client.connectors.ricsupport.SupportTeam
        .select(['memberId', 'memberName', 'role'])
        .orderBy({ memberName: 'asc' })
        .first(100);
      return cursor
        ? query.after(cursor).executePaginated()
        : query.executePaginated();
    }),
  ]);
  const [assignmentResult, eventResult] = await Promise.allSettled([
    collectPages<TicketAssignmentRecord>((cursor) => {
      const query = client.data.TicketAssignment
        .select(['id', 'ticketId', 'memberId', 'level', 'assignedAt', 'assignedBy'])
        .orderBy({ assignedAt: 'desc' })
        .first(500);
      return cursor
        ? query.after(cursor).executePaginated()
        : query.executePaginated();
    }),
    collectPages<TicketEventRecord>((cursor) => {
      const query = client.data.TicketEvent
        .select(['id', 'ticketId', 'type', 'text', 'createdAt', 'author'])
        .orderBy({ createdAt: 'asc' })
        .first(500);
      return cursor
        ? query.after(cursor).executePaginated()
        : query.executePaginated();
    }),
  ]);
  const assignments = assignmentResult.status === 'fulfilled' ? assignmentResult.value : [];
  const events = eventResult.status === 'fulfilled' ? eventResult.value : [];
  const failedReads = [
    assignmentResult.status === 'rejected' ? 'asignaciones' : null,
    eventResult.status === 'rejected' ? 'historial' : null,
  ].filter((value): value is string => value !== null);
  const persistenceWarning = failedReads.length
    ? `La cola sigue disponible, pero no se pudo cargar ${failedReads.join(' ni ')} guardado${failedReads.length > 1 ? 's' : ''}. Puede faltar estado reciente.`
    : null;
  return {
    tickets,
    customers,
    team,
    assignments,
    events,
    loadedAt: Date.now(),
    persistenceWarning,
  };
}

function timeOf(value: Date | string | null | undefined): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function formatAge(value: Ticket['createdAt']): string {
  const timestamp = timeOf(value);
  if (!Number.isFinite(timestamp)) return 'antigüedad desconocida';
  const seconds = Math.round((timestamp - Date.now()) / 1000);
  const absoluteSeconds = Math.abs(seconds);
  if (absoluteSeconds < 60) return relativeTime.format(0, 'minute');
  if (absoluteSeconds < 3600) return relativeTime.format(Math.round(seconds / 60), 'minute');
  if (absoluteSeconds < 86400) return relativeTime.format(Math.round(seconds / 3600), 'hour');
  if (absoluteSeconds < 2592000) return relativeTime.format(Math.round(seconds / 86400), 'day');
  if (absoluteSeconds < 31536000) return relativeTime.format(Math.round(seconds / 2592000), 'month');
  return relativeTime.format(Math.round(seconds / 31536000), 'year');
}

function formatDate(value: Date | string | null | undefined): string {
  const time = timeOf(value);
  return Number.isFinite(time)
    ? new Intl.DateTimeFormat('es', { dateStyle: 'short', timeStyle: 'short' }).format(time)
    : 'hora desconocida';
}

function memberLevel(role: string | undefined | null): 'N1' | 'N2' {
  return /\bN2\b/i.test(role ?? '') ? 'N2' : 'N1';
}

function memberRoleLabel(role: string | undefined | null): string {
  const level = memberLevel(role);
  const specialty = (role ?? '')
    .replace(/^\s*soporte\s*/i, '')
    .replace(/^\s*N[12]\s*([·:—-]\s*)?/i, '')
    .trim();
  return specialty ? `Soporte ${level} · ${specialty}` : `Soporte ${level}`;
}

function slaRemaining(ticket: Ticket, now: number): { label: string; tone: string } | null {
  const start = timeOf(ticket.createdAt);
  const duration = (ticket.slaHours ?? 0) * 3600000;
  if (!Number.isFinite(start) || duration <= 0) return null;
  const remaining = start + duration - now;
  const minutes = Math.max(1, Math.ceil(Math.abs(remaining) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const text = [days ? `${days} d` : '', hours ? `${hours} h` : '', `${minutes % 60} min`].filter(Boolean).join(' ');
  return {
    label: remaining <= 0 ? `SLA roto hace ${text}` : `quedan ${text}`,
    tone: remaining < duration * 0.1 ? 'danger' : remaining < duration * 0.5 ? 'warn' : 'accent',
  };
}

function isSameDay(first: Date | string | null | undefined, second: Date): boolean {
  const time = timeOf(first);
  if (!Number.isFinite(time)) return false;
  const value = new Date(time);
  return value.getFullYear() === second.getFullYear() &&
    value.getMonth() === second.getMonth() &&
    value.getDate() === second.getDate();
}

function readLocalNumber(key: string, fallback: number): number {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return fallback;
    const value = Number(stored);
    return Number.isFinite(value) && value >= 0 ? Math.min(value, 100) : fallback;
  } catch {
    return fallback;
  }
}

function readLocalString(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeLocalValue(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The feature remains usable for this visit if browser storage is disabled.
  }
}

function priorityClass(value: string | null | undefined): string {
  const normalized = (value ?? 'baja')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es');
  return `priority-${normalized}`;
}

const manualTerms: { term: string; text: string }[] = [
  { term: 'PING>', text: 'La consola de Ping, el becario que nunca duerme. Sugiere a quién asignar cada ticket y le pone un diagnóstico.' },
  { term: 'PEBKAC', text: 'Problem Exists Between Keyboard And Chair. El problema está entre el teclado y la silla.' },
  { term: 'PICNIC', text: 'Problem In Chair, Not In Computer. Variante de lo anterior, para no repetirse.' },
  { term: 'Error ID-10T', text: 'Parece un código técnico. Escríbelo todo junto y léelo en voz alta.' },
  { term: 'Capa 8', text: 'El modelo OSI tiene 7 capas. La octava es la persona que está delante.' },
  { term: 'Algo está ardiendo', text: 'Tickets de prioridad crítica que nadie se ha pedido todavía.' },
  { term: 'Nivel de café', text: 'Tu energía. Baja un 12 % cada vez que te pides un ticket. Por debajo del 25 %, recarga.' },
  { term: 'Racha sin SLA roto', text: 'Días seguidos sin incumplir ningún SLA. Que no se rompa en tu guardia.' },
  { term: 'N1 / N2', text: 'Nivel 1: primera línea. Nivel 2: gente con más café y más contexto.' },
];
const manualSteps = [
  '¿Está enchufado? Pregúntalo con cariño.',
  'Que lo apague y lo encienda de nuevo.',
  'Si sigue igual, sospecha de la capa 8.',
  'Si no es capa 8, escala a N2.',
  'Si arde: extintor, y avisa a N2.',
];
const shortcutList: [string, string][] = [
  ['J / K', 'siguiente / anterior'],
  ['Enter', 'abrir ticket'],
  ['Esc', 'cerrar'],
  ['A', 'asignármelo'],
  ['E', 'escalar a N2'],
  ['R', 'marcar resuelto'],
  ['/', 'buscar'],
  ['?', 'ver atajos'],
];

function HelpDialog({ manual, team, onClose }: { manual: boolean; team: TeamMember[]; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  const shortcuts = (
    <section className="manual-section">
      <h3><span>§{manual ? 4 : 1}</span> Atajos para gente que no usa ratón</h3>
      <ul className="kbd-list">
        {shortcutList.map(([key, text]) => <li key={key}><kbd>{key}</kbd><span>{text}</span></li>)}
      </ul>
    </section>
  );
  return (
    <dialog
      ref={ref}
      className={manual ? 'help-dialog manual-dialog' : 'help-dialog'}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      aria-labelledby="help-title"
    >
      <header className="manual-cover">
        <div>
          <span className="manual-kicker">RIC · SOPORTE TÉCNICO · USO INTERNO</span>
          <h2 id="help-title">{manual ? 'Manual del sótano' : 'Atajos de teclado'}</h2>
          {manual && <p>Edición 1.0 · No sacar del sótano · Si lo encuentras, devuélvelo a Ping</p>}
        </div>
        <button className="icon-button" type="button" aria-label="Cerrar" onClick={onClose}>✕</button>
      </header>
      <div className="manual-body">
        {manual && <>
          <section className="manual-section">
            <h3><span>§1</span> Diccionario</h3>
            <dl className="manual-terms">
              {manualTerms.map((item) => <div key={item.term}><dt>{item.term}</dt><dd>{item.text}</dd></div>)}
            </dl>
            <p className="manual-note">Apunte: si dudas, es capa 8. Si no dudas, también.</p>
          </section>
          <section className="manual-section">
            <h3><span>§2</span> Protocolo de actuación</h3>
            <ol className="manual-steps">
              {manualSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
            <p className="manual-note manual-note-alt">Nunca digas «a mí me funciona». Aunque te funcione.</p>
          </section>
          <section className="manual-section">
            <h3><span>§3</span> Quién es quién</h3>
            <div className="manual-levels">
              {(['N1', 'N2'] as const).map((level) => (
                <div key={level} className="manual-level">
                  <strong>{level === 'N1' ? 'Nivel 1 · primera línea' : 'Nivel 2 · más café'}</strong>
                  {team.filter((member) => memberLevel(member.role) === level).map((member) => (
                    <p className="manual-member" key={member.memberId}>
                      <PixelAvatar memberId={member.memberId} size={28} />
                      <span>{member.memberName}<small>{memberRoleLabel(member.role)}</small></span>
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </>}
        {shortcuts}
      </div>
    </dialog>
  );
}


function App() {
  const { isDark, toggleTheme } = useTheme();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: number;
    data?: QueueData;
    failed: boolean;
  } | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState(() =>
    readLocalString('moss-triage-member', '')
  );
  const [onDuty, setOnDuty] = useState(() =>
    readLocalString('moss-triage-duty', 'on') === 'on'
  );
  const [coffee, setCoffee] = useState(() =>
    readLocalNumber('moss-triage-coffee', 100)
  );
  const [tab, setTab] = useState<QueueTab>('cola');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [channelFilter, setChannelFilter] = useState('');
  const [slaOnly, setSlaOnly] = useState(false);
  const [layer8Only, setLayer8Only] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [detailTab, setDetailTab] = useState<'ticket' | 'reply' | 'ric' | 'history'>('ticket');
  const [cursorId, setCursorId] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [fireActive, setFireActive] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const ticketListRef = useRef<HTMLDivElement>(null);
  const fireTimer = useRef<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [reply, setReply] = useState('');
  const [closingReason, setClosingReason] = useState('');
  const [showResolveForm, setShowResolveForm] = useState(false);
  const [terminalMessage, setTerminalMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [basementTip, setBasementTip] = useState(basementTips[0]);
  // Keep showing the last data while a refresh runs, so actions never blank the screen.
  const refreshing = loaded !== null && loaded.key !== reloadKey;
  const data = loaded?.data ?? null;
  const loadedAt = data?.loadedAt ?? 0;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => window.clearTimeout(fireTimer.current), []);

  useEffect(() => {
    const timer = window.setInterval(
      () => setLoadingMessageIndex((index) => (index + 1) % loadingMessages.length),
      2400
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setBasementTip(basementTips[Math.floor(Math.random() * basementTips.length)]),
      0
    );
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void loadQueue()
      .then((result) => {
        if (active) setLoaded({ key: reloadKey, data: result, failed: false });
      })
      .catch(() => {
        if (active) setLoaded((previous) => ({ key: reloadKey, data: previous?.data, failed: true }));
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const customerById = useMemo(
    () => new Map((data?.customers ?? []).map((customer) => [customer.customerId ?? '', customer])),
    [data?.customers]
  );
  const assignmentByTicket = useMemo(
    () => new Map((data?.assignments ?? []).map((assignment) => [assignment.ticketId, assignment])),
    [data?.assignments]
  );
  const latestEventByTicket = useMemo(() => {
    const latest = new Map<string, TicketEventRecord>();
    for (const event of data?.events ?? []) {
      const previous = latest.get(event.ticketId);
      if (!previous || timeOf(event.createdAt) >= timeOf(previous.createdAt)) {
        latest.set(event.ticketId, event);
      }
    }
    return latest;
  }, [data?.events]);
  const teamById = useMemo(
    () => new Map((data?.team ?? []).map((member) => [member.memberId ?? '', member])),
    [data?.team]
  );
  const liveTickets = useMemo<LiveTicket[]>(
    () =>
      (data?.tickets ?? []).map((ticket) => {
        const id = ticket.ticketId ?? '';
        const assignment = assignmentByTicket.get(id);
        const latestEvent = latestEventByTicket.get(id);
        const sourceAssignee = ticket.assignedTo?.trim() ?? '';
        const sourceMember =
          teamById.get(sourceAssignee) ??
          (data?.team ?? []).find((member) => member.memberName === sourceAssignee);
        const assignedMember = assignment
          ? teamById.get(assignment.memberId)
          : sourceMember;
        const isAssigned = Boolean(assignment?.memberId || sourceAssignee);
        const isResolved = latestEvent
          ? latestEvent.type === 'resuelto'
          : ticket.status === 'Resuelto' || Boolean(ticket.resolvedAt);
        return { ticket, assignment, latestEvent, assignedMember, isResolved, isAssigned };
      }),
    [assignmentByTicket, data?.team, data?.tickets, latestEventByTicket, teamById]
  );
  const team = data?.team ?? [];
  const currentMember =
    team.find((member) => member.memberId === selectedMemberId) ??
    team.find((member) => member.memberName?.toLocaleLowerCase('es') === 'mónica mesa') ??
    team[0];
  const currentMemberId = currentMember?.memberId ?? '';
  const currentMemberName = currentMember?.memberName ?? 'Mónica Mesa';

  const prioritySorted = useMemo(
    () =>
      [...liveTickets].sort((a, b) => {
        const priorityDelta =
          (priorityOrder[a.ticket.priority ?? ''] ?? 4) -
          (priorityOrder[b.ticket.priority ?? ''] ?? 4);
        return priorityDelta || timeOf(a.ticket.createdAt) - timeOf(b.ticket.createdAt);
      }),
    [liveTickets]
  );
  const queueTickets = prioritySorted.filter(
    (item) =>
      item.ticket.status === 'Abierto' &&
      !item.isAssigned &&
      !item.isResolved
  );
  const myTickets = prioritySorted.filter(
    (item) => item.assignedMember?.memberId === currentMemberId && !item.isResolved
  );
  const inProgressTickets = prioritySorted.filter(
    (item) => item.isAssigned && !item.isResolved
  );
  const resolvedTickets = prioritySorted.filter((item) => {
    if (!item.isResolved) return false;
    const resolvedAt = item.latestEvent?.type === 'resuelto'
      ? timeOf(item.latestEvent.createdAt)
      : timeOf(item.ticket.resolvedAt);
    return Number.isFinite(resolvedAt) && resolvedAt >= loadedAt - 30 * 24 * 60 * 60 * 1000;
  });
  const allSlaTickets = liveTickets.filter((item) => item.ticket.slaBreached === true && !item.isResolved);
  const ticketSets: Record<QueueTab, LiveTicket[]> = {
    cola: queueTickets,
    mios: myTickets,
    curso: inProgressTickets,
    resueltos: resolvedTickets,
    activos: prioritySorted.filter((item) => !item.isResolved),
  };
  const hasActiveFilters = Boolean(
    query.trim() || category || priorityFilter || channelFilter || slaOnly || layer8Only || unassignedOnly
  );
  const matchesTicketFilters = (item: LiveTicket, skipPriority = false) => {
    const searchText = query.trim().toLocaleLowerCase('es');
    const searchable = `${item.ticket.subject ?? ''} ${item.ticket.description ?? ''}`
      .toLocaleLowerCase('es');
    return (
      (!searchText || searchable.includes(searchText)) &&
      (!category || matchesCategory(item.ticket.category, category)) &&
      (skipPriority || !priorityFilter || item.ticket.priority === priorityFilter) &&
      (!channelFilter || matchesChannel(item.ticket.channel, channelFilter)) &&
      (!slaOnly || item.ticket.slaBreached === true) &&
      (!layer8Only || ticketDiagnosis(item.ticket).probability > 70) &&
      (!unassignedOnly || !item.isAssigned)
    );
  };
  const activeTickets = ticketSets[tab];
  const filteredTickets = activeTickets.filter((item) => matchesTicketFilters(item));
  const priorityCounts = new Map(
    priorityFilters.map((priority) => [
      priority,
      activeTickets.filter((item) => matchesTicketFilters(item, true) && item.ticket.priority === priority).length,
    ])
  );
  const filteredTabCount = (items: LiveTicket[]) =>
    items.filter((item) => matchesTicketFilters(item)).length;
  const pageCount = Math.max(1, Math.ceil(filteredTickets.length / pageSize));
  const visiblePage = Math.min(page, pageCount);
  const visibleTickets = filteredTickets.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const selected = selectedTicketId ? liveTickets.find((item) => item.ticket.ticketId === selectedTicketId) : undefined;
  const selectedTicket = selected?.ticket;
  const selectedId = selectedTicket?.ticketId ?? '';
  const selectedCustomer = selectedTicket
    ? customerById.get(selectedTicket.customerId ?? '')
    : undefined;
  const selectedEvents = (data?.events ?? [])
    .filter((event) => event.ticketId === selectedId)
    .sort((a, b) => timeOf(a.createdAt) - timeOf(b.createdAt));
  const teamLoads = new Map(
    team.map((member) => [
      member.memberId ?? '',
      liveTickets.filter((item) => item.assignedMember?.memberId === member.memberId && !item.isResolved).length,
    ])
  );
  const criticalCount = queueTickets.filter((item) => item.ticket.priority === 'Crítica').length;
  const resolvedToday = liveTickets.filter((item) => {
    if (!item.isResolved) return false;
    const event = item.latestEvent?.type === 'resuelto' ? item.latestEvent : undefined;
    return isSameDay(event?.createdAt ?? item.ticket.resolvedAt, new Date(loadedAt));
  }).length;
  const layer8ResolvedToday = new Set(
    (data?.events ?? [])
      .filter((event) => isLayer8Resolved(event) && isSameDay(event.createdAt, new Date(loadedAt)))
      .map((event) => event.ticketId)
  ).size;
  const lastBreachDeadline = liveTickets.reduce<number | undefined>((latest, item) => {
    const createdAt = timeOf(item.ticket.createdAt);
    const slaHours = item.ticket.slaHours;
    if (
      item.ticket.slaBreached !== true ||
      !Number.isFinite(createdAt) ||
      typeof slaHours !== 'number'
    ) {
      return latest;
    }
    const deadline = createdAt + slaHours * 60 * 60 * 1000;
    return deadline <= loadedAt ? Math.max(latest ?? 0, deadline) : latest;
  }, undefined);
  const slaStreakDays = lastBreachDeadline === undefined
    ? undefined
    : Math.max(0, Math.floor((loadedAt - lastBreachDeadline) / (24 * 60 * 60 * 1000)));
  const selectedLive = selected;
  const selectedAssignment = selectedLive?.assignment;
  const selectedAssignee = selectedLive?.assignedMember;
  const selectedLevel = selectedAssignment?.level ?? memberLevel(selectedAssignee?.role);
  const flowStep = selectedLive?.isResolved ? 3 : selectedLive?.isAssigned ? (selectedLevel === 'N2' ? 2 : 1) : 0;
  const sourceCategoriesForN2 = ['integr', 'export', 'rendim'];
  const requiresN2 = sourceCategoriesForN2.some((word) =>
    (selectedTicket?.category ?? '').toLocaleLowerCase('es').includes(word)
  );
  const suggestionLevel: 'N1' | 'N2' = requiresN2 ? 'N2' : 'N1';
  const candidates = team.filter((member) => memberLevel(member.role) === suggestionLevel);
  const chatCandidates = candidates.filter((member) => /chat/i.test(member.role ?? ''));
  const isChatTicket = (selectedTicket?.channel ?? '').toLocaleLowerCase('es') === 'chat';
  const suggestionPool = isChatTicket ? chatCandidates : candidates;
  const suggestion = [...suggestionPool].sort(
    (a, b) =>
      (teamLoads.get(a.memberId ?? '') ?? 0) - (teamLoads.get(b.memberId ?? '') ?? 0) ||
      (a.memberName ?? '').localeCompare(b.memberName ?? '', 'es')
  )[0];
  const diagnosis = selectedTicket ? ticketDiagnosis(selectedTicket) : null;

  function chooseTab(next: QueueTab) {
    setTab(next);
    setPage(1);
  }

  function clearFilters() {
    setQuery('');
    setCategory('');
    setPriorityFilter('');
    setChannelFilter('');
    setSlaOnly(false);
    setLayer8Only(false);
    setUnassignedOnly(false);
    setPage(1);
  }

  function chooseMember(memberId: string) {
    setSelectedMemberId(memberId);
    writeLocalValue('moss-triage-member', memberId);
    setTab('mios');
    setPage(1);
  }

  function updateDuty() {
    const next = !onDuty;
    setOnDuty(next);
    writeLocalValue('moss-triage-duty', next ? 'on' : 'off');
    setTerminalMessage(next ? '> De vuelta en la guardia.' : '> En pausa. La cola te echará de menos.');
  }

  function refillCoffee() {
    setCoffee(100);
    writeLocalValue('moss-triage-coffee', '100');
    setTerminalMessage('> Café recargado. Rendimiento +40 %.');
  }

  async function saveEvent(
    ticketId: string,
    type: TicketEventRecord['type'],
    text: string
  ): Promise<void> {
    const client = await getRayfinClient();
    await client.data.TicketEvent.create({
      ticketId,
      type,
      text,
      createdAt: new Date(),
      author: currentMemberName,
    });
  }

  async function assignTicket(
    ticket: Ticket,
    member: TeamMember,
    type: 'asignado' | 'escalado',
    text: string,
    successMessage: string
  ) {
    const ticketId = ticket.ticketId ?? '';
    const memberId = member.memberId ?? '';
    if (!ticketId || !memberId) {
      setTerminalMessage('> No se pudo asignar: falta el ID del ticket o de la persona.');
      return;
    }
    setBusy(true);
    try {
      const client = await getRayfinClient();
      const existing = await client.data.TicketAssignment
        .select(['id'])
        .where({ ticketId: { eq: ticketId } })
        .first(1)
        .execute();
      const assignment = {
        ticketId,
        memberId,
        level: memberLevel(member.role),
        assignedAt: new Date(),
        assignedBy: currentMemberName,
      };
      if (existing[0]) {
        await client.data.TicketAssignment.update({ id: existing[0].id }, assignment);
      } else {
        await client.data.TicketAssignment.create(assignment);
      }
      await saveEvent(ticketId, type, text);
      if (memberId === currentMemberId && type === 'asignado') {
        const nextCoffee = Math.max(0, coffee - 12);
        setCoffee(nextCoffee);
        writeLocalValue('moss-triage-coffee', String(nextCoffee));
      }
      setTerminalMessage(successMessage);
      setSelectedTicketId(ticketId);
      if (memberId === currentMemberId && type === 'asignado') setDetailTab('reply');
      setTab(memberId === currentMemberId ? 'mios' : 'curso');
      setPage(1);
    } catch {
      setTerminalMessage('> No se pudo guardar la asignación o su historial. Revisa la conexión y vuelve a intentarlo.');
    } finally {
      setBusy(false);
      setReloadKey((key) => key + 1);
    }
  }

  async function resolveTicket(ticket: Ticket, reason: string) {
    const ticketId = ticket.ticketId ?? '';
    if (!ticketId) {
      setTerminalMessage('> No se pudo resolver: el ticket no tiene identificador.');
      return;
    }
    setBusy(true);
    try {
      await saveEvent(ticketId, 'resuelto', `Motivo de cierre: ${reason}`);
      setShowResolveForm(false);
      setClosingReason('');
      setTerminalMessage('> Resuelto. Otro que no vuelve a llamar (de momento).');
      setSelectedTicketId(ticketId);
      setTab('resueltos');
      setPage(1);
    } catch {
      setTerminalMessage('> No se pudo guardar la resolución. Revisa la conexión y vuelve a intentarlo.');
    } finally {
      setBusy(false);
      setReloadKey((key) => key + 1);
    }
  }

  async function sendReply(ticket: Ticket) {
    const text = reply.trim();
    const ticketId = ticket.ticketId ?? '';
    if (!text || !ticketId) {
      setTerminalMessage('> Escribe una respuesta antes de enviarla.');
      return;
    }
    setBusy(true);
    try {
      await saveEvent(ticketId, 'respuesta', text);
      setReply('');
      setTerminalMessage(`> Respuesta guardada para ${selectedCustomer?.contactName ?? 'el contacto'}.`);
    } catch {
      setTerminalMessage('> No se pudo guardar la respuesta. El Lakehouse es de solo lectura.');
    } finally {
      setBusy(false);
      setReloadKey((key) => key + 1);
    }
  }

  function showSlaTickets() {
    const first = allSlaTickets[0];
    if (!first) return;
    setQuery('');
    chooseTab(first.isAssigned ? 'curso' : 'cola');
    setSelectedTicketId(first.ticket.ticketId ?? null);
    setNotificationsOpen(false);
  }

  function openTicket(id: string | null) {
    setSelectedTicketId(id);
    setCursorId(id);
    setDetailTab('ticket');
    setShowResolveForm(false);
    setClosingReason('');
  }

  function escalate(ticket: Ticket) {
    const n2 = [...team]
      .filter((member) => memberLevel(member.role) === 'N2')
      .sort((a, b) => (teamLoads.get(a.memberId ?? '') ?? 0) - (teamLoads.get(b.memberId ?? '') ?? 0))[0];
    if (n2) void assignTicket(ticket, n2, 'escalado', `Escalado a Nivel 2: ${n2.memberName ?? 'soporte'}.`, `> Escalado a ${n2.memberName ?? 'N2'}. Que lo mire alguien con más café.`);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (event.key === 'Escape') {
        if (manualOpen) setManualOpen(false);
        else if (shortcutsOpen) setShortcutsOpen(false);
        else openTicket(null);
        return;
      }
      if (event.ctrlKey || event.altKey || event.metaKey || manualOpen || shortcutsOpen) return;
      const key = event.key.toLocaleLowerCase('es');
      if (key === '/') { event.preventDefault(); searchRef.current?.focus(); }
      else if (key === '?') { event.preventDefault(); setShortcutsOpen(true); }
      else if (key === 'j' || key === 'k') {
        event.preventDefault();
        const index = visibleTickets.findIndex((item) => item.ticket.ticketId === cursorId);
        const next = index < 0 ? 0 : Math.max(0, Math.min(visibleTickets.length - 1, index + (key === 'j' ? 1 : -1)));
        setCursorId(visibleTickets[next]?.ticket.ticketId ?? null);
        ticketListRef.current?.querySelectorAll<HTMLButtonElement>('.ticket-row')[next]?.focus();
      } else if (key === 'enter' && cursorId && (target === document.body || target === document.documentElement)) {
        openTicket(cursorId);
      } else if (selectedTicket && !selectedLive?.isResolved && !busy) {
        if (key === 'a' && currentMember && onDuty) void assignTicket(selectedTicket, currentMember, 'asignado', `Asignado a ${currentMemberName}.`, '> Asignado a ti. Que la fuerza te acompañe.');
        else if (key === 'e' && onDuty) escalate(selectedTicket);
        else if (key === 'r') { setDetailTab('ticket'); setShowResolveForm(true); setClosingReason(''); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!loaded) {
    return (
      <main className="loading-shell" role="status" aria-live="polite">
        <RefreshCw aria-hidden="true" className="loading-icon" />
        <h1>{loadingMessages[loadingMessageIndex]}</h1>
        <p>Conectando con el Lakehouse y la base del sótano.</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="error-shell" role="alert">
        <AlertTriangle aria-hidden="true" />
        <h1>Algo ha fallado. ¿Has probado a apagarlo y encenderlo?</h1>
        <p>No se pudo consultar el Lakehouse o recuperar las asignaciones guardadas.</p>
        <button type="button" className="button button-primary" onClick={() => setReloadKey((key) => key + 1)}>
          <RefreshCw aria-hidden="true" /> Reintentar conexión
        </button>
      </main>
    );
  }

  const tabs: { key: QueueTab; label: string; count: number }[] = [
    { key: 'cola', label: 'La Cola', count: filteredTabCount(ticketSets.cola) },
    { key: 'mios', label: 'Mis tickets', count: filteredTabCount(ticketSets.mios) },
    { key: 'curso', label: 'En curso', count: filteredTabCount(ticketSets.curso) },
    { key: 'resueltos', label: 'Resueltos', count: filteredTabCount(ticketSets.resueltos) },
    ...(tab === 'activos' ? [{ key: 'activos' as const, label: 'Activos', count: filteredTabCount(ticketSets.activos) }] : []),
  ];
  const activeFilterCount = [query.trim(), category, priorityFilter, channelFilter, slaOnly, layer8Only, unassignedOnly].filter(Boolean).length;
  const metricQueueActive = tab === 'cola' && !hasActiveFilters;
  const metricFireActive = tab === 'cola' && priorityFilter === 'Crítica';
  const metricSlaActive = tab === 'activos' && slaOnly;
  const maxLoad = Math.max(1, ...teamLoads.values());
  const firstName = (member?: TeamMember) => member?.memberName?.split(' ')[0] ?? 'Soporte';
  const selectedSla = selectedTicket && !selectedLive?.isResolved ? slaRemaining(selectedTicket, now) : null;

  return (
    <main className="app-shell">
      <div className="page-scanlines" aria-hidden="true" />
      <div className="app-content">
        <div className="col-main">
          <section className="brand-banner" aria-labelledby="app-title">
            <PingScene />
            <div className="brand-copy">
              <span className="eyebrow"><Terminal aria-hidden="true" /> RIC / SOPORTE TÉCNICO</span>
              <h1 id="app-title">MOSS TRIAGE</h1>
              <p>¿Has probado a apagarlo y encenderlo de nuevo?<span className="blinking-cursor" aria-hidden="true">_</span></p>
              <div className="basement-tag">Ping v1.0 · el becario que nunca duerme</div>
            </div>
          </section>

          {data.persistenceWarning && (
            <p className="persistence-warning" role="status">{data.persistenceWarning}</p>
          )}
          {loaded.failed && !refreshing && (
            <p className="persistence-warning" role="alert">No se pudo actualizar. Muestro los últimos datos; pulsa ⟳ para reintentarlo.</p>
          )}

          <section className="metric-strip" aria-label="Indicadores del equipo">
            <button type="button" className={`metric ${metricQueueActive ? 'is-active' : ''}`} aria-pressed={metricQueueActive}
              onClick={() => { clearFilters(); chooseTab('cola'); }}>
              <Radio aria-hidden="true" className="metric-icon" />
              <span className="metric-text"><span className="metric-label">EN LA COLA</span><span className="metric-note">abiertos sin asignar</span></span>
              <strong className="metric-value">{queueTickets.length}</strong>
            </button>
            <button type="button" className={`metric metric-warn ${metricFireActive ? 'is-active' : ''}`} aria-pressed={metricFireActive}
              onClick={() => { clearFilters(); chooseTab('cola'); setPriorityFilter('Crítica'); }}>
              <PixelFlame size={22} />
              <span className="metric-text"><span className="metric-label">ALGO ESTÁ ARDIENDO</span><span className="metric-note">críticos sin asignar</span></span>
              <strong className="metric-value">{criticalCount}</strong>
            </button>
            <button type="button" className={`metric metric-danger ${metricSlaActive ? 'is-active' : ''}`} aria-pressed={metricSlaActive}
              onClick={() => { clearFilters(); chooseTab('activos'); setSlaOnly(true); }}>
              <Clock3 aria-hidden="true" className="metric-icon" />
              <span className="metric-text"><span className="metric-label">SLA INCUMPLIDO</span><span className="metric-note">tickets activos</span></span>
              <strong className="metric-value">{allSlaTickets.length}</strong>
            </button>
          </section>

          <section className="list-panel" aria-labelledby="list-title">
            <div className="panel-title-row">
              <div>
                <span className="eyebrow">BANDEJA DE SOPORTE{refreshing ? ' · actualizando…' : ''}</span>
                <h2 id="list-title">{tabs.find((item) => item.key === tab)?.label}</h2>
              </div>
              <div className="tabs" role="tablist" aria-label="Vistas de tickets">
                {tabs.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.key}
                    className={tab === item.key ? 'tab-button is-active' : 'tab-button'}
                    title={item.key === 'resueltos' ? 'Solo tickets resueltos en los últimos 30 días' : undefined}
                    onClick={() => chooseTab(item.key)}
                  >
                    {item.label}<span>{item.count}</span>
                  </button>
                ))}
              </div>
              <div className="big-count" aria-label={`${filteredTickets.length} tickets`}>
                <strong>{filteredTickets.length}</strong><span>tickets</span>
              </div>
            </div>
            <div className="list-toolbar">
              <label className="search-field">
                <Search aria-hidden="true" />
                <span className="visually-hidden">Buscar en asunto y descripción</span>
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value.trim().toLocaleLowerCase('es') === 'fuego') {
                      setQuery('');
                      setFireActive(true);
                      setTerminalMessage('> Activado el protocolo extintor. Mantenga la calma.');
                      window.clearTimeout(fireTimer.current);
                      fireTimer.current = window.setTimeout(() => setFireActive(false), 5000);
                    } else setQuery(value);
                    setPage(1);
                  }}
                  placeholder='grep "impresora"…   ( / para buscar )'
                />
              </label>
              <button type="button" className="refresh-button" onClick={() => setReloadKey((key) => key + 1)} aria-label="Actualizar tickets">
                <RefreshCw aria-hidden="true" className={refreshing ? 'spinning' : ''} />
              </button>
            </div>
            <div className="filters-block">
              <div className="filter-row" aria-label="Filtrar por categoría">
                <span className="filter-caption">CATEGORÍA</span>
                <div className="chip-set">
                  <button type="button" className={!category ? 'chip is-selected' : 'chip'} onClick={() => { setCategory(''); setPage(1); }}>Todas</button>
                  {categoryFilters.map((value) => (
                    <button key={value} type="button" className={category === value ? 'chip is-selected' : 'chip'} onClick={() => { setCategory(category === value ? '' : value); setPage(1); }}>{value}</button>
                  ))}
                </div>
              </div>
              <div className="filter-row" aria-label="Filtrar por prioridad">
                <span className="filter-caption">PRIORIDAD</span>
                <div className="chip-set">
                  <button type="button" className={!priorityFilter ? 'chip is-selected' : 'chip'} onClick={() => { setPriorityFilter(''); setPage(1); }}>Todas</button>
                  {priorityFilters.map((value) => (
                    <button key={value} type="button" className={`chip chip-priority ${priorityClass(value)} ${priorityFilter === value ? 'is-selected' : ''}`} onClick={() => { setPriorityFilter(priorityFilter === value ? '' : value); setPage(1); }}>
                      {value} <span>{priorityCounts.get(value) ?? 0}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-row" aria-label="Filtrar por canal">
                <span className="filter-caption">CANAL</span>
                <div className="chip-set">
                  <button type="button" className={!channelFilter ? 'chip is-selected' : 'chip'} onClick={() => { setChannelFilter(''); setPage(1); }}>Todos</button>
                  {channelFilters.map((value) => <button key={value} type="button" className={`chip ${channelFilter === value ? 'is-selected' : ''}`} onClick={() => { setChannelFilter(channelFilter === value ? '' : value); setPage(1); }}>{value}</button>)}
                </div>
              </div>
              <div className="filter-row" aria-label="Atajos">
                <span className="filter-caption">ATAJOS</span>
                <div className="chip-set">
                  <button type="button" className={`chip chip-quick ${slaOnly ? 'is-selected' : ''}`} aria-pressed={slaOnly} onClick={() => { setSlaOnly(!slaOnly); setPage(1); }}>Solo SLA incumplido</button>
                  <button type="button" className={`chip chip-quick ${layer8Only ? 'is-selected' : ''}`} aria-pressed={layer8Only} onClick={() => { setLayer8Only(!layer8Only); setPage(1); }} title="Tickets con más de un 70 % de probabilidad de capa 8 según Ping">Sospecha de capa 8</button>
                  <button type="button" className={`chip chip-quick ${unassignedOnly ? 'is-selected' : ''}`} aria-pressed={unassignedOnly} onClick={() => { setUnassignedOnly(!unassignedOnly); setPage(1); }}>Sin asignar</button>
                </div>
                <button type="button" className={`button button-small clear-filters ${activeFilterCount ? 'is-armed' : ''}`} onClick={clearFilters} disabled={!activeFilterCount} title={activeFilterCount ? 'Quitar todos los filtros' : 'No hay filtros activos'}>
                  <X aria-hidden="true" /> Limpiar filtros{activeFilterCount ? ` (${activeFilterCount})` : ''}
                </button>
              </div>
            </div>
            {terminalMessage && <p className="queue-message" role="status">{terminalMessage}</p>}
            <div ref={ticketListRef} className={`ticket-list ${fireActive ? 'fire-active' : ''}`} aria-live="polite">
              {visibleTickets.length ? visibleTickets.map((item) => {
                const ticket = item.ticket;
                const customer = customerById.get(ticket.customerId ?? '');
                const selectedRow = ticket.ticketId === selected?.ticket.ticketId;
                const sla = !item.isResolved ? slaRemaining(ticket, now) : null;
                return (
                  <button
                    key={ticket.ticketId ?? `${ticket.subject}-${ticket.createdAt}`}
                    type="button"
                    className={`ticket-row ${priorityClass(ticket.priority)} ${selectedRow ? 'is-selected' : ''} ${cursorId === ticket.ticketId ? 'is-cursor' : ''}`}
                    onClick={() => openTicket(ticket.ticketId ?? null)}
                    aria-pressed={selectedRow}
                  >
                    <span className="row-line">
                      <span className="ticket-id">{ticket.ticketId ?? 'ID pendiente'}</span>
                      <span className={`priority-pill ${priorityClass(ticket.priority)}`}>
                        {ticket.priority === 'Crítica' && <PixelFlame size={14} />}
                        {ticket.priority ?? 'Sin prioridad'}
                      </span>
                      <strong className="row-subject">{ticket.subject ?? 'Sin asunto'}</strong>
                      {sla && <span className={`sla-countdown tone-${sla.tone}`}>{sla.label}</span>}
                    </span>
                    <span className="row-line row-meta">
                      <span className="row-customer">{customer?.customerName ?? 'Cliente sin ficha'} · {customer?.contactName ?? 'Contacto no indicado'}</span>
                      <span className="row-tags">{ticket.category ?? 'Sin categoría'} · {ticket.channel ?? 'Canal desconocido'}</span>
                      <span className="row-owner">
                        {item.assignedMember
                          ? <><PixelAvatar memberId={item.assignedMember.memberId} size={16} />{firstName(item.assignedMember)}</>
                          : item.isAssigned ? (ticket.assignedTo ?? 'asignado') : <em>sin asignar</em>}
                      </span>
                      <time>{formatAge(ticket.createdAt)}</time>
                    </span>
                  </button>
                );
              }) : (
                <div className="empty-state" role="status">
                  <Terminal aria-hidden="true" />
                  <strong>{tab === 'cola' && !hasActiveFilters ? 'Cero tickets. Sospechoso. Muy sospechoso.' : 'No hay tickets con estos filtros.'}</strong>
                  <span>El sótano está en silencio… por ahora.</span>
                </div>
              )}
            </div>
            <div className="pagination">
              <span>{filteredTickets.length ? `${(visiblePage - 1) * pageSize + 1}–${Math.min(visiblePage * pageSize, filteredTickets.length)} de ${filteredTickets.length}` : '0 tickets'}</span>
              <div>
                <button type="button" className="icon-button" disabled={visiblePage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Página anterior"><ChevronLeft aria-hidden="true" /></button>
                <span>Página {visiblePage} / {pageCount}</span>
                <button type="button" className="icon-button" disabled={visiblePage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} aria-label="Página siguiente"><ChevronRight aria-hidden="true" /></button>
              </div>
            </div>
          </section>
        </div>

        <aside className="col-side" aria-label="Panel del agente y detalle">
          <section className="operator-panel" aria-label="Panel del equipo de guardia">
            <div className="operator-heading">
              <PixelAvatar memberId={currentMemberId} size={48} title={currentMemberName} />
              <label className="operator-name" htmlFor="support-member">
                <span className="field-caption">SOY…</span>
                <select id="support-member" value={currentMemberId} onChange={(event) => chooseMember(event.target.value)} aria-label="Soy">
                  {team.map((member) => (
                    <option key={member.memberId ?? member.memberName} value={member.memberId ?? ''}>{member.memberName ?? 'Persona de soporte'}</option>
                  ))}
                </select>
                <small>{memberRoleLabel(currentMember?.role).replace('Soporte N', 'Nivel ')}</small>
              </label>
              <div className="operator-tools">
                <button type="button" className="icon-button notification-button" aria-label={`${allSlaTickets.length} avisos de SLA`} aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>
                  <Bell aria-hidden="true" />
                  {allSlaTickets.length > 0 && <span>{allSlaTickets.length}</span>}
                </button>
                <button type="button" className="icon-button" onClick={toggleTheme} aria-label={isDark ? 'Subir a la oficina (modo claro)' : 'Bajar al sótano (modo oscuro)'} title={isDark ? '☀ Subir a la oficina' : '☾ Bajar al sótano'}>
                  {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
                </button>
              </div>
              {notificationsOpen && (
                <div className="notification-popover" role="status">
                  <strong>{allSlaTickets.length ? `${allSlaTickets.length} tickets con SLA incumplido` : 'Sin avisos de SLA'}</strong>
                  {allSlaTickets.length > 0 && <button type="button" className="button button-small button-outline" onClick={showSlaTickets}>Ver el siguiente ticket</button>}
                </div>
              )}
            </div>
            <button type="button" className={`duty-button ${onDuty ? 'is-on-duty' : ''}`} onClick={updateDuty} aria-pressed={onDuty}>
              {onDuty ? '● De guardia · pulsa para tomar un descanso' : '○ En pausa · pulsa para volver a la guardia'}
            </button>
            <div className="operator-stats">
              <div title="Tickets asignados a ti que siguen abiertos."><strong>{myTickets.length}</strong><span>Míos en curso</span></div>
              <div title="Tickets resueltos hoy por el equipo."><strong>{resolvedToday}</strong><span>Resueltos hoy</span></div>
              <div title="Días seguidos sin incumplir un SLA (estimado con created_at + sla_hours)."><strong>{slaStreakDays === undefined ? '—' : `${slaStreakDays} d`}</strong><span>Sin SLA roto</span></div>
              <div title="Tickets cerrados hoy en los que el problema era la persona: PEBKAC, PICNIC, ID-10T o capa 8. Míralo en el Manual del sótano."><strong>{layer8ResolvedToday}</strong><span>Capa 8 hoy ⓘ</span></div>
            </div>
            <div className="coffee-block">
              <div className="coffee-heading">
                <span><Coffee aria-hidden="true" /> Nivel de café <b className={coffee < 25 ? 'coffee-alert' : ''}>{coffee} %</b></span>
                <button type="button" className="button button-small button-outline" onClick={refillCoffee}>Recargar</button>
              </div>
              <div className={`coffee-track ${coffee < 25 ? 'coffee-low' : ''}`} role="progressbar" aria-label="Nivel de café" aria-valuenow={coffee} aria-valuemin={0} aria-valuemax={100}>
                <span style={{ width: `${coffee}%` }} />
              </div>
              <p>{coffee < 25 ? '☕ Ping recomienda café antes de pedirte otro ticket.' : 'Baja un 12 % con cada ticket que te pides.'}</p>
            </div>
            <div className="operator-links">
              <button type="button" className="button button-small button-ghost" onClick={() => setManualOpen(true)}><BookOpen aria-hidden="true" /> Manual del sótano</button>
              <button type="button" className="button button-small button-ghost" onClick={() => setShortcutsOpen(true)}><Keyboard aria-hidden="true" /> Atajos <kbd>?</kbd></button>
            </div>
          </section>

          <section className="team-load-card" aria-label="Carga del equipo">
            <div className="card-heading"><span>CARGA DEL EQUIPO</span><span>tickets en curso</span></div>
            <ul className="team-load-list">
              {[...team].sort((a, b) => memberLevel(a.role).localeCompare(memberLevel(b.role)) || (a.memberName ?? '').localeCompare(b.memberName ?? '', 'es')).map((member) => {
                const count = teamLoads.get(member.memberId ?? '') ?? 0;
                const level = memberLevel(member.role);
                return (
                  <li className="team-load-row" key={member.memberId ?? member.memberName} title={`${member.memberName ?? ''} · ${memberRoleLabel(member.role)}`}>
                    <PixelAvatar memberId={member.memberId} size={24} />
                    <span className="load-name">{firstName(member)}<small>{level}</small></span>
                    <span className="load-track" aria-label={`${member.memberName ?? 'Soporte'}: ${count} tickets en curso`}>
                      <i className={level === 'N2' ? 'load-n2' : ''} style={{ width: `${Math.min(100, (count / maxLoad) * 100)}%` }} />
                    </span>
                    <strong>{count}</strong>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="side-hint" aria-hidden={Boolean(selectedTicket)}>
            <Terminal aria-hidden="true" />
            <p>Elige un ticket. Ping te espera.</p>
            <button type="button" className="button button-small button-accent" disabled={!visibleTickets.length} onClick={() => openTicket(visibleTickets[0]?.ticket.ticketId ?? null)}>Coger el más urgente</button>
          </section>

          {selectedTicket && (
            <section className="detail-panel" aria-labelledby="detail-title" key={selectedId}>
              <header className={`detail-header ${priorityClass(selectedTicket.priority)}`}>
                <div className="detail-id-row">
                  <span className="ticket-id">{selectedTicket.ticketId ?? 'ID pendiente'}</span>
                  <span className={`priority-pill ${priorityClass(selectedTicket.priority)}`}>
                    {selectedTicket.priority === 'Crítica' && <PixelFlame size={14} />}
                    {selectedTicket.priority ?? 'Sin prioridad'}
                  </span>
                  {selectedTicket.slaBreached && <span className="sla-chip">SLA incumplido</span>}
                  <button type="button" className="icon-button close-detail" aria-label="Cerrar detalle" onClick={() => openTicket(null)}><X aria-hidden="true" /></button>
                </div>
                <h2 id="detail-title">{selectedTicket.subject ?? 'Sin asunto'}</h2>
                <p className="detail-customer">{selectedCustomer?.customerName ?? 'Cliente sin ficha'} · {selectedCustomer?.contactName ?? 'Contacto no indicado'}</p>
                <div className="detail-status">
                  <div className={`owner-badge ${selectedAssignee ? 'has-owner' : ''}`}>
                    {selectedAssignee
                      ? <><PixelAvatar memberId={selectedAssignee.memberId} size={28} /><span><small>LO LLEVA</small>{selectedAssignee.memberName}{selectedAssignee.memberId === currentMemberId ? ' (tú)' : ''} · {selectedLevel}</span></>
                      : <><span className="owner-empty">?</span><span><small>LO LLEVA</small>Nadie todavía</span></>}
                  </div>
                  {selectedSla
                    ? <span className={`sla-countdown big tone-${selectedSla.tone}`}>{selectedSla.label}</span>
                    : selectedLive?.isResolved ? <span className="sla-countdown big tone-accent">Resuelto</span> : null}
                </div>
              </header>

              <div className="detail-tabs" aria-label="Secciones del detalle">
                <button type="button" className={detailTab === 'ticket' ? 'is-active' : ''} aria-pressed={detailTab === 'ticket'} onClick={() => setDetailTab('ticket')}>Ticket</button>
                <button type="button" className={detailTab === 'reply' ? 'is-active' : ''} aria-pressed={detailTab === 'reply'} onClick={() => setDetailTab('reply')}>Responder</button>
                <button type="button" className={`tab-ric ${detailTab === 'ric' ? 'is-active' : ''}`} aria-pressed={detailTab === 'ric'} onClick={() => setDetailTab('ric')}><Sparkles aria-hidden="true" /> Preguntar a Ric</button>
                <button type="button" className={detailTab === 'history' ? 'is-active' : ''} aria-pressed={detailTab === 'history'} onClick={() => setDetailTab('history')}>Historial ({selectedEvents.length})</button>
              </div>

              <div className="detail-body">
                {detailTab === 'ticket' && <>
                  <article className="customer-message">
                    <div className="message-meta"><span>MENSAJE DEL CLIENTE</span><span>{selectedTicket.channel ?? 'Canal desconocido'} · {formatDate(selectedTicket.createdAt)}</span></div>
                    <p>{selectedTicket.description ?? 'Sin descripción disponible.'}</p>
                  </article>

                  <div className="detail-section">
                    <div className="section-heading"><span>FLUJO</span><span>abierto {formatAge(selectedTicket.createdAt)}</span></div>
                    <ol className="flow-steps" aria-label={`Estado actual: ${['Abierto', 'Nivel 1', 'Nivel 2', 'Resuelto'][flowStep]}`}>
                      {['Abierto', 'Nivel 1', 'Nivel 2', 'Resuelto'].map((step, index) => (
                        <li key={step} className={`flow-step ${index < flowStep ? 'is-done' : ''} ${index === flowStep ? 'is-now' : ''}`}>
                          <i>{index < flowStep ? <Check aria-hidden="true" /> : index + 1}</i><span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="ping-suggestion">
                    <div className="ping-label" title="PING> es la consola de Ping, el becario: sugiere a quién asignar y diagnostica el problema"><Zap aria-hidden="true" /> PING&gt;</div>
                    <div className="ping-body">
                      {selectedLive?.isResolved ? (
                        <p>Este ya está resuelto. Nada que ver aquí… de momento.</p>
                      ) : suggestion ? (
                        <>
                          <p>{requiresN2 ? 'Esto necesita Nivel 2.' : 'Nivel 1 puede con esto.'} Sugiero a <strong>{suggestion.memberName ?? 'Soporte'}</strong> ({teamLoads.get(suggestion.memberId ?? '') ?? 0} en curso).</p>
                          <button type="button" className="button button-small button-accent" disabled={busy || !onDuty}
                            onClick={() => void assignTicket(selectedTicket, suggestion, 'asignado', `Asignado a ${suggestion.memberName ?? 'soporte'} por sugerencia de Ping.`, `> Asignado a ${suggestion.memberName ?? 'soporte'}. Que la fuerza le acompañe.`)}>
                            Aceptar
                          </button>
                        </>
                      ) : (
                        <p>No hay nadie de {suggestionLevel}{isChatTicket ? ' en Chat' : ''} para sugerir.</p>
                      )}
                    </div>
                    {diagnosis && (
                      <p className="diagnostic" title={diagnosis.explanation} aria-label={`Diagnóstico de Ping: ${diagnosis.kind}, probabilidad ${diagnosis.probability} %. ${diagnosis.explanation}`}>
                        <Info aria-hidden="true" /> Diagnóstico: <b>{diagnosis.kind}</b> · {diagnosis.probability} %
                      </p>
                    )}
                  </div>

                  <div className="action-row">
                    <button type="button" className="button button-primary" disabled={busy || selectedLive?.isResolved || !currentMember || !onDuty || selectedAssignee?.memberId === currentMemberId}
                      onClick={() => currentMember && void assignTicket(selectedTicket, currentMember, 'asignado', `Asignado a ${currentMemberName}.`, '> Asignado a ti. Que la fuerza te acompañe.')}>
                      <Zap aria-hidden="true" /> {selectedAssignee?.memberId === currentMemberId ? 'Ya es tuyo' : 'Me lo pido'}
                    </button>
                    <button type="button" className="button button-outline" disabled={busy || selectedLive?.isResolved || !onDuty || !team.some((member) => memberLevel(member.role) === 'N2')} onClick={() => escalate(selectedTicket)}>
                      <Users aria-hidden="true" /> Escalar a N2
                    </button>
                    <button type="button" className="button button-resolve" disabled={busy || selectedLive?.isResolved} onClick={() => { setShowResolveForm((shown) => !shown); setClosingReason(''); }}>
                      <Check aria-hidden="true" /> Marcar resuelto
                    </button>
                  </div>
                  {showResolveForm && (
                    <div className="resolve-form">
                      <label htmlFor="closure-reason">Motivo de cierre <span aria-hidden="true">*</span></label>
                      <select id="closure-reason" required value={closingReason} onChange={(event) => setClosingReason(event.target.value)}>
                        <option value="">Selecciona un motivo…</option>
                        {closureReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                      </select>
                      <button type="button" className="button button-small button-accent" disabled={busy || !closingReason} onClick={() => void resolveTicket(selectedTicket, closingReason)}>Confirmar resolución</button>
                    </div>
                  )}

                  <div className="detail-section">
                    <div className="section-heading"><span>ASIGNAR A</span><span>menos carga primero</span></div>
                    {(['N1', 'N2'] as const).map((level) => (
                      <div className="member-group" key={level}>
                        <span className={`level-label ${level === 'N2' ? 'level-n2' : ''}`}>{level}</span>
                        <div className="member-buttons">
                          {[...team]
                            .filter((member) => memberLevel(member.role) === level)
                            .sort((a, b) => (teamLoads.get(a.memberId ?? '') ?? 0) - (teamLoads.get(b.memberId ?? '') ?? 0))
                            .map((member) => (
                              <button key={member.memberId ?? member.memberName} type="button"
                                className={`member-button ${selectedAssignee?.memberId === member.memberId ? 'is-assigned' : ''}`}
                                disabled={busy || selectedLive?.isResolved || !onDuty}
                                title={`${member.memberName ?? ''} · ${memberRoleLabel(member.role)}`}
                                aria-pressed={selectedAssignee?.memberId === member.memberId}
                                onClick={() => void assignTicket(selectedTicket, member, 'asignado', `Asignado a ${member.memberName ?? 'soporte'}.`, `> Asignado a ${member.memberName ?? 'soporte'}. Que la fuerza le acompañe.`)}>
                                <PixelAvatar memberId={member.memberId} size={20} />
                                <span>{firstName(member)}</span>
                                <b>{teamLoads.get(member.memberId ?? '') ?? 0}</b>
                              </button>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>}

                {detailTab === 'reply' && (
                  <div className="reply-block">
                    <article className="customer-message compact">
                      <div className="message-meta"><span>{selectedCustomer?.contactName ?? 'El cliente'} escribió</span><span>{selectedTicket.channel ?? ''}</span></div>
                      <p>{selectedTicket.description ?? 'Sin descripción disponible.'}</p>
                    </article>
                    <div className="section-heading"><span>TU RESPUESTA</span><span>se guarda en el historial</span></div>
                    <div className="quick-replies">
                      {quickReplies.map((message) => (
                        <button type="button" key={message} className="chip" onClick={() => setReply(message)}>{message}</button>
                      ))}
                    </div>
                    <label className="visually-hidden" htmlFor="ticket-reply">Respuesta al ticket</label>
                    <textarea id="ticket-reply" value={reply} maxLength={2000} onChange={(event) => setReply(event.target.value)} placeholder={`Hola ${selectedCustomer?.contactName?.split(' ')[0] ?? ''}, …`} disabled={busy || selectedLive?.isResolved} />
                    <div className="reply-submit-row">
                      <span>{reply.length}/2000</span>
                      <button type="button" className="button button-primary" disabled={busy || selectedLive?.isResolved || !reply.trim()} onClick={() => void sendReply(selectedTicket)}>
                        <Send aria-hidden="true" /> Enviar respuesta
                      </button>
                    </div>
                  </div>
                )}

                {detailTab === 'ric' && (
                  <AskRic
                    customerName={selectedCustomer?.customerName ?? 'este cliente'}
                    ticketSubject={selectedTicket.subject ?? 'este ticket'}
                    onUseAnswer={(answer) => {
                      setReply((current) => (current.trim() ? `${current.trim()}\n\n${answer}` : answer));
                      setDetailTab('reply');
                    }}
                  />
                )}

                {detailTab === 'history' && (
                  <div className="history-block">
                    <ol className="history-list">
                      {selectedTicket.createdAt && (
                        <li><i /><span><strong>Ticket abierto en el Lakehouse</strong><small>{selectedTicket.channel ?? ''} · {formatDate(selectedTicket.createdAt)}</small></span></li>
                      )}
                      {selectedEvents.map((event) => (
                        <li key={event.id}><i className={`history-${event.type}`} />
                          <span><strong>{event.type} · {event.text}</strong><small>{event.author} · {formatDate(event.createdAt)}</small></span>
                        </li>
                      ))}
                      {!selectedTicket.createdAt && !selectedEvents.length && <li className="history-empty">Todavía no hay eventos guardados.</li>}
                    </ol>
                  </div>
                )}
              </div>
            </section>
          )}
        </aside>

        <footer className="app-footer">
          <span>Sistema operativo: paciencia · Uptime del sótano 99,9 %</span>
          <span>Lakehouse: solo lectura · Asignaciones, respuestas y estados: base de datos de la app</span>
          <span className="basement-tip">Consejo del sótano: {basementTip}</span>
        </footer>
        {manualOpen && <HelpDialog manual team={team} onClose={() => setManualOpen(false)} />}
        {shortcutsOpen && <HelpDialog manual={false} team={team} onClose={() => setShortcutsOpen(false)} />}
      </div>
    </main>
  );
}

export default App;
