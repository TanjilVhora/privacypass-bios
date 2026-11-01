import { Router } from 'express';
import { CFG, readJson, writeJson } from '../keys';
import { signStatusList } from '../../src/crypto/statuslist';
import { b64urlEncode } from '../../src/crypto/encoding';
import { listIdFor } from '../../src/crypto/schema';
import { CREDENTIAL_LIFETIME_MS, STATUS_LIST_SIZE } from '../../src/config';
import type { StatusListState } from '../../src/types';

export async function loadList(): Promise<StatusListState> {
  let list = readJson<StatusListState | null>('statuslist.json', null);
  if (!list || list.expiresAt - Date.now() < 24 * 3600 * 1000) {
    const now = Date.now();
    list = await signStatusList({
      listId: listIdFor(CFG.issuerId), issuerId: CFG.issuerId, size: STATUS_LIST_SIZE,
      bitsB64: list ? list.bitsB64 : b64urlEncode(new Uint8Array(STATUS_LIST_SIZE / 8)),
      issuedAt: now, expiresAt: now + 4 * CREDENTIAL_LIFETIME_MS, signature: '',
    }, CFG.listPrivateJwk);
    writeJson('statuslist.json', list);
  }
  return list;
}

export const saveList = (l: StatusListState) => writeJson('statuslist.json', l);

const r = Router();
r.get('/', async (_req, res) => res.json(await loadList()));
export default r;
