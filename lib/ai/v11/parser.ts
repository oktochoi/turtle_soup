import { extractFamilyMentions, normalizeText } from './normalize';
import type { ParsedQuestion, QuestionIntent } from './types';

export function parseQuestion(question: string): ParsedQuestion {
  const raw = (question || '').trim();
  const normalized = normalizeText(raw);
  const entitiesMentioned = extractFamilyMentions(raw);

  const isBeliefQuery = /생각|믿|알았|줄\s*알|착각|오해/.test(normalized);
  const isCauseQuery = /때문|원인|이유|위하|목적|해서|충격/.test(normalized);
  const isFamilyQuery =
    entitiesMentioned.length > 0 || /가족|혈연|친척|부모|형제|자매/.test(normalized);
  const isNegated = /안\s|않|없|아니|아닌|못\s/.test(normalized);

  let intent: QuestionIntent = 'other';
  if (isBeliefQuery) intent = 'belief';
  else if (/목적|확인하기|하려고/.test(normalized)) intent = 'purpose';
  else if (isCauseQuery) intent = 'cause';
  else if (/죽|살|잠|열|닫|사라|상태/.test(normalized)) intent = 'state';
  else if (/주문|전화|보냈|가|오|했|행동/.test(normalized)) intent = 'action';
  else if (isFamilyQuery || /관련|범인|가해|누구/.test(normalized)) intent = 'relation';
  else if (/언제|몇\s*시|시간/.test(normalized)) intent = 'time';
  else if (/어디|장소|위치/.test(normalized)) intent = 'location';
  else if (entitiesMentioned.length) intent = 'entity';

  return {
    raw,
    normalized,
    intent,
    entitiesMentioned,
    isNegated,
    isBeliefQuery,
    isCauseQuery,
    isFamilyQuery,
  };
}
