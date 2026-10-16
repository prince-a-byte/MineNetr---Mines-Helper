import { mockRepo } from '../../repositories/mockStore';
import type { DocRecord } from '../../types/models';
import { ALLOWED_EXT, MAX_UPLOAD_MB } from '../../constants/roles';
import { ApiError } from '../ApiError';
import type { DocumentService } from '../interfaces';
import { latency, paginate } from './util';

export function validateFile(name: string, size?: number): void {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!(ALLOWED_EXT as readonly string[]).includes(ext)) {
    throw new ApiError(`Unsupported format. Use ${ALLOWED_EXT.join(', ').toUpperCase()} files.`, { status: 422 });
  }
  if (size != null && size > MAX_UPLOAD_MB * 1024 * 1024) {
    throw new ApiError(`File exceeds ${MAX_UPLOAD_MB} MB.`, { status: 422 });
  }
}

let counter = 100;
export const mockDocuments: DocumentService = {
  async listDocuments(f, page = 1, pageSize = 8) {
    await latency();
    await mockRepo.ready();
    const q = (f.q ?? '').toLowerCase();
    const all = mockRepo.data.documents
      .filter((d) => {
        if (f.scope && f.scope !== 'all' && d.scope !== f.scope) return false;
        if (f.mineId && d.mineId !== f.mineId) return false;
        if (f.type && d.type !== f.type) return false;
        if (f.status && d.status !== f.status) return false;
        if (q) {
          const w = d.workerId
            ? mockRepo.data.workers.find((x) => x.id === d.workerId)
            : undefined;
          const hay = `${d.type} ${d.id} ${w?.name ?? ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    return paginate(all, page, pageSize);
  },

  async getDocumentById(id) {
    await latency();
    await mockRepo.ready();
    const d = mockRepo.data.documents.find((x) => x.id === id);
    if (!d) throw new ApiError('Document not found.', { status: 404 });
    return d;
  },

  async createDocumentMetadata(input) {
    await latency(450);
    await mockRepo.ready();
    if (input.fileName) validateFile(input.fileName, input.fileSize);
    const rec: DocRecord = {
      id: `DOC-${String(counter++).padStart(3, '0')}`,
      scope: input.workerId ? 'worker' : 'company',
      type: input.type,
      workerId: input.workerId,
      mineId: input.mineId,
      issueDate: input.issueDate,
      expiryDate: input.expiryDate,
      docNumber: input.docNumber,
      // Selecting a file never verifies it: new uploads always start Pending.
      status: 'Pending',
      fileName: input.fileName,
      fileSize: input.fileSize,
      remarks: input.remarks,
      updatedAt: new Date().toISOString(),
    };
    await mockRepo.mutate((s) => {
      s.documents.unshift(rec);
      s.activities.unshift(
        mockRepo.pushActivity({ kind: 'document', text: `${rec.type} submitted for verification`, refId: rec.id }),
      );
    });
    return rec;
  },

  async uploadDocument(fileUri, metadata) {
    // Mock mode: no bytes leave the device. We store metadata + simulated state only.
    await latency(900);
    void fileUri;
    return this.createDocumentMetadata({ ...metadata, fileName: metadata.docNumber ?? 'upload' });
  },

  async requestVerification(id) {
    await latency(300);
    await mockRepo.ready();
    let out: DocRecord | undefined;
    await mockRepo.mutate((s) => {
      const d = s.documents.find((x) => x.id === id);
      if (d && d.status !== 'Verified') {
        d.status = 'Pending';
        d.updatedAt = new Date().toISOString();
        out = { ...d };
      } else if (d) {
        out = { ...d };
      }
    });
    if (!out) throw new ApiError('Document not found.', { status: 404 });
    return out;
  },
};
