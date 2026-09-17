import { catalogConfig, catalogConfigured } from './config';
import { getJson, parsePublicPack, publicPackUrl } from './catalog';
import type { Pack } from './study/types';

/** Revalidate the entire source revision, even for a subset mistake-review pack. */
export async function checkPublicAccess(pack: Pack): Promise<void> {
  if (pack.source === 'bundled') return;
  if (!catalogConfigured) throw new Error('Connect a public catalog to check access to this saved quiz.');
  const result = await getJson(publicPackUrl(catalogConfig.url, pack.id), catalogConfig.key);
  if (!Array.isArray(result) || result.length !== 1 || result[0]?.id !== pack.id || result[0]?.is_public !== true || result[0]?.archived_at !== null) {
    throw new Error('This quiz is no longer public. Clear downloaded data in Account. It cannot be started or resumed.');
  }
  const current = parsePublicPack(result[0]);
  if (current.revision !== pack.revision) {
    throw new Error('This quiz has changed. Clear its downloaded data in Account and open the current quiz from Library. Old answers remain personal practice only.');
  }
}
