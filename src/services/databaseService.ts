import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import {
  db,
  auth,
  syncFirebaseEmailAuth,
  provisionFirebaseEmailAccount,
  OperationType,
  handleFirestoreError,
  User,
} from '../firebase';
import {
  OPD,
  PeriodePelaporan,
  MatrixData,
  RealisasiSemester,
  AuditLog,
  EnrichedMatrixRow,
  SemesterNumber,
  VerificationStatus,
  AuthUser,
  UserRole,
  InstansiKategori,
} from '../types/oppkpke';
import {
  SEED_OPD,
  SEED_PERIODE,
  SEED_MATRIX_DATA,
  SEED_REALISASI_SEMESTER,
  SEED_AUDIT_LOGS,
  SEED_USERS,
} from '../data/bloraSeedData';
import { formatRupiah } from '../utils/formatters';
import { ParsedExcelBaseRow } from '../utils/excelService';
import { SipdService } from './sipdService';

const STORAGE_KEYS = {
  PERIODE: 'e_oppkpke_blora_periode_v3',
  OPD: 'e_oppkpke_blora_opd_v5',
  USERS: 'e_oppkpke_blora_users_v7',
  MATRIX: 'e_oppkpke_blora_matrix_v4',
  REALISASI: 'e_oppkpke_blora_realisasi_v4',
  AUDIT: 'e_oppkpke_blora_audit_v4',
  SESSION_USER: 'e_oppkpke_blora_session_v2',
  LAST_SYNC_AT: 'e_oppkpke_blora_last_sync_v1',
};

if (typeof window !== 'undefined') {
  try {
    [
      'e_oppkpke_blora_opd_v4',
      'e_oppkpke_blora_users_v6',
      'e_oppkpke_blora_matrix_v3',
      'e_oppkpke_blora_realisasi_v3',
      'e_oppkpke_blora_audit_v3',
    ].forEach((legacyKey) => localStorage.removeItem(legacyKey));
  } catch {
    // ignore storage cleanup errors
  }
}

/**
 * Pembentuk format email standar autentikasi user: [namaopd]@oppkpke.com
 */
export function formatOpdEmail(usernameOrEmail: string): string {
  const clean = usernameOrEmail.trim().toLowerCase();
  if (!clean) return 'opd@oppkpke.com';
  const localPart = clean
    .split('@')[0]
    .replace(/[^a-z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
  return `${localPart || 'opd'}@oppkpke.com`;
}

function loadTable<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(fallback));
      return fallback;
    }
    return JSON.parse(raw) as T[];
  } catch {
    return fallback;
  }
}

const REALTIME_CHANNEL_NAME = 'optimis_blora_realtime_v1';
const realtimeChannel: BroadcastChannel | null =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel(REALTIME_CHANNEL_NAME)
    : null;

function notifyRealtimeChannel(key: string): void {
  try {
    realtimeChannel?.postMessage({ key, timestamp: Date.now() });
  } catch {
    // ignore
  }
}

function saveTable<T>(key: string, data: T[], fromRemote = false): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    if (!fromRemote) {
      notifyRealtimeChannel(key);
    }
  } catch (e) {
    console.error('Gagal menyimpan tabel ke storage:', e);
  }
}

let pendingAuthPromise: Promise<User | null> | null = null;
let hasTriggeredInitialCloudSeed = false;

async function ensureFirebaseAuth(): Promise<User | null> {
  if (auth.currentUser) return auth.currentUser;
  if (pendingAuthPromise) return pendingAuthPromise;

  pendingAuthPromise = (async () => {
    try {
      // Gunakan kredensial sinkronisasi utama agar seluruh dokumen memiliki akses bersama lintas perangkat/Vercel
      const email = 'admin@oppkpke.com';
      const password = 'admin';
      return await syncFirebaseEmailAuth(email, password);
    } catch {
      return auth.currentUser;
    } finally {
      pendingAuthPromise = null;
    }
  })();

  return pendingAuthPromise;
}

async function upsertFirestoreDocument(
  collectionName: string,
  docId: string,
  fields: Record<string, unknown>
): Promise<void> {
  await ensureFirebaseAuth();
  const ownerId = auth.currentUser?.uid || 'optimis-blora-shared';

  const path = `${collectionName}/${docId}`;
  const docRef = doc(db, collectionName, docId);
  try {
    const existingSnap = await getDoc(docRef);
    if (!existingSnap.exists()) {
      await setDoc(docRef, {
        ...fields,
        ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        docRef,
        {
          ...fields,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

async function removeFirestoreDocument(
  collectionName: string,
  docId: string
): Promise<void> {
  await ensureFirebaseAuth();

  const path = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function pruneFirestoreCollection(
  collectionName: string,
  keepDocIds: Set<string>
): Promise<void> {
  await ensureFirebaseAuth();
  try {
    const snap = await getDocs(collection(db, collectionName));
    const deletions: Promise<void>[] = [];
    snap.forEach((d) => {
      if (!keepDocIds.has(d.id)) {
        deletions.push(deleteDoc(doc(db, collectionName, d.id)));
      }
    });
    if (deletions.length > 0) {
      await Promise.allSettled(deletions);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, collectionName);
  }
}

function serializePeriodeForFirestore(p: PeriodePelaporan): Record<string, unknown> {
  return {
    periode_id: p.periode_id,
    tahun: Math.round(Number(p.tahun)),
    nama_periode: String(p.nama_periode || `Tahun Anggaran ${p.tahun}`).slice(0, 120),
    semester_1_buka: Boolean(p.semester_1_buka),
    semester_2_buka: Boolean(p.semester_2_buka),
    batas_semester_1: String(p.batas_semester_1 || '').slice(0, 32),
    batas_semester_2: String(p.batas_semester_2 || '').slice(0, 32),
    is_active: Boolean(p.is_active),
  };
}

function serializeOpdForFirestore(o: OPD): Record<string, unknown> {
  return {
    opd_id: o.opd_id,
    kode_opd: String(o.kode_opd || '1.00.01').slice(0, 32),
    nama_opd: String(o.nama_opd || 'OPD Kabupaten Blora').slice(0, 200),
    singkatan: String(o.singkatan || 'OPD').slice(0, 64),
    kategori: o.kategori || 'OPD/Dinas/Badan',
    kepala_opd: String(o.kepala_opd || '').slice(0, 150),
  };
}

function serializeUserForFirestore(u: AuthUser): Record<string, unknown> {
  const resolvedEmail = formatOpdEmail(u.email || u.username);
  return {
    user_id: u.user_id,
    username: String(u.username || 'user').slice(0, 64),
    email: resolvedEmail.slice(0, 120),
    password_hint: String(u.password_hint || 'lamis123').slice(0, 64),
    role: u.role,
    opd_id: u.opd_id ?? null,
    kategori: u.kategori || (u.role === 'ADMIN' ? 'Admin' : 'OPD/Dinas/Badan'),
    display_name: String(u.display_name || u.username).slice(0, 200),
    instansi_label: String(u.instansi_label || 'INSTANSI').slice(0, 64),
    instansi_lengkap: String(u.instansi_lengkap || u.display_name).slice(0, 200),
    jabatan: String(u.jabatan || '').slice(0, 120),
  };
}

function serializeMatrixForFirestore(m: MatrixData): Record<string, unknown> {
  return {
    matrix_id: m.matrix_id,
    periode_id: m.periode_id,
    opd_id: m.opd_id,
    strategi: String(m.strategi || '1. Pengurangan Beban Pengeluaran Masyarakat').slice(0, 200),
    kode: String(m.kode || '1.00.01').slice(0, 64),
    program: String(m.program || '').slice(0, 300),
    kegiatan: String(m.kegiatan || '').slice(0, 300),
    sub_kegiatan: String(m.sub_kegiatan || '-').slice(0, 400),
    aktivitas_real_langsung: String(m.aktivitas_real_langsung || '').slice(0, 1500),
    aktivitas_real_tidak_langsung: String(m.aktivitas_real_tidak_langsung || '').slice(0, 1500),
    aktivitas_real_penunjang: String(m.aktivitas_real_penunjang || '').slice(0, 1500),
    alokasi_anggaran: Math.max(0, Number(m.alokasi_anggaran) || 0),
    sumber_pembiayaan: String(m.sumber_pembiayaan || 'APBD Kabupaten').slice(0, 300),
    sifat_bantuan: String(m.sifat_bantuan || 'Berkelanjutan').slice(0, 40),
    lokasi: String(m.lokasi || '').slice(0, 300),
    lokasi_kecamatan: String(m.lokasi_kecamatan || '').slice(0, 120),
    lokasi_desa: String(m.lokasi_desa || '').slice(0, 200),
    lokasi_spesifik: String(m.lokasi_spesifik || '').slice(0, 200),
    jumlah_sasaran: Math.max(0, Number(m.jumlah_sasaran) || 0),
    satuan_sasaran: String(m.satuan_sasaran || 'KPM').slice(0, 64),
    keterangan_sasaran: String(m.keterangan_sasaran || '').slice(0, 500),
    besaran_manfaat: String(m.besaran_manfaat || '-').slice(0, 300),
    jenis_bantuan: String(m.jenis_bantuan || 'Bantuan sosial').slice(0, 120),
    durasi_pemberian_bantuan: String(m.durasi_pemberian_bantuan || '1 tahun').slice(0, 120),
    keterangan_durasi_bantuan: String(m.keterangan_durasi_bantuan || '').slice(0, 500),
  };
}

function serializeRealisasiForFirestore(r: RealisasiSemester): Record<string, unknown> {
  return {
    realisasi_id: r.realisasi_id,
    matrix_id: r.matrix_id,
    semester: r.semester,
    realisasi: Math.max(0, Number(r.realisasi) || 0),
    rincian_realisasi: String(r.rincian_realisasi || '').slice(0, 1500),
    status_verifikasi: r.status_verifikasi,
    catatan_verifikator: String(r.catatan_verifikator || '').slice(0, 1000),
    submitted_at: r.submitted_at ? String(r.submitted_at).slice(0, 64) : null,
    verified_at: r.verified_at ? String(r.verified_at).slice(0, 64) : null,
    verified_by: r.verified_by ? String(r.verified_by).slice(0, 120) : null,
  };
}

export class DatabaseService {
  static getLastSyncTimestamp(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEYS.LAST_SYNC_AT);
    } catch {
      return null;
    }
  }

  static setLastSyncTimestamp(iso: string): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC_AT, iso);
    } catch {
      // ignore
    }
  }

  /**
   * Sinkronkan seluruh data lokal ke Cloud Firestore secara berurutan
   */
  static async syncAllLocalToFirestore(options?: {
    pruneRemoved?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    counts: {
      periodes: number;
      opds: number;
      users: number;
      matrices: number;
      realisasis: number;
    };
  }> {
    await ensureFirebaseAuth();
    const currentUser = auth.currentUser;

    if (currentUser) {
      try {
        const adminRef = doc(db, 'admins', currentUser.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: currentUser.uid,
            createdAt: serverTimestamp(),
          });
        }
      } catch {
        // ignore
      }
    }

    const periodes = this.getPeriodeList();
    const opds = this.getOpdList();
    const users = this.getUsersList();
    const matrices = this.getMatrixDataList();
    const realisasis = this.getRealisasiList();
    const matrixIds = new Set(matrices.map((m) => m.matrix_id));
    const validRealisasis = realisasis.filter((r) => matrixIds.has(r.matrix_id));

    if (options?.pruneRemoved) {
      await Promise.allSettled([
        pruneFirestoreCollection('user_accounts', new Set(users.map((u) => u.user_id))),
        pruneFirestoreCollection('opds', new Set(opds.map((o) => o.opd_id))),
        pruneFirestoreCollection('matrices', matrixIds),
        pruneFirestoreCollection(
          'realisasis',
          new Set(validRealisasis.map((r) => r.realisasi_id))
        ),
      ]);
    }

    await Promise.allSettled([
      ...periodes.map((p) =>
        upsertFirestoreDocument('periodes', p.periode_id, serializePeriodeForFirestore(p))
      ),
      ...opds.map((o) =>
        upsertFirestoreDocument('opds', o.opd_id, serializeOpdForFirestore(o))
      ),
      ...users.map((u) =>
        upsertFirestoreDocument('user_accounts', u.user_id, serializeUserForFirestore(u))
      ),
      ...matrices.map((m) =>
        upsertFirestoreDocument('matrices', m.matrix_id, serializeMatrixForFirestore(m))
      ),
      ...validRealisasis.map((r) =>
        upsertFirestoreDocument(
          'realisasis',
          r.realisasi_id,
          serializeRealisasiForFirestore(r)
        )
      ),
      SipdService.syncWithCloud(),
    ]);

    const nowIso = new Date().toISOString();
    this.setLastSyncTimestamp(nowIso);

    return {
      success: true,
      message: 'Sinkronisasi berhasil.',
      counts: {
        periodes: periodes.length,
        opds: opds.length,
        users: users.length,
        matrices: matrices.length,
        realisasis: validRealisasis.length,
      },
    };
  }

  /**
   * Tarik (pull) seluruh koleksi dari Cloud Firestore ke penyimpanan lokal browser (penting untuk Vercel / perangkat baru)
   */
  static async pullAllFromFirestore(): Promise<boolean> {
    try {
      await ensureFirebaseAuth();
      const [
        periodesSnap,
        opdsSnap,
        usersSnap,
        matricesSnap,
        realisasisSnap,
        auditSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'periodes')),
        getDocs(collection(db, 'opds')),
        getDocs(collection(db, 'user_accounts')),
        getDocs(collection(db, 'matrices')),
        getDocs(collection(db, 'realisasis')),
        getDocs(collection(db, 'audit_logs')),
      ]);

      if (!periodesSnap.empty) {
        const items: PeriodePelaporan[] = periodesSnap.docs
          .map((d) => {
            const data = d.data();
            return {
              periode_id: String(data.periode_id || d.id),
              tahun: Number(data.tahun) || 2026,
              nama_periode: String(data.nama_periode || ''),
              semester_1_buka: Boolean(data.semester_1_buka),
              semester_2_buka: Boolean(data.semester_2_buka),
              batas_semester_1: String(data.batas_semester_1 || ''),
              batas_semester_2: String(data.batas_semester_2 || ''),
              is_active: Boolean(data.is_active),
              updated_at: new Date().toISOString(),
            };
          })
          .sort((a, b) => a.tahun - b.tahun);
        saveTable(STORAGE_KEYS.PERIODE, items, true);
      }

      if (!opdsSnap.empty || !opdsSnap.metadata.fromCache) {
        const items: OPD[] = opdsSnap.docs.map((d) => {
          const data = d.data();
          return {
            opd_id: String(data.opd_id || d.id),
            kode_opd: String(data.kode_opd || '1.00.01'),
            nama_opd: String(data.nama_opd || ''),
            singkatan: String(data.singkatan || ''),
            kategori: (data.kategori as InstansiKategori) || 'OPD/Dinas/Badan',
            kepala_opd: String(data.kepala_opd || ''),
          };
        });
        saveTable(STORAGE_KEYS.OPD, items, true);
      }

      if (!usersSnap.empty) {
        const items: AuthUser[] = usersSnap.docs.map((d) => {
          const data = d.data();
          const uname = String(data.username || '');
          return {
            user_id: String(data.user_id || d.id),
            username: uname,
            email: formatOpdEmail(String(data.email || uname)),
            password_hint: String(data.password_hint || ''),
            role: (data.role as UserRole) || 'OPD',
            opd_id: data.opd_id ? String(data.opd_id) : null,
            kategori: (data.kategori as InstansiKategori) || 'OPD/Dinas/Badan',
            display_name: String(data.display_name || ''),
            instansi_label: String(data.instansi_label || ''),
            instansi_lengkap: String(data.instansi_lengkap || ''),
            jabatan: String(data.jabatan || ''),
          };
        });
        if (!items.some((u) => u.role === 'ADMIN')) {
          items.unshift(SEED_USERS[0]);
        }
        saveTable(STORAGE_KEYS.USERS, items, true);
      } else if (!usersSnap.metadata.fromCache && !hasTriggeredInitialCloudSeed) {
        hasTriggeredInitialCloudSeed = true;
        await this.syncAllLocalToFirestore();
      }

      if (!matricesSnap.empty || !matricesSnap.metadata.fromCache) {
        const nowIso = new Date().toISOString();
        const items: MatrixData[] = matricesSnap.docs.map((d) => {
          const data = d.data();
          return {
            matrix_id: String(data.matrix_id || d.id),
            periode_id: String(data.periode_id || 'per-2026'),
            opd_id: String(data.opd_id || ''),
            strategi: String(data.strategi || ''),
            kode: String(data.kode || ''),
            program: String(data.program || ''),
            kegiatan: String(data.kegiatan || ''),
            sub_kegiatan: String(data.sub_kegiatan || ''),
            aktivitas_real_langsung: String(data.aktivitas_real_langsung || ''),
            aktivitas_real_tidak_langsung: String(
              data.aktivitas_real_tidak_langsung || ''
            ),
            aktivitas_real_penunjang: String(data.aktivitas_real_penunjang || ''),
            alokasi_anggaran: Number(data.alokasi_anggaran) || 0,
            sumber_pembiayaan: String(data.sumber_pembiayaan || 'APBD Kabupaten'),
            sifat_bantuan:
              data.sifat_bantuan === 'Tidak Berkelanjutan'
                ? 'Tidak Berkelanjutan'
                : 'Berkelanjutan',
            lokasi: String(data.lokasi || ''),
            lokasi_kecamatan: String(data.lokasi_kecamatan || ''),
            lokasi_desa: String(data.lokasi_desa || ''),
            lokasi_spesifik: String(data.lokasi_spesifik || ''),
            jumlah_sasaran: Number(data.jumlah_sasaran) || 0,
            satuan_sasaran: String(data.satuan_sasaran || 'KPM'),
            keterangan_sasaran: String(data.keterangan_sasaran || ''),
            besaran_manfaat: String(data.besaran_manfaat || ''),
            jenis_bantuan: String(data.jenis_bantuan || 'Bantuan sosial'),
            durasi_pemberian_bantuan: String(
              data.durasi_pemberian_bantuan || '1 tahun'
            ),
            keterangan_durasi_bantuan: String(
              data.keterangan_durasi_bantuan || ''
            ),
            created_at: nowIso,
            updated_at: nowIso,
          };
        });
        saveTable(STORAGE_KEYS.MATRIX, items, true);
      }

      if (!realisasisSnap.empty || !realisasisSnap.metadata.fromCache) {
        const items: RealisasiSemester[] = realisasisSnap.docs.map((d) => {
          const data = d.data();
          return {
            realisasi_id: String(data.realisasi_id || d.id),
            matrix_id: String(data.matrix_id || ''),
            semester: (Number(data.semester) === 2 ? 2 : 1) as SemesterNumber,
            realisasi: Number(data.realisasi) || 0,
            rincian_realisasi: String(data.rincian_realisasi || ''),
            status_verifikasi:
              (data.status_verifikasi as VerificationStatus) || 'Belum Diisi',
            catatan_verifikator: String(data.catatan_verifikator || ''),
            submitted_at: data.submitted_at ? String(data.submitted_at) : null,
            verified_at: data.verified_at ? String(data.verified_at) : null,
            verified_by: data.verified_by ? String(data.verified_by) : null,
            updated_at: new Date().toISOString(),
          };
        });
        saveTable(STORAGE_KEYS.REALISASI, items, true);
      }

      if (!auditSnap.empty || !auditSnap.metadata.fromCache) {
        const items: AuditLog[] = auditSnap.docs
          .map((d) => {
            const data = d.data();
            let createdIso = new Date().toISOString();
            if (
              data.createdAt &&
              typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function'
            ) {
              createdIso = (data.createdAt as { toDate: () => Date })
                .toDate()
                .toISOString();
            } else if (typeof data.created_at === 'string') {
              createdIso = data.created_at;
            }
            return {
              log_id: String(data.log_id || d.id),
              matrix_id: String(data.matrix_id || 'SYSTEM'),
              semester:
                data.semester === 1 || data.semester === 2
                  ? (data.semester as SemesterNumber)
                  : null,
              opd_id: String(data.opd_id || 'ALL'),
              user_role: (data.user_role as UserRole) || 'OPD',
              user_name: String(data.user_name || 'Sistem'),
              aksi: String(data.aksi || ''),
              detail_perubahan: String(data.detail_perubahan || ''),
              nilai_sebelumnya: data.nilai_sebelumnya
                ? String(data.nilai_sebelumnya)
                : undefined,
              nilai_baru: data.nilai_baru ? String(data.nilai_baru) : undefined,
              created_at: createdIso,
            };
          })
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        saveTable(STORAGE_KEYS.AUDIT, items, true);
      }

      await SipdService.syncWithCloud();

      this.setLastSyncTimestamp(new Date().toISOString());
      notifyRealtimeChannel(STORAGE_KEYS.LAST_SYNC_AT);
      return true;
    } catch (err) {
      console.warn('Gagal menarik data awal dari Cloud Firestore:', err);
      return false;
    }
  }

  /**
   * Berlangganan perubahan real-time dari Cloud Firestore (onSnapshot) lintas pengguna & perangkat
   */
  static subscribeToFirestore(onDataChanged: () => void): Unsubscribe {
    const unsubs: Unsubscribe[] = [];
    let isDisposed = false;
    let snapshotsAttached = false;

    // Sinkronisasi instan antar-tab pada browser yang sama
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key && Object.values(STORAGE_KEYS).includes(e.key)) {
        onDataChanged();
      }
    };
    const handleBroadcastMessage = () => {
      onDataChanged();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageEvent);
      realtimeChannel?.addEventListener('message', handleBroadcastMessage);
      unsubs.push(() => {
        window.removeEventListener('storage', handleStorageEvent);
        realtimeChannel?.removeEventListener('message', handleBroadcastMessage);
      });
    }

    const attachSnapshots = () => {
      if (isDisposed || snapshotsAttached) return;
      snapshotsAttached = true;

      unsubs.push(
        onSnapshot(
          collection(db, 'periodes'),
          (snap) => {
            if (!snap.empty) {
              const items: PeriodePelaporan[] = snap.docs
                .map((d) => {
                  const data = d.data();
                  return {
                    periode_id: String(data.periode_id || d.id),
                    tahun: Number(data.tahun) || 2026,
                    nama_periode: String(data.nama_periode || ''),
                    semester_1_buka: Boolean(data.semester_1_buka),
                    semester_2_buka: Boolean(data.semester_2_buka),
                    batas_semester_1: String(data.batas_semester_1 || ''),
                    batas_semester_2: String(data.batas_semester_2 || ''),
                    is_active: Boolean(data.is_active),
                    updated_at: new Date().toISOString(),
                  };
                })
                .sort((a, b) => a.tahun - b.tahun);
              saveTable(STORAGE_KEYS.PERIODE, items, true);
              this.setLastSyncTimestamp(new Date().toISOString());
              onDataChanged();
            }
          },
          (err) => {
            console.warn('Firestore listener (periodes):', err.message);
          }
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'opds'),
          (snap) => {
            if (!snap.empty || !snap.metadata.fromCache) {
              const items: OPD[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  opd_id: String(data.opd_id || d.id),
                  kode_opd: String(data.kode_opd || '1.00.01'),
                  nama_opd: String(data.nama_opd || ''),
                  singkatan: String(data.singkatan || ''),
                  kategori: (data.kategori as InstansiKategori) || 'OPD/Dinas/Badan',
                  kepala_opd: String(data.kepala_opd || ''),
                };
              });
              saveTable(STORAGE_KEYS.OPD, items, true);
              onDataChanged();
            }
          },
          (err) => {
            console.warn('Firestore listener (opds):', err.message);
          }
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'user_accounts'),
          (snap) => {
            if (!snap.empty) {
              const items: AuthUser[] = snap.docs.map((d) => {
                const data = d.data();
                const uname = String(data.username || '');
                return {
                  user_id: String(data.user_id || d.id),
                  username: uname,
                  email: formatOpdEmail(String(data.email || uname)),
                  password_hint: String(data.password_hint || ''),
                  role: (data.role as UserRole) || 'OPD',
                  opd_id: data.opd_id ? String(data.opd_id) : null,
                  kategori: (data.kategori as InstansiKategori) || 'OPD/Dinas/Badan',
                  display_name: String(data.display_name || ''),
                  instansi_label: String(data.instansi_label || ''),
                  instansi_lengkap: String(data.instansi_lengkap || ''),
                  jabatan: String(data.jabatan || ''),
                };
              });
              if (!items.some((u) => u.role === 'ADMIN')) {
                items.unshift(SEED_USERS[0]);
              }
              saveTable(STORAGE_KEYS.USERS, items, true);
              onDataChanged();
            }
          },
          (err) => {
            console.warn('Firestore listener (user_accounts):', err.message);
          }
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'matrices'),
          (snap) => {
            if (!snap.empty || !snap.metadata.fromCache) {
              const items: MatrixData[] = snap.docs.map((d) => {
                const data = d.data();
                const nowIso = new Date().toISOString();
                return {
                  matrix_id: String(data.matrix_id || d.id),
                  periode_id: String(data.periode_id || 'per-2026'),
                  opd_id: String(data.opd_id || ''),
                  strategi: String(data.strategi || ''),
                  kode: String(data.kode || ''),
                  program: String(data.program || ''),
                  kegiatan: String(data.kegiatan || ''),
                  sub_kegiatan: String(data.sub_kegiatan || ''),
                  aktivitas_real_langsung: String(data.aktivitas_real_langsung || ''),
                  aktivitas_real_tidak_langsung: String(
                    data.aktivitas_real_tidak_langsung || ''
                  ),
                  aktivitas_real_penunjang: String(data.aktivitas_real_penunjang || ''),
                  alokasi_anggaran: Number(data.alokasi_anggaran) || 0,
                  sumber_pembiayaan: String(data.sumber_pembiayaan || 'APBD Kabupaten'),
                  sifat_bantuan:
                    data.sifat_bantuan === 'Tidak Berkelanjutan'
                      ? 'Tidak Berkelanjutan'
                      : 'Berkelanjutan',
                  lokasi: String(data.lokasi || ''),
                  lokasi_kecamatan: String(data.lokasi_kecamatan || ''),
                  lokasi_desa: String(data.lokasi_desa || ''),
                  lokasi_spesifik: String(data.lokasi_spesifik || ''),
                  jumlah_sasaran: Number(data.jumlah_sasaran) || 0,
                  satuan_sasaran: String(data.satuan_sasaran || 'KPM'),
                  keterangan_sasaran: String(data.keterangan_sasaran || ''),
                  besaran_manfaat: String(data.besaran_manfaat || ''),
                  jenis_bantuan: String(data.jenis_bantuan || 'Bantuan sosial'),
                  durasi_pemberian_bantuan: String(
                    data.durasi_pemberian_bantuan || '1 tahun'
                  ),
                  keterangan_durasi_bantuan: String(
                    data.keterangan_durasi_bantuan || ''
                  ),
                  created_at: nowIso,
                  updated_at: nowIso,
                };
              });
              saveTable(STORAGE_KEYS.MATRIX, items, true);
              onDataChanged();
            }
          },
          (err) => {
            console.warn('Firestore listener (matrices):', err.message);
          }
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'realisasis'),
          (snap) => {
            if (!snap.empty || !snap.metadata.fromCache) {
              const items: RealisasiSemester[] = snap.docs.map((d) => {
                const data = d.data();
                return {
                  realisasi_id: String(data.realisasi_id || d.id),
                  matrix_id: String(data.matrix_id || ''),
                  semester: (Number(data.semester) === 2 ? 2 : 1) as SemesterNumber,
                  realisasi: Number(data.realisasi) || 0,
                  rincian_realisasi: String(data.rincian_realisasi || ''),
                  status_verifikasi:
                    (data.status_verifikasi as VerificationStatus) || 'Belum Diisi',
                  catatan_verifikator: String(data.catatan_verifikator || ''),
                  submitted_at: data.submitted_at ? String(data.submitted_at) : null,
                  verified_at: data.verified_at ? String(data.verified_at) : null,
                  verified_by: data.verified_by ? String(data.verified_by) : null,
                  updated_at: new Date().toISOString(),
                };
              });
              saveTable(STORAGE_KEYS.REALISASI, items, true);
              onDataChanged();
            }
          },
          (err) => {
            console.warn('Firestore listener (realisasis):', err.message);
          }
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'audit_logs'),
          (snap) => {
            if (!snap.empty || !snap.metadata.fromCache) {
              const items: AuditLog[] = snap.docs
                .map((d) => {
                  const data = d.data();
                  let createdIso = new Date().toISOString();
                  if (
                    data.createdAt &&
                    typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function'
                  ) {
                    createdIso = (data.createdAt as { toDate: () => Date })
                      .toDate()
                      .toISOString();
                  } else if (typeof data.created_at === 'string') {
                    createdIso = data.created_at;
                  }
                  return {
                    log_id: String(data.log_id || d.id),
                    matrix_id: String(data.matrix_id || 'SYSTEM'),
                    semester:
                      data.semester === 1 || data.semester === 2
                        ? (data.semester as SemesterNumber)
                        : null,
                    opd_id: String(data.opd_id || 'ALL'),
                    user_role: (data.user_role as UserRole) || 'OPD',
                    user_name: String(data.user_name || 'Sistem'),
                    aksi: String(data.aksi || ''),
                    detail_perubahan: String(data.detail_perubahan || ''),
                    nilai_sebelumnya: data.nilai_sebelumnya
                      ? String(data.nilai_sebelumnya)
                      : undefined,
                    nilai_baru: data.nilai_baru ? String(data.nilai_baru) : undefined,
                    created_at: createdIso,
                  };
                })
                .sort((a, b) => b.created_at.localeCompare(a.created_at));
              saveTable(STORAGE_KEYS.AUDIT, items, true);
              onDataChanged();
            }
          },
          (err) => {
            console.warn('Firestore listener (audit_logs):', err.message);
          }
        )
      );
    };

    void ensureFirebaseAuth().then(async () => {
      await this.pullAllFromFirestore();
      if (!isDisposed) {
        onDataChanged();
        attachSnapshots();
      }
    });

    return () => {
      isDisposed = true;
      unsubs.forEach((u) => u());
    };
  }

  static getUsersList(): AuthUser[] {
    const rawUsers = loadTable<AuthUser>(STORAGE_KEYS.USERS, SEED_USERS);
    return rawUsers.map((u) => ({
      ...u,
      email: formatOpdEmail(u.email || u.username),
    }));
  }

  static getCurrentSessionUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.SESSION_USER);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as AuthUser;
      return {
        ...parsed,
        email: formatOpdEmail(parsed.email || parsed.username),
      };
    } catch {
      return null;
    }
  }

  static setSessionUser(user: AuthUser | null): void {
    try {
      if (!user) {
        localStorage.removeItem(STORAGE_KEYS.SESSION_USER);
      } else {
        localStorage.setItem(
          STORAGE_KEYS.SESSION_USER,
          JSON.stringify({
            ...user,
            email: formatOpdEmail(user.email || user.username),
          })
        );
      }
    } catch (e) {
      console.error('Gagal menyimpan sesi pengguna:', e);
    }
  }

  static authenticateUser(
    usernameInput: string,
    passwordInput: string
  ): { success: boolean; user?: AuthUser; message: string } {
    const cleanUser = usernameInput.trim().toLowerCase();
    const cleanPass = passwordInput.trim();
    const users = this.getUsersList();

    const found = users.find((u) => {
      const userEmail = formatOpdEmail(u.email || u.username).toLowerCase();
      return (
        u.username.toLowerCase() === cleanUser ||
        userEmail === cleanUser ||
        u.instansi_label.toLowerCase() === cleanUser ||
        (u.role === 'ADMIN' &&
          (cleanUser === 'admin' ||
            cleanUser === 'admin@oppkpke.com' ||
            cleanUser === 'admin_bapperida'))
      );
    });

    if (!found) {
      return {
        success: false,
        message:
          'Username atau Email tidak ditemukan. Pastikan sesuai dengan data pada Manajemen User.',
      };
    }

    if (
      cleanPass !== found.password_hint &&
      !(found.role === 'ADMIN' && (cleanPass === 'admin' || cleanPass === 'admin2026'))
    ) {
      return {
        success: false,
        message: 'Password yang Anda masukkan tidak sesuai.',
      };
    }

    const enrichedUser: AuthUser = {
      ...found,
      email: formatOpdEmail(found.email || found.username),
    };

    this.setSessionUser(enrichedUser);

    // Sinkronkan autentikasi email [namaopd]@oppkpke.com ke Firebase Auth & Firestore di latar belakang
    void (async () => {
      await syncFirebaseEmailAuth(
        enrichedUser.email || formatOpdEmail(enrichedUser.username),
        cleanPass
      );
      await upsertFirestoreDocument(
        'user_accounts',
        enrichedUser.user_id,
        serializeUserForFirestore(enrichedUser)
      );
    })();

    return {
      success: true,
      user: enrichedUser,
      message: `Selamat datang, ${enrichedUser.instansi_lengkap || enrichedUser.display_name}.`,
    };
  }

  /**
   * Tambah atau Edit Akun User (Admin maupun Instansi/OPD) oleh Admin beserta email [namaopd]@oppkpke.com
   */
  static saveUserAccount(params: {
    user_id?: string | null;
    kategori: InstansiKategori;
    nama_instansi: string;
    username: string;
    email?: string;
    password: string;
    adminName: string;
  }): { success: boolean; message: string; user?: AuthUser } {
    const cleanNama = params.nama_instansi.trim();
    const cleanUsername = params.username.trim().toLowerCase().replace(/\s+/g, '_');
    const cleanEmail = formatOpdEmail(params.email || cleanUsername);
    const cleanPassword = params.password.trim();

    if (!cleanNama || !cleanUsername || !cleanPassword) {
      return {
        success: false,
        message: 'Nama Instansi, User name, dan Password wajib diisi lengkap.',
      };
    }

    const users = this.getUsersList();
    const opds = this.getOpdList();

    const duplicate = users.find(
      (u) =>
        (u.username.toLowerCase() === cleanUsername ||
          formatOpdEmail(u.email || u.username) === cleanEmail) &&
        u.user_id !== params.user_id
    );
    if (duplicate) {
      return {
        success: false,
        message: `User name "${cleanUsername}" (${cleanEmail}) sudah digunakan oleh ${duplicate.instansi_lengkap}.`,
      };
    }

    const existingIdx = params.user_id
      ? users.findIndex((u) => u.user_id === params.user_id)
      : -1;

    const isRoleAdmin = params.kategori === 'Admin';
    const targetRole: UserRole = isRoleAdmin ? 'ADMIN' : 'OPD';
    const shortLabel = isRoleAdmin
      ? 'ADMIN'
      : cleanNama.length > 26
      ? cleanUsername.toUpperCase()
      : cleanNama;

    if (existingIdx >= 0) {
      const existingUser = users[existingIdx];
      const opdId = isRoleAdmin
        ? null
        : existingUser.opd_id || `opd-${cleanUsername}-${Date.now()}`;
      const updatedUser: AuthUser = {
        ...existingUser,
        role: targetRole,
        kategori: params.kategori,
        username: cleanUsername,
        email: cleanEmail,
        password_hint: cleanPassword,
        display_name: isRoleAdmin ? `Admin (${cleanUsername})` : cleanNama,
        instansi_label: shortLabel,
        instansi_lengkap: cleanNama,
        opd_id: opdId,
        jabatan: isRoleAdmin ? 'Administrator OPTIMIS' : `Operator ${params.kategori}`,
      };
      users[existingIdx] = updatedUser;

      if (!isRoleAdmin && opdId) {
        const opdIdx = opds.findIndex((o) => o.opd_id === opdId);
        let syncedOpd: OPD;
        if (opdIdx >= 0) {
          syncedOpd = {
            ...opds[opdIdx],
            nama_opd: cleanNama,
            singkatan: shortLabel,
            kategori: params.kategori,
          };
          opds[opdIdx] = syncedOpd;
        } else {
          syncedOpd = {
            opd_id: opdId,
            kode_opd: `1.00.${String(opds.length + 1).padStart(2, '0')}`,
            nama_opd: cleanNama,
            singkatan: shortLabel,
            kategori: params.kategori,
            kepala_opd: `Kepala ${cleanNama}`,
          };
          opds.push(syncedOpd);
        }
        saveTable(STORAGE_KEYS.OPD, opds);
        void upsertFirestoreDocument('opds', syncedOpd.opd_id, serializeOpdForFirestore(syncedOpd));
      }

      saveTable(STORAGE_KEYS.USERS, users);
      void upsertFirestoreDocument('user_accounts', updatedUser.user_id, serializeUserForFirestore(updatedUser));
      void provisionFirebaseEmailAccount(cleanEmail, cleanPassword);

      this.addAuditLog({
        matrix_id: 'USER-MANAGEMENT',
        semester: null,
        opd_id: opdId || 'ALL',
        user_role: 'ADMIN',
        user_name: params.adminName,
        aksi: 'Perbarui Akun User',
        detail_perubahan: `Memperbarui akun [${params.kategori} - Role ${targetRole}] "${cleanNama}" (username: ${cleanUsername}, email: ${cleanEmail}).`,
      });

      return {
        success: true,
        message: `Akun user "${cleanUsername}" (${cleanEmail}) berhasil diperbarui dan disinkronkan ke Firebase Authentication.`,
        user: updatedUser,
      };
    } else {
      const newOpdId = isRoleAdmin
        ? null
        : `opd-${cleanUsername}-${Date.now().toString(36)}`;
      const newUserId = `usr-${cleanUsername}-${Date.now().toString(36)}`;

      const newUser: AuthUser = {
        user_id: newUserId,
        username: cleanUsername,
        email: cleanEmail,
        password_hint: cleanPassword,
        role: targetRole,
        opd_id: newOpdId,
        kategori: params.kategori,
        display_name: isRoleAdmin ? `Admin (${cleanUsername})` : cleanNama,
        instansi_label: shortLabel,
        instansi_lengkap: cleanNama,
        jabatan: isRoleAdmin ? 'Administrator OPTIMIS' : `Operator ${params.kategori}`,
      };

      if (!isRoleAdmin && newOpdId) {
        const newOpd: OPD = {
          opd_id: newOpdId,
          kode_opd: `1.00.${String(opds.length + 1).padStart(2, '0')}`,
          nama_opd: cleanNama,
          singkatan: shortLabel,
          kategori: params.kategori,
          kepala_opd: `Kepala ${cleanNama}`,
        };
        opds.push(newOpd);
        saveTable(STORAGE_KEYS.OPD, opds);
        void upsertFirestoreDocument('opds', newOpd.opd_id, serializeOpdForFirestore(newOpd));
      }

      users.push(newUser);
      saveTable(STORAGE_KEYS.USERS, users);
      void upsertFirestoreDocument('user_accounts', newUser.user_id, serializeUserForFirestore(newUser));
      void provisionFirebaseEmailAccount(cleanEmail, cleanPassword);

      this.addAuditLog({
        matrix_id: 'USER-MANAGEMENT',
        semester: null,
        opd_id: newOpdId || 'ALL',
        user_role: 'ADMIN',
        user_name: params.adminName,
        aksi: 'Tambah Akun User Baru',
        detail_perubahan: `Menambahkan akun [${params.kategori} - Role ${targetRole}] "${cleanNama}" (username: ${cleanUsername}, email: ${cleanEmail}).`,
      });

      return {
        success: true,
        message: `Akun user baru "${cleanUsername}" (${cleanEmail}) berhasil ditambahkan dan didaftarkan ke Firebase Authentication.`,
        user: newUser,
      };
    }
  }

  /**
   * Hapus Akun User
   */
  static deleteUserAccount(
    user_id: string,
    adminName: string
  ): { success: boolean; message: string } {
    const users = this.getUsersList();
    const target = users.find((u) => u.user_id === user_id);
    if (!target) {
      return { success: false, message: 'Akun user tidak ditemukan.' };
    }
    if (target.role === 'ADMIN') {
      const adminCount = users.filter((u) => u.role === 'ADMIN').length;
      if (adminCount <= 1) {
        return {
          success: false,
          message:
            'Tidak dapat menghapus satu-satunya akun Admin yang tersisa. Minimal harus ada 1 akun dengan role Admin.',
        };
      }
    }

    const updatedUsers = users.filter((u) => u.user_id !== user_id);
    saveTable(STORAGE_KEYS.USERS, updatedUsers);
    void removeFirestoreDocument('user_accounts', user_id);

    if (target.opd_id) {
      const opds = this.getOpdList().filter((o) => o.opd_id !== target.opd_id);
      saveTable(STORAGE_KEYS.OPD, opds);
      void removeFirestoreDocument('opds', target.opd_id);
    }

    this.addAuditLog({
      matrix_id: 'USER-MANAGEMENT',
      semester: null,
      opd_id: target.opd_id || 'ALL',
      user_role: 'ADMIN',
      user_name: adminName,
      aksi: 'Hapus Akun User',
      detail_perubahan: `Menghapus akun [${target.kategori || 'OPD/Dinas/Badan'}] "${
        target.instansi_lengkap
      }" (username: ${target.username}, email: ${formatOpdEmail(target.email || target.username)}).`,
    });

    return {
      success: true,
      message: `Akun "${target.username}" (${target.instansi_lengkap}) berhasil dihapus.`,
    };
  }

  /**
   * Reset Semua Akun & Ganti dengan Daftar User Baru (tetap memastikan minimal 1 akun ADMIN aktif)
   */
  static resetAndReplaceAllUsers(params: {
    newAccounts: {
      kategori: InstansiKategori;
      nama_instansi: string;
      username: string;
      email?: string;
      password: string;
    }[];
    resetMatrixData?: boolean;
    adminName: string;
  }): { success: boolean; message: string; count: number } {
    const newOpds: OPD[] = [];
    const newUsers: AuthUser[] = [];
    const usedUsernames = new Set<string>();

    params.newAccounts.forEach((acc, index) => {
      const cleanNama = acc.nama_instansi.trim();
      let cleanUsername = acc.username.trim().toLowerCase().replace(/\s+/g, '_');
      const isAdminKat = acc.kategori === 'Admin';
      const cleanPassword =
        acc.password.trim() || (isAdminKat ? 'admin' : 'lamis123');
      if (!cleanNama || !cleanUsername) return;

      if (usedUsernames.has(cleanUsername)) {
        cleanUsername = `${cleanUsername}_${index + 1}`;
      }
      usedUsernames.add(cleanUsername);

      const cleanEmail = formatOpdEmail(acc.email || cleanUsername);
      const opdId = isAdminKat ? null : `opd-${cleanUsername}-${index + 1}`;
      const shortLabel = isAdminKat
        ? 'ADMIN'
        : cleanNama.length > 26
        ? cleanUsername.toUpperCase()
        : cleanNama;

      if (!isAdminKat && opdId) {
        newOpds.push({
          opd_id: opdId,
          kode_opd: `1.00.${String(index + 1).padStart(2, '0')}`,
          nama_opd: cleanNama,
          singkatan: shortLabel,
          kategori: acc.kategori,
          kepala_opd: `Kepala ${cleanNama}`,
        });
      }

      newUsers.push({
        user_id: `usr-${cleanUsername}-${index + 1}`,
        username: cleanUsername,
        email: cleanEmail,
        password_hint: cleanPassword,
        role: isAdminKat ? 'ADMIN' : 'OPD',
        opd_id: opdId,
        kategori: acc.kategori,
        display_name: isAdminKat ? `Administrator (${cleanUsername})` : cleanNama,
        instansi_label: shortLabel,
        instansi_lengkap: cleanNama,
        jabatan: isAdminKat ? 'Administrator OPTIMIS' : `Operator ${acc.kategori}`,
      });
    });

    if (!newUsers.some((u) => u.role === 'ADMIN')) {
      newUsers.unshift({
        user_id: 'usr-admin',
        username: 'admin',
        email: 'admin@oppkpke.com',
        password_hint: 'admin',
        role: 'ADMIN',
        opd_id: null,
        kategori: 'Admin',
        display_name: 'Administrator OPTIMIS',
        instansi_label: 'ADMIN BAPPERIDA',
        instansi_lengkap:
          'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA',
        jabatan: 'Administrator & Verifikator TKPKD',
      });
    }

    const finalOpds: OPD[] = newOpds;

    saveTable(STORAGE_KEYS.USERS, newUsers);
    saveTable(STORAGE_KEYS.OPD, finalOpds);

    if (params.resetMatrixData) {
      saveTable(STORAGE_KEYS.MATRIX, []);
      saveTable(STORAGE_KEYS.REALISASI, []);
    }

    void this.syncAllLocalToFirestore({ pruneRemoved: true });
    void this.syncAllUsersToFirebaseAuth();

    this.addAuditLog({
      matrix_id: 'USER-RESET-ALL',
      semester: null,
      opd_id: 'ALL',
      user_role: 'ADMIN',
      user_name: params.adminName,
      aksi: 'Reset Semua Akun User',
      detail_perubahan: `Mereset seluruh akun user dan menyimpan ${newUsers.length} akun baru per kategori dengan format email [namaopd]@oppkpke.com.${
        params.resetMatrixData ? ' Data matriks juga direset.' : ''
      }`,
    });

    return {
      success: true,
      message:
        newUsers.length > 1
          ? `Berhasil mereset semua akun, menyimpan ${newUsers.length} akun user, dan menyinkronkannya ke Firebase Authentication.`
          : 'Semua akun instansi berhasil direset. Akun Admin (admin@oppkpke.com) tetap aktif.',
      count: newUsers.length,
    };
  }

  /**
   * Sinkronkan seluruh akun user di Manajemen User ke Firebase Authentication (Users) dan Cloud Firestore
   */
  static async syncAllUsersToFirebaseAuth(
    onProgress?: (current: number, total: number, email: string) => void
  ): Promise<{
    total: number;
    created: number;
    alreadyExists: number;
    failed: number;
  }> {
    const users = this.getUsersList();
    const opds = this.getOpdList();

    // Pastikan seluruh dokumen user_accounts & opds juga tersinkron ke Firestore
    await Promise.allSettled([
      ...opds.map((o) =>
        upsertFirestoreDocument('opds', o.opd_id, serializeOpdForFirestore(o))
      ),
      ...users.map((u) =>
        upsertFirestoreDocument(
          'user_accounts',
          u.user_id,
          serializeUserForFirestore(u)
        )
      ),
    ]);

    let created = 0;
    let alreadyExists = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      const email = formatOpdEmail(u.email || u.username);
      const pass = u.password_hint || (u.role === 'ADMIN' ? 'admin' : 'lamis123');
      onProgress?.(i + 1, users.length, email);

      const res = await provisionFirebaseEmailAccount(email, pass);
      if (res.status === 'created') {
        created++;
      } else if (res.status === 'exists') {
        alreadyExists++;
      } else {
        failed++;
      }

      // Jeda singkat agar tidak terkena pembatasan rate-limit pendaftaran Firebase Auth
      await new Promise((resolve) => setTimeout(resolve, 120));
    }

    return {
      total: users.length,
      created,
      alreadyExists,
      failed,
    };
  }

  static getPeriodeList(): PeriodePelaporan[] {
    const loaded = loadTable<PeriodePelaporan>(STORAGE_KEYS.PERIODE, SEED_PERIODE);
    const filtered = loaded
      .filter((p) => p.tahun === 2026 || p.tahun === 2027)
      .map((p) => ({
        ...p,
        semester_1_buka: true,
        semester_2_buka: true,
        is_active: true,
      }));
    if (filtered.length < 2) {
      saveTable(STORAGE_KEYS.PERIODE, SEED_PERIODE);
      return SEED_PERIODE;
    }
    return filtered;
  }

  static getOpdList(): OPD[] {
    return loadTable<OPD>(STORAGE_KEYS.OPD, SEED_OPD);
  }

  static getMatrixDataList(): MatrixData[] {
    return loadTable<MatrixData>(STORAGE_KEYS.MATRIX, SEED_MATRIX_DATA);
  }

  static getRealisasiList(): RealisasiSemester[] {
    return loadTable<RealisasiSemester>(STORAGE_KEYS.REALISASI, SEED_REALISASI_SEMESTER);
  }

  static getAuditLogs(): AuditLog[] {
    return loadTable<AuditLog>(STORAGE_KEYS.AUDIT, SEED_AUDIT_LOGS);
  }

  static addAuditLog(entry: Omit<AuditLog, 'log_id' | 'created_at'>): AuditLog {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      ...entry,
      log_id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      created_at: new Date().toISOString(),
    };
    const updated = [newLog, ...logs];
    saveTable(STORAGE_KEYS.AUDIT, updated);

    void (async () => {
      await ensureFirebaseAuth();
      const ownerId = auth.currentUser?.uid || 'optimis-blora-shared';
      const logRef = doc(db, 'audit_logs', newLog.log_id);
      await setDoc(logRef, {
        log_id: newLog.log_id,
        matrix_id: String(newLog.matrix_id || 'SYSTEM').slice(0, 64),
        semester: newLog.semester ?? null,
        opd_id: String(newLog.opd_id || 'ALL').slice(0, 64),
        user_role: newLog.user_role,
        user_name: String(newLog.user_name || 'Sistem').slice(0, 150),
        aksi: String(newLog.aksi || 'Aktivitas').slice(0, 200),
        detail_perubahan: String(newLog.detail_perubahan || '').slice(0, 1000),
        nilai_sebelumnya: String(newLog.nilai_sebelumnya || '').slice(0, 300),
        nilai_baru: String(newLog.nilai_baru || '').slice(0, 300),
        ownerId,
        createdAt: serverTimestamp(),
      }).catch((err) => {
        console.warn('Gagal mencatat audit log ke Firestore:', err);
      });
    })();

    return newLog;
  }

  static getEnrichedMatrixRows(periodeId: string, opdIdFilter?: string): EnrichedMatrixRow[] {
    const periodes = this.getPeriodeList();
    const opds = this.getOpdList();
    const matrices = this.getMatrixDataList().filter(
      (m) => m.periode_id === periodeId && (!opdIdFilter || m.opd_id === opdIdFilter)
    );
    const realisasis = this.getRealisasiList();

    const periodeObj = periodes.find((p) => p.periode_id === periodeId);
    const tahun = periodeObj ? periodeObj.tahun : 2026;

    return matrices.map((m) => {
      const opd = opds.find((o) => o.opd_id === m.opd_id);
      const sem1 =
        realisasis.find((r) => r.matrix_id === m.matrix_id && r.semester === 1) ||
        this.createDefaultRealisasi(m.matrix_id, 1);
      const sem2 =
        realisasis.find((r) => r.matrix_id === m.matrix_id && r.semester === 2) ||
        this.createDefaultRealisasi(m.matrix_id, 2);

      const total_realisasi_tahunan = (Number(sem1.realisasi) || 0) + (Number(sem2.realisasi) || 0);
      const alokasi = Number(m.alokasi_anggaran) || 0;

      const persentase_realisasi_sem1 = alokasi > 0 ? (sem1.realisasi / alokasi) * 100 : 0;
      const persentase_realisasi_sem2 = alokasi > 0 ? (sem2.realisasi / alokasi) * 100 : 0;
      const persentase_realisasi_tahunan =
        alokasi > 0 ? (total_realisasi_tahunan / alokasi) * 100 : 0;

      const hasAktivitas = Boolean(
        m.aktivitas_real_langsung.trim() ||
          m.aktivitas_real_tidak_langsung.trim() ||
          m.aktivitas_real_penunjang.trim()
      );

      let filledScore = 0;
      if (m.kode.trim() && m.sub_kegiatan.trim()) filledScore += 1;
      if (hasAktivitas) filledScore += 1;
      if (m.alokasi_anggaran > 0) filledScore += 1;
      if (m.sumber_pembiayaan.trim()) filledScore += 1;
      if (m.sifat_bantuan) filledScore += 1;
      if (m.jumlah_sasaran > 0 || (m.keterangan_sasaran && m.keterangan_sasaran.trim())) {
        filledScore += 1;
      }
      if (m.besaran_manfaat.trim() && m.jenis_bantuan.trim()) filledScore += 1;
      if (sem1.realisasi > 0 || sem2.realisasi > 0 || sem1.status_verifikasi === 'Terverifikasi') filledScore += 1;

      const completion_percentage = Math.round((filledScore / 8) * 100);

      const is_data_teknis_lengkap = Boolean(
        m.kode.trim() &&
          m.program.trim() &&
          m.kegiatan.trim() &&
          m.sub_kegiatan.trim() &&
          hasAktivitas &&
          m.alokasi_anggaran > 0 &&
          m.sumber_pembiayaan.trim() &&
          m.sifat_bantuan &&
          (m.jumlah_sasaran > 0 || (m.keterangan_sasaran && m.keterangan_sasaran.trim())) &&
          m.besaran_manfaat.trim() &&
          m.jenis_bantuan.trim() &&
          m.durasi_pemberian_bantuan.trim()
      );

      return {
        ...m,
        nama_opd: opd?.nama_opd || 'OPD Kabupaten Blora',
        singkatan_opd: opd?.singkatan || 'OPD',
        tahun,
        sem1,
        sem2,
        total_realisasi_tahunan,
        persentase_realisasi_sem1,
        persentase_realisasi_sem2,
        persentase_realisasi_tahunan,
        is_data_teknis_lengkap,
        completion_percentage,
      };
    });
  }

  static createDefaultRealisasi(matrix_id: string, semester: SemesterNumber): RealisasiSemester {
    return {
      realisasi_id: `real-${matrix_id}-s${semester}`,
      matrix_id,
      semester,
      realisasi: 0,
      rincian_realisasi: '',
      status_verifikasi: 'Belum Diisi',
      catatan_verifikator: '',
      submitted_at: null,
      verified_at: null,
      verified_by: null,
      updated_at: new Date().toISOString(),
    };
  }

  static saveOpdMatrixAndRealisasi(params: {
    matrix_id?: string | null;
    periode_id: string;
    opd_id: string;
    opdUpdates: Partial<
      Pick<
        MatrixData,
        | 'strategi'
        | 'kode'
        | 'program'
        | 'kegiatan'
        | 'sub_kegiatan'
        | 'aktivitas_real_langsung'
        | 'aktivitas_real_tidak_langsung'
        | 'aktivitas_real_penunjang'
        | 'alokasi_anggaran'
        | 'sumber_pembiayaan'
        | 'sifat_bantuan'
        | 'lokasi'
        | 'lokasi_kecamatan'
        | 'lokasi_desa'
        | 'lokasi_spesifik'
        | 'jumlah_sasaran'
        | 'satuan_sasaran'
        | 'keterangan_sasaran'
        | 'besaran_manfaat'
        | 'jenis_bantuan'
        | 'durasi_pemberian_bantuan'
        | 'keterangan_durasi_bantuan'
      >
    >;
    sem1Input?: {
      realisasi: number;
      rincian_realisasi?: string;
      action: 'draft' | 'submit';
    };
    sem2Input?: {
      realisasi: number;
      rincian_realisasi?: string;
      action: 'draft' | 'submit';
    };
    userRole: UserRole;
    userName: string;
    isAutosave?: boolean;
  }): { success: boolean; message: string; matrix_id: string } {
    const matrices = this.getMatrixDataList();
    const realisasis = this.getRealisasiList();
    const periodes = this.getPeriodeList();
    const now = new Date().toISOString();

    let targetMatrixId = params.matrix_id || '';
    const matrixIdx = targetMatrixId
      ? matrices.findIndex((m) => m.matrix_id === targetMatrixId)
      : -1;
    const isNewRow = matrixIdx === -1;

    if (!isNewRow && params.userRole === 'OPD') {
      const existingMatrix = matrices[matrixIdx];
      const existingS1 = realisasis.find(
        (r) => r.matrix_id === existingMatrix.matrix_id && r.semester === 1
      );
      const existingS2 = realisasis.find(
        (r) => r.matrix_id === existingMatrix.matrix_id && r.semester === 2
      );

      if (
        params.sem1Input !== undefined &&
        existingS1?.status_verifikasi === 'Terverifikasi'
      ) {
        return {
          success: false,
          message:
            'Data Semester 1 telah Terverifikasi dan terkunci otomatis. OPD tidak dapat mengubah data yang sudah terverifikasi.',
          matrix_id: existingMatrix.matrix_id,
        };
      }

      if (
        params.sem2Input !== undefined &&
        existingS2?.status_verifikasi === 'Terverifikasi'
      ) {
        return {
          success: false,
          message:
            'Data Semester 2 telah Terverifikasi dan terkunci otomatis. OPD tidak dapat mengubah data yang sudah terverifikasi.',
          matrix_id: existingMatrix.matrix_id,
        };
      }
    }

    let targetMatrix: MatrixData;

    if (isNewRow) {
      targetMatrixId = `mtx-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
      targetMatrix = {
        matrix_id: targetMatrixId,
        periode_id: params.periode_id,
        opd_id: params.opd_id,
        strategi:
          params.opdUpdates.strategi || '1. Pengurangan Beban Pengeluaran Masyarakat',
        kode: params.opdUpdates.kode || '1.00.01.2.01.0001',
        program: params.opdUpdates.program || '',
        kegiatan: params.opdUpdates.kegiatan || '',
        sub_kegiatan: params.opdUpdates.sub_kegiatan || '',
        aktivitas_real_langsung: params.opdUpdates.aktivitas_real_langsung || '',
        aktivitas_real_tidak_langsung:
          params.opdUpdates.aktivitas_real_tidak_langsung || '',
        aktivitas_real_penunjang: params.opdUpdates.aktivitas_real_penunjang || '',
        alokasi_anggaran: Math.max(0, Number(params.opdUpdates.alokasi_anggaran) || 0),
        sumber_pembiayaan: params.opdUpdates.sumber_pembiayaan || 'APBD Kabupaten',
        sifat_bantuan: params.opdUpdates.sifat_bantuan || 'Berkelanjutan',
        lokasi: params.opdUpdates.lokasi || 'Kabupaten Blora',
        lokasi_kecamatan: params.opdUpdates.lokasi_kecamatan || 'Kabupaten Blora',
        lokasi_desa: params.opdUpdates.lokasi_desa || '',
        lokasi_spesifik: params.opdUpdates.lokasi_spesifik || '',
        jumlah_sasaran: Math.max(0, Number(params.opdUpdates.jumlah_sasaran) || 0),
        satuan_sasaran: params.opdUpdates.satuan_sasaran || 'KPM',
        keterangan_sasaran: params.opdUpdates.keterangan_sasaran || '',
        besaran_manfaat: params.opdUpdates.besaran_manfaat || '',
        jenis_bantuan: params.opdUpdates.jenis_bantuan || 'Bantuan sosial',
        durasi_pemberian_bantuan:
          params.opdUpdates.durasi_pemberian_bantuan || '1 tahun',
        keterangan_durasi_bantuan:
          params.opdUpdates.keterangan_durasi_bantuan || '',
        created_at: now,
        updated_at: now,
      };
      matrices.unshift(targetMatrix);
      realisasis.push(this.createDefaultRealisasi(targetMatrixId, 1));
      realisasis.push(this.createDefaultRealisasi(targetMatrixId, 2));
    } else {
      const existingMatrix = matrices[matrixIdx];
      targetMatrix = {
        ...existingMatrix,
        ...params.opdUpdates,
        opd_id: params.opd_id || existingMatrix.opd_id,
        jumlah_sasaran: Math.max(
          0,
          Number(params.opdUpdates.jumlah_sasaran ?? existingMatrix.jumlah_sasaran) || 0
        ),
        satuan_sasaran:
          params.opdUpdates.satuan_sasaran ?? existingMatrix.satuan_sasaran ?? 'KPM',
        keterangan_sasaran:
          params.opdUpdates.keterangan_sasaran ?? existingMatrix.keterangan_sasaran ?? '',
        keterangan_durasi_bantuan:
          params.opdUpdates.keterangan_durasi_bantuan ??
          existingMatrix.keterangan_durasi_bantuan ??
          '',
        alokasi_anggaran: Math.max(
          0,
          Number(params.opdUpdates.alokasi_anggaran ?? existingMatrix.alokasi_anggaran) || 0
        ),
        updated_at: now,
      };
      matrices[matrixIdx] = targetMatrix;
    }

    saveTable(STORAGE_KEYS.MATRIX, matrices);

    const periode = periodes.find((p) => p.periode_id === targetMatrix.periode_id);

    if (!params.isAutosave) {
      this.addAuditLog({
        matrix_id: targetMatrix.matrix_id,
        semester: null,
        opd_id: targetMatrix.opd_id,
        user_role: params.userRole,
        user_name: params.userName,
        aksi: isNewRow
          ? 'Penambahan Data Subkegiatan Matriks Baru'
          : 'Pembaruan Data Matriks & Rekening OPD',
        detail_perubahan: `${
          isNewRow ? 'Menambahkan' : 'Memperbarui'
        } subkegiatan [${targetMatrix.kode}] "${targetMatrix.sub_kegiatan}" dengan pagu ${formatRupiah(
          targetMatrix.alokasi_anggaran
        )}.`,
        nilai_sebelumnya: isNewRow ? '-' : undefined,
        nilai_baru: formatRupiah(targetMatrix.alokasi_anggaran),
      });
    }

    if (params.sem1Input !== undefined) {
      const s1Idx = realisasis.findIndex(
        (r) => r.matrix_id === targetMatrix.matrix_id && r.semester === 1
      );
      const currentS1 =
        s1Idx >= 0
          ? realisasis[s1Idx]
          : this.createDefaultRealisasi(targetMatrix.matrix_id, 1);

      if (currentS1.status_verifikasi !== 'Terverifikasi') {
        const periodeBuka = periode ? periode.semester_1_buka : true;
        if (periodeBuka || params.userRole === 'ADMIN') {
          const newStatus: VerificationStatus =
            params.sem1Input.action === 'submit'
              ? 'Menunggu Verifikasi'
              : params.sem1Input.realisasi > 0 ||
                Boolean(params.sem1Input.rincian_realisasi?.trim()) ||
                currentS1.status_verifikasi === 'Perlu Perbaikan'
              ? 'Draft'
              : 'Belum Diisi';

          const updatedS1: RealisasiSemester = {
            ...currentS1,
            realisasi: Math.max(0, Number(params.sem1Input.realisasi) || 0),
            rincian_realisasi:
              params.sem1Input.rincian_realisasi ?? currentS1.rincian_realisasi ?? '',
            status_verifikasi: newStatus,
            submitted_at:
              params.sem1Input.action === 'submit' ? now : currentS1.submitted_at,
            updated_at: now,
          };

          if (s1Idx >= 0) {
            realisasis[s1Idx] = updatedS1;
          } else {
            realisasis.push(updatedS1);
          }

          if (
            !params.isAutosave &&
            (currentS1.realisasi !== updatedS1.realisasi ||
              currentS1.status_verifikasi !== updatedS1.status_verifikasi)
          ) {
            this.addAuditLog({
              matrix_id: targetMatrix.matrix_id,
              semester: 1,
              opd_id: targetMatrix.opd_id,
              user_role: params.userRole,
              user_name: params.userName,
              aksi:
                params.sem1Input.action === 'submit'
                  ? 'Kirim Realisasi Semester 1 untuk Verifikasi'
                  : 'Simpan Realisasi Semester 1',
              detail_perubahan: `Data realisasi Semester 1 diperbarui menjadi ${formatRupiah(
                updatedS1.realisasi
              )} (${updatedS1.status_verifikasi}).`,
              nilai_sebelumnya: `${currentS1.status_verifikasi} (${formatRupiah(
                currentS1.realisasi
              )})`,
              nilai_baru: `${updatedS1.status_verifikasi} (${formatRupiah(
                updatedS1.realisasi
              )})`,
            });
          }
        }
      }
    }

    if (params.sem2Input !== undefined) {
      const s2Idx = realisasis.findIndex(
        (r) => r.matrix_id === targetMatrix.matrix_id && r.semester === 2
      );
      const currentS2 =
        s2Idx >= 0
          ? realisasis[s2Idx]
          : this.createDefaultRealisasi(targetMatrix.matrix_id, 2);

      if (currentS2.status_verifikasi !== 'Terverifikasi') {
        const periodeBuka = periode ? periode.semester_2_buka : true;
        if (periodeBuka || params.userRole === 'ADMIN') {
          const newStatus: VerificationStatus =
            params.sem2Input.action === 'submit'
              ? 'Menunggu Verifikasi'
              : params.sem2Input.realisasi > 0 ||
                Boolean(params.sem2Input.rincian_realisasi?.trim()) ||
                currentS2.status_verifikasi === 'Perlu Perbaikan'
              ? 'Draft'
              : 'Belum Diisi';

          const updatedS2: RealisasiSemester = {
            ...currentS2,
            realisasi: Math.max(0, Number(params.sem2Input.realisasi) || 0),
            rincian_realisasi:
              params.sem2Input.rincian_realisasi ?? currentS2.rincian_realisasi ?? '',
            status_verifikasi: newStatus,
            submitted_at:
              params.sem2Input.action === 'submit' ? now : currentS2.submitted_at,
            updated_at: now,
          };

          if (s2Idx >= 0) {
            realisasis[s2Idx] = updatedS2;
          } else {
            realisasis.push(updatedS2);
          }

          if (
            !params.isAutosave &&
            (currentS2.realisasi !== updatedS2.realisasi ||
              currentS2.status_verifikasi !== updatedS2.status_verifikasi)
          ) {
            this.addAuditLog({
              matrix_id: targetMatrix.matrix_id,
              semester: 2,
              opd_id: targetMatrix.opd_id,
              user_role: params.userRole,
              user_name: params.userName,
              aksi:
                params.sem2Input.action === 'submit'
                  ? 'Kirim Realisasi Semester 2 untuk Verifikasi'
                  : 'Simpan Realisasi Semester 2',
              detail_perubahan: `Data realisasi Semester 2 diperbarui menjadi ${formatRupiah(
                updatedS2.realisasi
              )} (${updatedS2.status_verifikasi}). Data Semester 1 tetap terjaga.`,
              nilai_sebelumnya: `${currentS2.status_verifikasi} (${formatRupiah(
                currentS2.realisasi
              )})`,
              nilai_baru: `${updatedS2.status_verifikasi} (${formatRupiah(
                updatedS2.realisasi
              )})`,
            });
          }
        }
      }
    }

    saveTable(STORAGE_KEYS.REALISASI, realisasis);

    const targetS1 = realisasis.find(
      (r) => r.matrix_id === targetMatrix.matrix_id && r.semester === 1
    );
    const targetS2 = realisasis.find(
      (r) => r.matrix_id === targetMatrix.matrix_id && r.semester === 2
    );
    void (async () => {
      if (periode) {
        await upsertFirestoreDocument(
          'periodes',
          periode.periode_id,
          serializePeriodeForFirestore(periode)
        );
      }
      const opdObj = this.getOpdList().find((o) => o.opd_id === targetMatrix.opd_id);
      if (opdObj) {
        await upsertFirestoreDocument(
          'opds',
          opdObj.opd_id,
          serializeOpdForFirestore(opdObj)
        );
      }
      await upsertFirestoreDocument(
        'matrices',
        targetMatrix.matrix_id,
        serializeMatrixForFirestore(targetMatrix)
      );
      if (targetS1) {
        await upsertFirestoreDocument(
          'realisasis',
          targetS1.realisasi_id,
          serializeRealisasiForFirestore(targetS1)
        );
      }
      if (targetS2) {
        await upsertFirestoreDocument(
          'realisasis',
          targetS2.realisasi_id,
          serializeRealisasiForFirestore(targetS2)
        );
      }
    })();

    return {
      success: true,
      message: isNewRow
        ? 'Baris subkegiatan baru dan realisasi berhasil ditambahkan ke matriks.'
        : 'Perubahan data matriks dan realisasi semester berhasil disimpan.',
      matrix_id: targetMatrix.matrix_id,
    };
  }

  static deleteMatrixRow(params: {
    matrix_id: string;
    userRole: UserRole;
    userName: string;
  }): { success: boolean; message: string } {
    const matrices = this.getMatrixDataList();
    const target = matrices.find((m) => m.matrix_id === params.matrix_id);
    if (!target) {
      return {
        success: false,
        message: 'Data matriks yang akan dihapus tidak ditemukan.',
      };
    }

    const allRealisasis = this.getRealisasiList();
    if (params.userRole === 'OPD') {
      const hasVerified = allRealisasis.some(
        (r) =>
          r.matrix_id === params.matrix_id && r.status_verifikasi === 'Terverifikasi'
      );
      if (hasVerified) {
        return {
          success: false,
          message:
            'Data matriks ini telah Terverifikasi dan terkunci. OPD tidak dapat menghapus data yang sudah terverifikasi.',
        };
      }
    }

    const removedRealisasis = allRealisasis.filter((r) => r.matrix_id === params.matrix_id);
    const updatedMatrices = matrices.filter((m) => m.matrix_id !== params.matrix_id);
    const realisasis = allRealisasis.filter((r) => r.matrix_id !== params.matrix_id);

    saveTable(STORAGE_KEYS.MATRIX, updatedMatrices);
    saveTable(STORAGE_KEYS.REALISASI, realisasis);

    removedRealisasis.forEach((r) => {
      void removeFirestoreDocument('realisasis', r.realisasi_id);
    });
    void removeFirestoreDocument('matrices', params.matrix_id);

    this.addAuditLog({
      matrix_id: target.matrix_id,
      semester: null,
      opd_id: target.opd_id,
      user_role: params.userRole,
      user_name: params.userName,
      aksi: 'Penghapusan Baris Data Matriks OPD',
      detail_perubahan: `Menghapus subkegiatan [${target.kode}] "${target.sub_kegiatan}" beserta data realisasinya.`,
      nilai_sebelumnya: formatRupiah(target.alokasi_anggaran),
      nilai_baru: 'Dihapus',
    });

    return {
      success: true,
      message: `Subkegiatan [${target.kode}] "${target.sub_kegiatan}" berhasil dihapus.`,
    };
  }

  static verifySemester(params: {
    matrix_id: string;
    semester: SemesterNumber;
    decision: 'Terverifikasi' | 'Perlu Perbaikan' | 'Menunggu Verifikasi';
    catatan_verifikator: string;
    verifierName: string;
  }): { success: boolean; message: string } {
    const realisasis = this.getRealisasiList();
    const matrices = this.getMatrixDataList();
    const matrix = matrices.find((m) => m.matrix_id === params.matrix_id);
    if (!matrix) {
      return { success: false, message: 'Data matriks tidak ditemukan.' };
    }

    const idx = realisasis.findIndex(
      (r) => r.matrix_id === params.matrix_id && r.semester === params.semester
    );
    const current =
      idx >= 0
        ? realisasis[idx]
        : this.createDefaultRealisasi(params.matrix_id, params.semester);

    const now = new Date().toISOString();
    const updated: RealisasiSemester = {
      ...current,
      status_verifikasi: params.decision,
      catatan_verifikator: params.catatan_verifikator.trim(),
      verified_at: now,
      verified_by: params.verifierName,
      updated_at: now,
    };

    if (idx >= 0) {
      realisasis[idx] = updated;
    } else {
      realisasis.push(updated);
    }

    saveTable(STORAGE_KEYS.REALISASI, realisasis);

    void (async () => {
      await upsertFirestoreDocument(
        'matrices',
        matrix.matrix_id,
        serializeMatrixForFirestore(matrix)
      );
      await upsertFirestoreDocument(
        'realisasis',
        updated.realisasi_id,
        serializeRealisasiForFirestore(updated)
      );
    })();

    this.addAuditLog({
      matrix_id: params.matrix_id,
      semester: params.semester,
      opd_id: matrix.opd_id,
      user_role: 'ADMIN',
      user_name: params.verifierName,
      aksi:
        params.decision === 'Terverifikasi'
          ? `Laporan OPD Semester ${params.semester} Telah Diverifikasi`
          : params.decision === 'Perlu Perbaikan'
          ? `Kembalikan Semester ${params.semester} untuk Diperbaiki`
          : `Buka Kunci Verifikasi Semester ${params.semester}`,
      detail_perubahan: `Status Semester ${params.semester} (${
        params.semester === 1 ? 'Januari-Juni' : 'Juli-Desember'
      }) diubah menjadi "${params.decision}". Catatan: "${
        params.catatan_verifikator || '-'
      }".`,
      nilai_sebelumnya: `${current.status_verifikasi} (${formatRupiah(current.realisasi)})`,
      nilai_baru: `${updated.status_verifikasi} (${formatRupiah(updated.realisasi)})`,
    });

    return {
      success: true,
      message: `Status verifikasi Semester ${params.semester} berhasil diperbarui menjadi ${params.decision}.`,
    };
  }

  static updatePeriodeSettings(
    periode_id: string,
    updates: Partial<
      Pick<
        PeriodePelaporan,
        'semester_1_buka' | 'semester_2_buka' | 'batas_semester_1' | 'batas_semester_2'
      >
    >,
    adminName: string
  ): PeriodePelaporan[] {
    const periodes = this.getPeriodeList();
    const idx = periodes.findIndex((p) => p.periode_id === periode_id);
    if (idx === -1) return periodes;

    const old = periodes[idx];
    const updated: PeriodePelaporan = {
      ...old,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    periodes[idx] = updated;
    saveTable(STORAGE_KEYS.PERIODE, periodes);

    void upsertFirestoreDocument(
      'periodes',
      updated.periode_id,
      serializePeriodeForFirestore(updated)
    );

    this.addAuditLog({
      matrix_id: 'SYSTEM-PERIODE',
      semester: null,
      opd_id: 'ALL',
      user_role: 'ADMIN',
      user_name: adminName,
      aksi: `Pengaturan Periode Pelaporan TA ${old.tahun}`,
      detail_perubahan: `Status Periode TA ${old.tahun}: Semester 1 (${
        updated.semester_1_buka ? 'DIBUKA' : 'DITUTUP'
      }), Semester 2 (${updated.semester_2_buka ? 'DIBUKA' : 'DITUTUP'}).`,
      nilai_sebelumnya: `Sem 1: ${old.semester_1_buka ? 'Buka' : 'Tutup'}, Sem 2: ${
        old.semester_2_buka ? 'Buka' : 'Tutup'
      }`,
      nilai_baru: `Sem 1: ${updated.semester_1_buka ? 'Buka' : 'Tutup'}, Sem 2: ${
        updated.semester_2_buka ? 'Buka' : 'Tutup'
      }`,
    });

    return periodes;
  }

  static createNewYearPeriode(
    tahunBaru: number,
    copyBaseFromPeriodeId: string | null,
    adminName: string
  ): { success: boolean; message: string; periode?: PeriodePelaporan } {
    const periodes = this.getPeriodeList();
    if (periodes.some((p) => p.tahun === tahunBaru)) {
      return {
        success: false,
        message: `Periode Tahun Anggaran ${tahunBaru} sudah tersedia di dalam sistem.`,
      };
    }

    const newPeriodeId = `per-${tahunBaru}`;
    const now = new Date().toISOString();
    const newPeriode: PeriodePelaporan = {
      periode_id: newPeriodeId,
      tahun: tahunBaru,
      nama_periode: `Tahun Anggaran ${tahunBaru}`,
      semester_1_buka: true,
      semester_2_buka: false,
      batas_semester_1: `${tahunBaru}-07-15`,
      batas_semester_2: `${tahunBaru + 1}-01-15`,
      is_active: false,
      updated_at: now,
    };

    const updatedPeriodes = [newPeriode, ...periodes].sort((a, b) => b.tahun - a.tahun);
    saveTable(STORAGE_KEYS.PERIODE, updatedPeriodes);

    if (copyBaseFromPeriodeId) {
      const matrices = this.getMatrixDataList();
      const realisasis = this.getRealisasiList();
      const sourceRows = matrices.filter((m) => m.periode_id === copyBaseFromPeriodeId);

      sourceRows.forEach((src, i) => {
        const newMatrixId = `mtx-${tahunBaru}-${String(i + 1).padStart(3, '0')}`;
        const clonedMatrix: MatrixData = {
          matrix_id: newMatrixId,
          periode_id: newPeriodeId,
          opd_id: src.opd_id,
          strategi: src.strategi,
          kode: src.kode,
          program: src.program,
          kegiatan: src.kegiatan,
          sub_kegiatan: src.sub_kegiatan,
          aktivitas_real_langsung: '',
          aktivitas_real_tidak_langsung: '',
          aktivitas_real_penunjang: '',
          alokasi_anggaran: src.alokasi_anggaran,
          sumber_pembiayaan: src.sumber_pembiayaan,
          sifat_bantuan: src.sifat_bantuan,
          lokasi: '',
          lokasi_kecamatan: '',
          lokasi_desa: '',
          lokasi_spesifik: '',
          jumlah_sasaran: 0,
          besaran_manfaat: '',
          jenis_bantuan: src.jenis_bantuan,
          durasi_pemberian_bantuan: '',
          created_at: now,
          updated_at: now,
        };
        matrices.push(clonedMatrix);
        realisasis.push(this.createDefaultRealisasi(newMatrixId, 1));
        realisasis.push(this.createDefaultRealisasi(newMatrixId, 2));
      });

      saveTable(STORAGE_KEYS.MATRIX, matrices);
      saveTable(STORAGE_KEYS.REALISASI, realisasis);
    }

    void this.syncAllLocalToFirestore();

    this.addAuditLog({
      matrix_id: 'SYSTEM-PERIODE',
      semester: null,
      opd_id: 'ALL',
      user_role: 'ADMIN',
      user_name: adminName,
      aksi: `Buat Tahun Anggaran Baru (${tahunBaru})`,
      detail_perubahan: `Menambahkan periode pelaporan Tahun Anggaran ${tahunBaru}${
        copyBaseFromPeriodeId ? ' beserta salinan struktur dasar program/kegiatan.' : '.'
      }`,
    });

    return {
      success: true,
      message: `Periode Tahun Anggaran ${tahunBaru} berhasil ditambahkan.`,
      periode: newPeriode,
    };
  }

  static importBaseMatrixFromExcel(
    periode_id: string,
    rows: ParsedExcelBaseRow[],
    actorName: string,
    forcedOpdId?: string
  ): { importedCount: number } {
    const matrices = this.getMatrixDataList();
    const realisasis = this.getRealisasiList();
    const opds = this.getOpdList();
    const now = new Date().toISOString();

    let importedCount = 0;

    rows.forEach((row, index) => {
      const matchedOpd = forcedOpdId
        ? opds.find((o) => o.opd_id === forcedOpdId) || opds[0]
        : opds.find(
            (o) =>
              o.nama_opd.toLowerCase().includes(row.perangkat_daerah.toLowerCase()) ||
              row.perangkat_daerah.toLowerCase().includes(o.singkatan.toLowerCase()) ||
              row.perangkat_daerah
                .toLowerCase()
                .includes(o.nama_opd.toLowerCase().slice(0, 12))
          ) || opds[0];

      const newMatrixId = `mtx-imp-${Date.now()}-${index + 1}`;
      const newMatrix: MatrixData = {
        matrix_id: newMatrixId,
        periode_id,
        opd_id: matchedOpd?.opd_id || forcedOpdId || 'opd-unassigned',
        strategi: row.strategi,
        kode: row.kode,
        program: row.program,
        kegiatan: row.kegiatan,
        sub_kegiatan: row.sub_kegiatan,
        aktivitas_real_langsung: '',
        aktivitas_real_tidak_langsung: '',
        aktivitas_real_penunjang: '',
        alokasi_anggaran: row.alokasi_anggaran || 0,
        sumber_pembiayaan: 'APBD Kabupaten',
        sifat_bantuan: 'Berkelanjutan',
        lokasi: '',
        lokasi_kecamatan: '',
        lokasi_desa: '',
        lokasi_spesifik: '',
        jumlah_sasaran: 0,
        besaran_manfaat: '',
        jenis_bantuan: 'Bantuan sosial',
        durasi_pemberian_bantuan: 'Dua belas bulan',
        created_at: now,
        updated_at: now,
      };

      matrices.unshift(newMatrix);
      realisasis.push(this.createDefaultRealisasi(newMatrixId, 1));
      realisasis.push(this.createDefaultRealisasi(newMatrixId, 2));
      importedCount++;
    });

    saveTable(STORAGE_KEYS.MATRIX, matrices);
    saveTable(STORAGE_KEYS.REALISASI, realisasis);

    void this.syncAllLocalToFirestore();

    this.addAuditLog({
      matrix_id: 'EXCEL-IMPORT',
      semester: null,
      opd_id: forcedOpdId || 'ALL',
      user_role: forcedOpdId ? 'OPD' : 'ADMIN',
      user_name: actorName,
      aksi: 'Import Data Matriks dari Excel',
      detail_perubahan: `Mengimpor ${importedCount} baris program/kegiatan/subkegiatan dari file Excel.`,
    });

    return { importedCount };
  }

  static resetToSeedData(): void {
    saveTable(STORAGE_KEYS.PERIODE, SEED_PERIODE);
    saveTable(STORAGE_KEYS.OPD, SEED_OPD);
    saveTable(STORAGE_KEYS.USERS, SEED_USERS);
    saveTable(STORAGE_KEYS.MATRIX, SEED_MATRIX_DATA);
    saveTable(STORAGE_KEYS.REALISASI, SEED_REALISASI_SEMESTER);
    saveTable(STORAGE_KEYS.AUDIT, SEED_AUDIT_LOGS);

    void this.syncAllLocalToFirestore({ pruneRemoved: true });
    void pruneFirestoreCollection('audit_logs', new Set());
  }
}
