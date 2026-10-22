export type MemoryPurpose = 'knowledge' | 'smoke' | 'quarantined';
type MemoryQualityLayer = 'briefing' | 'worklog' | 'semantic';

export interface MemoryQualitySignals {
  objective: boolean;
  outcome: boolean;
  decisions: boolean;
  evidence: boolean;
  next_steps: boolean;
  artifacts: boolean;
  failures_or_constraints: boolean;
  headings: number;
  characters: number;
  raw_noise_ratio: number;
  placeholders: number;
}

export interface MemoryQualityAssessment {
  accepted: boolean;
  purpose: MemoryPurpose;
  score: number;
  signals: MemoryQualitySignals;
  rejectionReasons: string[];
  retentionDays: number | null;
}

const smokeTag = /(?:^|[-_])(smoke|canary)(?:$|[-_])/iu;

// Marcadores de rascunho. "todo" e "preencher" também são português comum ("todo preset",
// "preencher o formulário"): só contam em maiúsculas ou em sintaxe de marcador. A fronteira
// é Unicode porque o `\b` do JS é ASCII e enxerga "todo" dentro de "método".
const placeholderPatterns = [
  /(?<![\p{L}\p{N}_])(?:fixme|tbd|lorem ipsum)(?![\p{L}\p{N}_])/giu,
  /(?<![\p{L}\p{N}_])(?:TODO|PREENCHER)(?![\p{L}\p{N}_])/gu,
  /(?<![\p{L}\p{N}_])todo(?=[:(])/giu,
  /(?<=[[<{(][\t ]*)preencher(?![\p{L}\p{N}_])/giu,
  /(?<=(?:^|:)[\t ]*(?:[-*+][\t ]+)?)preencher(?=[\t ]*[.…]?[\t ]*$)/gimu,
];
const codeSpan = /```[\s\S]*?```|`[^`\n]*`/gu;

/** Posições onde começam marcadores de rascunho; código citado entre crases não conta. */
export function placeholderMarkerOffsets(text: string): number[] {
  const prose = text.replace(codeSpan, (code) => code.replace(/[^\n]/gu, ' '));
  const offsets = new Set<number>();
  for (const pattern of placeholderPatterns) {
    for (const match of prose.matchAll(pattern)) offsets.add(match.index);
  }
  return [...offsets].sort((a, b) => a - b);
}

export function assessMemoryQuality(
  content: string,
  tags: string[],
  layer: MemoryQualityLayer,
): MemoryQualityAssessment {
  const normalized = content.replaceAll('\r\n', '\n').trim();
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);
  const rawLines = lines.filter((line) =>
    /^(?:\d{4}-\d{2}-\d{2}[t ]\d{2}:\d{2}|\[?(?:info|debug|warn|error)\]?\b|at\s+\S+\s+\(|[+-]{3}\s|@@\s|\{\s*"|\s*\$\s+)/iu.test(
      line.trim(),
    ),
  );
  const signals: MemoryQualitySignals = {
    objective: /\b(objetivo|objective|contexto|context)\b/iu.test(normalized),
    outcome: /\b(resultado|outcome|conclu[ií]d|feito|entregue|implementad|resolvid)\w*/iu.test(
      normalized,
    ),
    decisions: /\b(decis(?:ão|ões)|decision|escolh|adr)\w*/iu.test(normalized),
    evidence:
      /\b(evid[eê]ncia|verifica|teste|test|smoke|commit|release|deploy|produ[cç][aã]o|sha)\w*/iu.test(
        normalized,
      ),
    next_steps: /\b(pr[oó]xim|next step|pend[eê]ncia|continuar|retomar)\w*/iu.test(normalized),
    artifacts: /(?:^|[\s`])(?:docs|src|apps|packages|scripts|deploy|bin)\/[\w./-]+/mu.test(
      normalized,
    ),
    failures_or_constraints:
      /\b(falha|failure|erro|tentativa|n[aã]o funcion|reprov|restri[cç][aã]o|constraint|limite|bloqueio|risco)\w*/iu.test(
        normalized,
      ),
    headings: lines.filter((line) => /^#{1,6}\s+\S/u.test(line)).length,
    characters: normalized.length,
    raw_noise_ratio: lines.length === 0 ? 0 : rawLines.length / lines.length,
    placeholders: placeholderMarkerOffsets(normalized).length,
  };

  const smoke = tags.some(
    (tag) => smokeTag.test(tag) || ['production-smoke', 'cross-agent'].includes(tag.toLowerCase()),
  );
  if (smoke) {
    return {
      accepted: true,
      purpose: 'smoke',
      score: Math.min(100, Math.max(1, signals.characters)),
      signals,
      rejectionReasons: [],
      retentionDays: 7,
    };
  }

  let score = layer === 'semantic' ? 45 : 15;
  if (signals.characters >= (layer === 'semantic' ? 40 : 400) && signals.characters <= 12_000)
    score += 10;
  if (signals.headings >= 3) score += 8;
  if (signals.headings >= 6 && signals.characters < 400) score += 5;
  if (signals.objective) score += 8;
  if (signals.outcome) score += 12;
  if (signals.decisions) score += 10;
  if (signals.evidence) score += 15;
  if (signals.next_steps) score += 12;
  if (signals.artifacts) score += 10;
  if (signals.failures_or_constraints) score += 6;
  if (signals.raw_noise_ratio >= 0.3) score -= 25;
  if (signals.placeholders >= 2) score -= 15;
  if (signals.characters < (layer === 'semantic' ? 40 : 280)) score -= 15;
  if (signals.characters > 12_000) score -= 10;
  score = Math.max(0, Math.min(100, score));

  const rejectionReasons: string[] = [];
  if (
    signals.characters < (layer === 'semantic' ? 40 : 280) &&
    (layer === 'semantic' || signals.headings < 3)
  )
    rejectionReasons.push('too_short');
  if (signals.raw_noise_ratio >= 0.3) rejectionReasons.push('raw_log_heavy');
  if (signals.placeholders >= 2) rejectionReasons.push('placeholder_heavy');
  if (score < 50) rejectionReasons.push('quality_below_50');
  const accepted = rejectionReasons.length === 0;
  return {
    accepted,
    purpose: accepted ? 'knowledge' : 'quarantined',
    score,
    signals,
    rejectionReasons,
    retentionDays: null,
  };
}
