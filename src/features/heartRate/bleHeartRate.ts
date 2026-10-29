import { PermissionsAndroid, Platform } from 'react-native';
import BleManager, { BleState } from 'react-native-ble-manager';
import { HR_MEASUREMENT, HR_SERVICE, isUuid, parseHeartRate } from '@/features/heartRate/heartRate';
import { useHeartRateStore, type HeartRateDevice } from '@/features/heartRate/heartRateStore';

/**
 * Connection to a Bluetooth heart rate monitor. One at a time; readings go to the heart rate
 * store, and from there to the session in progress. If the strap drops out (out of range,
 * battery), it reconnects by itself while `keepConnected` is on.
 */
type Listener = (bpm: number, at: number) => void;

let started = false;
let connectedId: string | null = null;
let keepConnected = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

const store = () => useHeartRateStore.getState();

async function androidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  if (Platform.Version >= 31) {
    const res = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    return Object.values(res).every((r) => r === PermissionsAndroid.RESULTS.GRANTED);
  }
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

async function ensureStarted(): Promise<boolean> {
  if (!(await androidPermissions())) {
    store().set({ status: 'unauthorized' });
    return false;
  }
  if (!started) {
    started = true;
    await BleManager.start({ showAlert: false });
    // Listeners live as long as the app (one manager, one monitor at a time).
    BleManager.onDidUpdateValueForCharacteristic((e) => {
      if (!isUuid(e.characteristic, HR_MEASUREMENT)) return;
      const reading = parseHeartRate(e.value);
      if (!reading || reading.bpm <= 0) return;
      const at = Date.now();
      store().set({ bpm: reading.bpm, at, contact: reading.contact, status: 'connected' });
      for (const l of listeners) l(reading.bpm, at);
    });
    BleManager.onDisconnectPeripheral((e) => {
      if (e.peripheral !== connectedId) return;
      connectedId = null;
      if (keepConnected) {
        store().set({ status: 'reconnecting' });
        scheduleReconnect();
      } else {
        store().set({ status: 'idle', bpm: null });
      }
    });
    BleManager.onDidUpdateState(({ state }) => {
      if (state === BleState.Off) store().set({ status: 'bluetoothOff', bpm: null });
      else if (state === BleState.On && keepConnected && !connectedId) scheduleReconnect(500);
    });
    BleManager.onDiscoverPeripheral((p) => {
      const name = p.name || p.advertising?.localName;
      if (!name) return;
      const found = store().found.filter((d) => d.id !== p.id);
      found.push({ id: p.id, name, rssi: p.rssi });
      found.sort((a, b) => b.rssi - a.rssi);
      store().set({ found });
    });
    BleManager.onStopScan(() => {
      if (store().status === 'scanning') store().set({ status: 'idle' });
    });
  }
  const state = await BleManager.checkState();
  if (state === BleState.Off) {
    store().set({ status: 'bluetoothOff' });
    return false;
  }
  if (state === BleState.Unauthorized) {
    store().set({ status: 'unauthorized' });
    return false;
  }
  if (state === BleState.Unsupported) {
    store().set({ status: 'unsupported' });
    return false;
  }
  return true;
}

/** Looks for heart rate monitors for a few seconds (results in the store's `found`). */
export async function scanForMonitors(seconds = 8) {
  try {
    if (!(await ensureStarted())) return;
    store().set({ found: [], status: 'scanning' });
    await BleManager.scan({ serviceUUIDs: [HR_SERVICE], seconds, allowDuplicates: false });
  } catch {
    store().set({ status: 'error' });
  }
}

export async function stopScan() {
  try {
    await BleManager.stopScan();
  } catch {
    // not scanning
  }
}

/** Connects, subscribes to heart rate and remembers the monitor for next time. */
export async function connectMonitor(device: HeartRateDevice): Promise<boolean> {
  try {
    if (!(await ensureStarted())) return false;
    await stopScan();
    keepConnected = true;
    store().set({ status: 'connecting', saved: device });
    await BleManager.connect(device.id);
    await BleManager.retrieveServices(device.id, [HR_SERVICE]);
    await BleManager.startNotification(device.id, HR_SERVICE, HR_MEASUREMENT);
    connectedId = device.id;
    store().set({ status: 'connected' });
    return true;
  } catch {
    connectedId = null;
    if (keepConnected) {
      store().set({ status: 'reconnecting' });
      scheduleReconnect();
    } else {
      store().set({ status: 'error' });
    }
    return false;
  }
}

function scheduleReconnect(delay = 4000) {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    const saved = store().saved;
    if (keepConnected && saved && !connectedId) void connectMonitor(saved);
  }, delay);
}

/** For a workout: connect to the remembered monitor (if any) and stay connected. */
export async function connectSavedMonitor() {
  const saved = store().saved;
  if (!saved || connectedId === saved.id) return;
  await connectMonitor(saved);
}

export async function disconnectMonitor() {
  keepConnected = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = null;
  const id = connectedId;
  connectedId = null;
  store().set({ status: 'idle', bpm: null });
  if (!id) return;
  try {
    await BleManager.stopNotification(id, HR_SERVICE, HR_MEASUREMENT);
  } catch {
    // already gone
  }
  try {
    await BleManager.disconnect(id);
  } catch {
    // already gone
  }
}

export function forgetMonitor() {
  void disconnectMonitor();
  store().forget();
}

/** Every reading while connected (returns an unsubscribe). */
export function onHeartRate(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
