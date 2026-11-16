import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock('@/lib/rayfin-client', () => ({ getRayfinClient: getClient }));

import App from '@/App';

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function pagedQuery(items: unknown[], reject = false) {
  const query = {
    select: () => query,
    orderBy: () => query,
    first: () => query,
    after: () => query,
    where: () => query,
    executePaginated: () =>
      reject
        ? Promise.reject(new Error('Entity not deployed'))
        : Promise.resolve({ items, hasNextPage: false }),
  };
  return query;
}

describe('App', () => {
  it('shows the honest loading state while the live sources are pending', () => {
    getClient.mockReturnValue(new Promise(() => {}));
    render(<App />);

    expect(screen.getByRole('status')).toHaveTextContent(
      /Reiniciando el servidor|Buscando el cable|Comprobando la capa 8|Consultando con el becario/
    );
    expect(screen.queryByRole('heading', { name: 'MOSS TRIAGE' })).toBeNull();
  });

  it('shows Lakehouse tickets when reading app-owned records fails', async () => {
    getClient.mockResolvedValue({
      connectors: {
        ricsupport: {
          Tickets: pagedQuery([{
            ticketId: 'TK-TEST',
            customerId: 'C001',
            createdAt: new Date('2026-11-15T10:00:00Z'),
            category: 'Acceso',
            subject: 'Ticket vivo desde Lakehouse',
            description: 'No se pierden los datos de la cola.',
            priority: 'Alta',
            channel: 'Email',
            status: 'Abierto',
            assignedTo: '',
            resolvedAt: null,
            slaHours: 24,
            slaBreached: false,
          }]),
          Customers: pagedQuery([{
            customerId: 'C001',
            customerName: 'Cliente',
            contactName: 'Contacto',
          }]),
          SupportTeam: pagedQuery([{
            memberId: 'ST01',
            memberName: 'Mónica Mesa',
            role: 'Soporte N2 · Datos y Fabric',
          }]),
        },
      },
      data: {
        TicketAssignment: pagedQuery([], true),
        TicketEvent: pagedQuery([], true),
      },
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'MOSS TRIAGE' })).toBeVisible();
    expect(await screen.findByText('Ticket vivo desde Lakehouse')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'La cola sigue disponible, pero no se pudo cargar asignaciones ni historial guardados.'
    );
  });

  it('combines ticket filters and requires a closure reason before saving', async () => {
    const storedEvents: {
      id: string;
      ticketId: string;
      type: string;
      text: string;
      createdAt: Date;
      author: string;
    }[] = [];
    const createEvent = vi.fn(async (event: Omit<(typeof storedEvents)[number], 'id'>) => {
      storedEvents.push({ ...event, id: 'EVT1' });
      return {};
    });
    getClient.mockResolvedValue({
      connectors: {
        ricsupport: {
          Tickets: pagedQuery([{
            ticketId: 'TK-HW-1',
            customerId: 'C001',
            createdAt: new Date(),
            category: 'Hardware',
            subject: 'Monitor sin señal',
            description: 'El monitor no enciende.',
            priority: 'Alta',
            channel: 'Chat',
            status: 'Abierto',
            assignedTo: '',
            resolvedAt: null,
            slaHours: 24,
            slaBreached: false,
          }]),
          Customers: pagedQuery([{
            customerId: 'C001',
            customerName: 'Cliente',
            contactName: 'Contacto',
          }]),
          SupportTeam: pagedQuery([{
            memberId: 'ST01',
            memberName: 'Mónica Mesa',
            role: 'Soporte N2 · Datos y Fabric',
          }]),
        },
      },
      data: {
        TicketAssignment: pagedQuery([]),
        TicketEvent: { ...pagedQuery(storedEvents), create: createEvent },
      },
    });

    render(<App />);
    expect(await screen.findByText('Monitor sin señal')).toBeVisible();
    expect(screen.getByText('Elige un ticket. Ping te espera.')).toBeVisible();
    expect(screen.getByText(/quedan/)).toBeVisible();
    const search = screen.getByRole('searchbox', { name: 'Buscar en asunto y descripción' });
    fireEvent.change(search, { target: { value: 'fuego' } });
    expect(search).toHaveValue('');
    expect(screen.getByText('> Activado el protocolo extintor. Mantenga la calma.')).toBeVisible();
    fireEvent.keyDown(document.body, { key: 'j' });
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(screen.getByRole('button', { name: 'Cerrar detalle' })).toBeVisible();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.getByText('Elige un ticket. Ping te espera.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Hardware' }));
    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Crítica 0' }));
    expect(screen.getByText('No hay tickets con estos filtros.')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Limpiar filtros/ }));
    fireEvent.click(screen.getByRole('button', { name: /Monitor sin señal/ }));
    expect(await screen.findAllByText('Monitor sin señal')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: /Marcar resuelto/ }));
    const confirmButton = screen.getByRole('button', { name: 'Confirmar resolución' });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: 'Motivo de cierre' }), {
      target: { value: 'PEBKAC confirmado' },
    });
    fireEvent.click(confirmButton);

    await waitFor(() =>
      expect(createEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 'TK-HW-1',
          type: 'resuelto',
          text: 'Motivo de cierre: PEBKAC confirmado',
        })
      )
    );
    await screen.findByRole('button', { name: /Historial \(1\)/ });
    fireEvent.click(screen.getByRole('button', { name: /Historial \(1\)/ }));
    expect(await screen.findByText('resuelto · Motivo de cierre: PEBKAC confirmado')).toBeVisible();
  });
});
