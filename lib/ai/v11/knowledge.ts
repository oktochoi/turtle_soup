import {
  extractFamilyMentions,
  normalizeText,
  simpleHash,
  splitSentences,
  PARENT_SPECIFICS,
} from './normalize';
import type {
  AtomicFact,
  BeliefFact,
  CaseEvent,
  CaseKnowledge,
  CausalFact,
  Entity,
  Relation,
  StateFact,
} from './types';

const BELIEF_MARKERS = /생각|믿|알았|줄 알|착각|오해|추정/;
const CAUSE_MARKERS = /때문에|으로 인해|탓에|결과|충격으로|이유로/;
const PURPOSE_MARKERS = /위해|위하여|목적|확인하기|하려고/;
const STATE_MARKERS = /죽어|살았|살아|잠겨|열려|사라|비어|없없|사망|생존/;
const ACTION_MARKERS = /주문|전화|열|닫|가|오|보|죽|살|보냈|발견|신고/;

function makeId(prefix: string, i: number): string {
  return `${prefix}_${i + 1}`;
}

function detectBelief(sentence: string): BeliefFact | null {
  if (!BELIEF_MARKERS.test(sentence)) return null;
  const family = extractFamilyMentions(sentence);
  const holder = family[0] || '누군가';
  return {
    id: '',
    holder,
    proposition: sentence,
    text: sentence,
  };
}

function detectCause(sentence: string): CausalFact | null {
  if (PURPOSE_MARKERS.test(sentence)) {
    const parts = sentence.split(/위해|위하여|하려고/);
    return {
      id: '',
      cause: (parts[1] || sentence).trim(),
      effect: (parts[0] || sentence).trim(),
      text: sentence,
      kind: 'purpose',
    };
  }
  if (CAUSE_MARKERS.test(sentence)) {
    const parts = sentence.split(/때문에|으로 인해|탓에|충격으로|이유로/);
    return {
      id: '',
      cause: (parts[0] || sentence).trim(),
      effect: (parts[1] || sentence).trim(),
      text: sentence,
      kind: 'cause',
    };
  }
  return null;
}

function buildEntities(texts: string[]): Entity[] {
  const names = new Map<string, Entity>();
  let i = 0;
  for (const text of texts) {
    for (const mention of extractFamilyMentions(text)) {
      if (names.has(mention)) continue;
      const role =
        mention === '어머니' || mention === '아버지' || mention === '부모'
          ? 'parent'
          : mention === '아들' || mention === '딸' || mention === '자녀'
            ? 'child'
            : mention === '남편' || mention === '아내' || mention === '배우자'
              ? 'spouse'
              : undefined;
      names.set(mention, {
        id: makeId('person', i++),
        name: mention,
        type: 'person',
        role,
        aliases:
          mention === '어머니'
            ? ['엄마', '어머님', '모친']
            : mention === '아버지'
              ? ['아빠', '아버님', '부친']
              : mention === '부모'
                ? ['부모님']
                : undefined,
      });
    }
    // light noun hooks
    for (const obj of ['음식', '배달', '전화', '문', '차', '차량']) {
      if (normalizeText(text).includes(obj) && !names.has(obj)) {
        names.set(obj, { id: makeId('obj', i++), name: obj, type: 'object' });
      }
    }
  }
  return [...names.values()];
}

function buildFamilyRelations(entities: Entity[], answer: string): Relation[] {
  const byName = new Map(entities.map((e) => [e.name, e]));
  const rels: Relation[] = [];
  let i = 0;
  const mother = byName.get('어머니');
  const father = byName.get('아버지');
  const child = byName.get('아들') || byName.get('딸') || byName.get('자녀');
  const n = normalizeText(answer);

  if (mother && child) {
    rels.push({
      id: makeId('rel', i++),
      from: mother.id,
      to: child.id,
      type: 'parent_of',
      text: `${mother.name}는 ${child.name}의 부모다.`,
    });
    rels.push({
      id: makeId('rel', i++),
      from: child.id,
      to: mother.id,
      type: 'child_of',
      text: `${child.name}는 ${mother.name}의 자녀다.`,
    });
  }
  if (father && child) {
    rels.push({
      id: makeId('rel', i++),
      from: father.id,
      to: child.id,
      type: 'parent_of',
      text: `${father.name}는 ${child.name}의 부모다.`,
    });
  }

  // If answer mentions 어머니 related but no child entity, still encode parent role
  if (mother && /관련|주문|전화|범인|가해/.test(n)) {
    rels.push({
      id: makeId('rel', i++),
      from: mother.id,
      to: mother.id,
      type: 'identity',
      text: `${mother.name}가 사건에 관련되어 있다.`,
    });
  }
  if (father && /관련|주문|전화|범인|가해/.test(n) && father.name !== mother?.name) {
    rels.push({
      id: makeId('rel', i++),
      from: father.id,
      to: father.id,
      type: 'identity',
      text: `${father.name}가 사건에 관련되어 있다.`,
    });
  }

  // Mark parent hypernym availability when a specific parent exists in answer
  for (const e of entities) {
    if (PARENT_SPECIFICS.has(e.name) || e.name === '어머니' || e.name === '아버지') {
      rels.push({
        id: makeId('rel', i++),
        from: e.id,
        to: e.id,
        type: 'family',
        text: `${e.name}은(는) 부모 역할이다.`,
      });
    }
  }

  return rels;
}

/**
 * Build Case Knowledge from content + answer only.
 * No manual keyClues / solutionElements required.
 */
export function buildCaseKnowledge(args: {
  caseId: string;
  content: string;
  answer: string;
}): CaseKnowledge {
  const { caseId, content, answer } = args;
  const answerSentences = splitSentences(answer);
  const contentSentences = splitSentences(content).slice(0, 12);
  const entities = buildEntities([...answerSentences, ...contentSentences]);
  const relations = buildFamilyRelations(entities, answer);

  const beliefs: BeliefFact[] = [];
  const causes: CausalFact[] = [];
  const states: StateFact[] = [];
  const events: CaseEvent[] = [];
  const facts: AtomicFact[] = [];

  let bi = 0;
  let ci = 0;
  let si = 0;
  let ei = 0;
  let fi = 0;

  answerSentences.forEach((sentence, idx) => {
    const importance = Math.max(0.35, 1 - idx * 0.08);
    const belief = detectBelief(sentence);
    if (belief) {
      belief.id = makeId('belief', bi++);
      beliefs.push(belief);
      facts.push({
        id: makeId('fact', fi++),
        text: sentence,
        kind: 'belief',
        importance: importance + 0.1,
        source: 'answer',
      });
    }

    const cause = detectCause(sentence);
    if (cause) {
      cause.id = makeId('cause', ci++);
      causes.push(cause);
      facts.push({
        id: makeId('fact', fi++),
        text: sentence,
        kind: cause.kind === 'purpose' ? 'purpose' : 'cause',
        importance: importance + 0.15,
        source: 'answer',
      });
    }

    if (STATE_MARKERS.test(sentence) && !belief) {
      const st: StateFact = {
        id: makeId('state', si++),
        subject: extractFamilyMentions(sentence)[0],
        state: sentence,
        text: sentence,
      };
      states.push(st);
      facts.push({
        id: makeId('fact', fi++),
        text: sentence,
        kind: 'state',
        importance,
        source: 'answer',
      });
    }

    if (ACTION_MARKERS.test(sentence)) {
      const family = extractFamilyMentions(sentence);
      events.push({
        id: makeId('event', ei++),
        actor: family[0],
        action: sentence,
        text: sentence,
      });
      if (!belief && !cause) {
        facts.push({
          id: makeId('fact', fi++),
          text: sentence,
          kind: 'event',
          importance,
          source: 'answer',
        });
      }
    }

    // Always keep atomic fact for answer sentence if not already added
    if (!facts.some((f) => f.text === sentence)) {
      facts.push({
        id: makeId('fact', fi++),
        text: sentence,
        kind: 'fact',
        importance,
        source: 'answer',
      });
    }
  });

  // Derived relation facts (for confirmed-fact + evaluation)
  for (const rel of relations) {
    if (rel.type === 'parent_of' || rel.type === 'identity' || rel.type === 'family') {
      if (!facts.some((f) => f.text === rel.text)) {
        facts.push({
          id: makeId('fact', fi++),
          text: rel.text,
          kind: 'relation',
          importance: 0.7,
          source: 'derived',
        });
      }
    }
  }

  // Ensure at least one fact from full answer
  if (facts.length === 0 && answer.trim()) {
    facts.push({
      id: makeId('fact', fi++),
      text: answer.trim(),
      kind: 'fact',
      importance: 1,
      source: 'answer',
    });
  }

  return {
    caseId,
    answerHash: simpleHash(answer + '|' + content),
    content,
    answer,
    entities,
    relations,
    events,
    states,
    beliefs,
    causes,
    facts,
    builtAt: Date.now(),
  };
}
