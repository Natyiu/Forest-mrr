import React from 'react';
import { PaymentEvent, Plant } from '../types';

/**
 * The live wire.
 *
 * The server has always broadcast every payment, failure, upgrade and churn
 * over `/api/stream`; nothing was listening. The garden updated only for the
 * person who clicked the button, so two browsers open on the same plot showed
 * two different gardens, and the "live" in "live dashboard" was doing no work.
 *
 * Events arrive here and are applied to the local book directly rather than
 * triggering a refetch: the payload already carries the whole subscription, and
 * a refetch would repaint two hundred trees to move one.
 */

export type StreamStatus = 'connecting' | 'live' | 'offline';

interface StreamHandlers {
  onPayment?: (event: PaymentEvent) => void;
  onPlantUpdate?: (plant: Plant, kind: string) => void;
  onPlantCreated?: (plant: Plant) => void;
  onWeather?: (event: { type: string; plantId?: string }) => void;
}

export function useEventStream(handlers: StreamHandlers, enabled = true): StreamStatus {
  const [status, setStatus] = React.useState<StreamStatus>('connecting');

  // As with hotkeys: keep the latest callbacks without re-opening the socket,
  // which would drop events every time the garden re-renders.
  const ref = React.useRef(handlers);
  ref.current = handlers;

  React.useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return;

    const source = new EventSource('/api/stream');

    const parse = <T,>(event: MessageEvent, apply: (payload: T) => void) => {
      try {
        apply(JSON.parse(event.data) as T);
      } catch {
        // A malformed frame is not worth tearing the stream down for.
      }
    };

    source.addEventListener('open', () => setStatus('live'));
    source.addEventListener('error', () => setStatus(source.readyState === 2 ? 'offline' : 'connecting'));

    source.addEventListener('payment_event', (event) =>
      parse<PaymentEvent>(event as MessageEvent, (payload) => ref.current.onPayment?.(payload))
    );
    source.addEventListener('plant_update', (event) =>
      parse<{ plant: Plant; event: string }>(event as MessageEvent, (payload) =>
        ref.current.onPlantUpdate?.(payload.plant, payload.event)
      )
    );
    source.addEventListener('plant_created', (event) =>
      parse<{ plant: Plant }>(event as MessageEvent, (payload) => ref.current.onPlantCreated?.(payload.plant))
    );
    source.addEventListener('weather_event', (event) =>
      parse<{ type: string; plantId?: string }>(event as MessageEvent, (payload) =>
        ref.current.onWeather?.(payload)
      )
    );

    return () => source.close();
  }, [enabled]);

  return status;
}
