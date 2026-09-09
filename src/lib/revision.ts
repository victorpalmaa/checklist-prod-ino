/**
 * Normaliza a exibicao da revisao do template.
 *
 * O banco tem tres grafias divergentes: os seeds antigos de Po e Gel
 * gravaram "06" sem prefixo, Capsula gravou "REV.07" sem espaco, e os
 * novos usam "REV. 08". O trigger de imutabilidade impede corrigir a
 * coluna depois de publicada, entao a normalizacao acontece so na
 * exibicao.
 *
 * Remove o prefixo em qualquer grafia e reaplica um unico padrao:
 *   "06"      -> "REV. 06"
 *   "REV.07"  -> "REV. 07"
 *   "REV. 08" -> "REV. 08"
 *
 * NUNCA filtrar por revision em SQL — filtrar por status + product_type.
 */
export function formatRevision(revision: string): string {
  const r = revision.trim();
  const semPrefixo = r.replace(/^rev\.?\s*/i, "");
  return `REV. ${semPrefixo}`;
}
