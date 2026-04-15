type TeacherLiveUpdateSource =
  | "school"
  | "class"
  | "student"
  | "session"
  | "record"
  | "summary"
  | "resync";

export type TeacherLiveUpdateEvent = {
  type: "teacher-data-changed";
  source: TeacherLiveUpdateSource;
  emittedAt: string;
  originClientId: string | null;
};

type TeacherLiveUpdateListener = (event: TeacherLiveUpdateEvent) => void;

const STREAM_RETRY_MS = 5000;
const STREAM_KEEPALIVE_MS = 25000;

const getTeacherLiveUpdateChannels = () => {
  const globalScope = globalThis as typeof globalThis & {
    __papsTeacherLiveUpdateChannels?: Map<string, Set<TeacherLiveUpdateListener>>;
  };

  if (!globalScope.__papsTeacherLiveUpdateChannels) {
    globalScope.__papsTeacherLiveUpdateChannels = new Map();
  }

  return globalScope.__papsTeacherLiveUpdateChannels;
};

const normalizeTeacherChannel = (teacherEmail: string) => teacherEmail.trim().toLowerCase();

const encodeEvent = ({
  event,
  data
}: {
  event: string;
  data: Record<string, unknown>;
}) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

export const subscribeTeacherLiveUpdate = (
  teacherEmail: string,
  listener: TeacherLiveUpdateListener
) => {
  const channel = normalizeTeacherChannel(teacherEmail);
  const channels = getTeacherLiveUpdateChannels();
  const listeners = channels.get(channel) ?? new Set<TeacherLiveUpdateListener>();

  listeners.add(listener);
  channels.set(channel, listeners);

  return () => {
    const currentListeners = channels.get(channel);

    if (!currentListeners) {
      return;
    }

    currentListeners.delete(listener);

    if (currentListeners.size === 0) {
      channels.delete(channel);
    }
  };
};

export const publishTeacherLiveUpdate = ({
  teacherEmail,
  source,
  emittedAt = new Date().toISOString(),
  originClientId = null
}: {
  teacherEmail: string;
  source: TeacherLiveUpdateSource;
  emittedAt?: string;
  originClientId?: string | null;
}) => {
  const listeners = getTeacherLiveUpdateChannels().get(normalizeTeacherChannel(teacherEmail));

  if (!listeners || listeners.size === 0) {
    return 0;
  }

  const event: TeacherLiveUpdateEvent = {
    type: "teacher-data-changed",
    source,
    emittedAt,
    originClientId
  };

  for (const listener of Array.from(listeners)) {
    listener(event);
  }

  return listeners.size;
};

export const createTeacherLiveUpdateStream = ({
  teacherEmail,
  signal
}: {
  teacherEmail: string;
  signal?: AbortSignal;
}) => {
  const encoder = new TextEncoder();
  let cleanup = () => {};

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let isClosed = false;

      const enqueue = (message: string) => {
        if (isClosed) {
          return;
        }

        controller.enqueue(encoder.encode(message));
      };

      const handleUpdate = (event: TeacherLiveUpdateEvent) => {
        enqueue(
          encodeEvent({
            event: event.type,
            data: event
          })
        );
      };
      const unsubscribe = subscribeTeacherLiveUpdate(teacherEmail, handleUpdate);
      const keepaliveId = setInterval(() => {
        enqueue(": keepalive\n\n");
      }, STREAM_KEEPALIVE_MS);

      cleanup = () => {
        if (isClosed) {
          return;
        }

        isClosed = true;
        clearInterval(keepaliveId);
        unsubscribe();
        signal?.removeEventListener("abort", cleanup);
      };

      signal?.addEventListener("abort", cleanup, { once: true });

      enqueue(`retry: ${STREAM_RETRY_MS}\n\n`);
      enqueue(
        encodeEvent({
          event: "connected",
          data: {
            connectedAt: new Date().toISOString()
          }
        })
      );
    },
    cancel() {
      cleanup();
    }
  });
};
