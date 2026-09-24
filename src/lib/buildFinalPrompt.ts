import { Character, StylePack } from '@/types';

export const COPYRIGHT_PATTERNS = [
  {
    brand: "mcdonald's",
    matches: ['mcdonald', "mcdonald's", 'mcdonalds', '麦当劳'],
    replacements: ['a "W" logo', "WaDonald's"],
  },
  {
    brand: 'kfc',
    matches: ['kfc', '肯德基'],
    replacements: ['a black skin old man', 'KFD'],
  },
  {
    brand: 'starbucks',
    matches: ['starbucks', '星巴克'],
    replacements: ['a duck', 'Starducks'],
  },
  {
    brand: 'pizza hut',
    matches: ['pizza hut', 'pizzahut'],
    replacements: ['a minimalistic hot round pizza', 'Pizza Hot'],
  },
  {
    brand: 'subway',
    matches: ['subway'],
    replacements: ["a subway-style icon but with text 'Suphey'", 'Suphey'],
  },
  {
    brand: 'muji',
    matches: ['muji'],
    replacements: ["a muji-style icon but with text 'MIJU'", 'MIJU'],
  },
  {
    brand: 'apple',
    matches: ['apple'],
    replacements: ['a minimalistic flat orange logo with a smooth bite mark', 'Orange'],
  },
  {
    brand: 'nike',
    matches: ['nike'],
    replacements: ['a nike-style cross logo', 'Mike'],
  },
  {
    brand: 'burger king',
    matches: ['burger king'],
    replacements: ["a burger king style logo but with text 'Burger Queen'", 'Burger Queen'],
  },
];

export function getCopyrightPrompt(instruction: string): string {
  const ins = (instruction || '').toLowerCase().trim();
  if (!ins) return '';

  const replacementPrompts: string[] = [];

  for (const item of COPYRIGHT_PATTERNS) {
    const { brand, matches, replacements } = item;
    for (const m of matches) {
      if (ins.includes(m)) {
        const line = [
          `if it contains ${brand} logo, replace it with ${replacements[0]} in the same style;`,
          `if it contains text: ${matches.map((match) => `"${match}"`).join(', ')}, replace with "${replacements[1]}"`,
        ].join(' ');
        replacementPrompts.push(line);
        break;
      }
    }
  }

  if (replacementPrompts.length > 0) {
    replacementPrompts.push(
      'IMPORTANT: only perform the above replacement IF content actually exists in the image, DON\'T ADD, ONLY REPLACE!'
    );
  }

  return replacementPrompts.join('\n');
}

export interface BuildFinalPromptParams {
  instruction: string;
  characters: Character[];
  selectedAddOnsByCharacterId?: Record<string, string[]>;
  hasCharacterReferenceImage?: boolean;
  style: StylePack | null;
  hasStyleReferenceImage?: boolean;
  hasAttachments?: boolean;
  aspectRatio?: string;
  textLanguage?: string;
}

export function buildFinalPrompt(params: BuildFinalPromptParams): string {
  const {
    instruction,
    characters,
    selectedAddOnsByCharacterId = {},
    hasCharacterReferenceImage,
    style,
    hasStyleReferenceImage,
    hasAttachments,
    aspectRatio,
    textLanguage,
  } = params;

  // 1. Content / Composition Authority
  const insText = (instruction || '').trim();
  const copyrightText = getCopyrightPrompt(insText);
  let contentSectionParts: string[] = [];
  if (insText) {
    contentSectionParts.push(`User instruction:\n${insText}`);
  }
  if (copyrightText) {
    contentSectionParts.push(copyrightText);
  }
  if (hasAttachments) {
    contentSectionParts.push('Attachments:\n[See attached content/composition reference image(s)]');
  }

  const contentAuthority = contentSectionParts.length
    ? contentSectionParts.join('\n\n')
    : 'User instruction:\nCreate an expressive, high quality composition.';

  // 2. Character Identity Authority
  let characterIdentity = '';
  if (characters && characters.length > 0) {
    const charDescriptions = characters
      .map((c) => {
        const title = (c.title || '').trim();
        const selectedAddOns = selectedAddOnsByCharacterId[String(c.id)] || [];
        const addOns = (c.addOns || []).filter((a) => selectedAddOns.includes(a));
        const addOnText = addOns.join('; ');
        const baseExcerpt = (c.excerpt || '').trim();
        const fullPrompt = addOnText
          ? baseExcerpt ? `${baseExcerpt} (${addOnText})` : `(${addOnText})`
          : baseExcerpt;

        if (fullPrompt) {
          return `${title}: ${fullPrompt}${fullPrompt.endsWith('.') ? '' : '.'}`;
        }
        return `${title}.`;
      })
      .filter(Boolean)
      .join('\n');

    let charImageNote = '';
    if (hasCharacterReferenceImage) {
      charImageNote = '\n\nReference images:\n[See attached character reference image]';
    }

    characterIdentity = `2. CHARACTER IDENTITY AUTHORITY — governs WHO the characters are: identity-defining traits, clothing, markings, identity colors, accessories. Treat the extracted identity TEXT as the source of truth; use the character images only to confirm identity, NEVER as a visual or style source. Redraw all characters entirely in the STYLE.\n\nCharacter description:\n${charDescriptions}${charImageNote}\n\nMake sure the colors used for character are clean, the characters are anatomically correct.`;
  }

  // 3. Style Authority
  let styleAuthority = '';
  if (style) {
    const stylePrompt = (style.style_prompt || style.title || '').trim();
    const extraStyleInstruction = (style.extra_style_instruction || '').trim();

    let styleSectionParts: string[] = [];
    if (stylePrompt) {
      styleSectionParts.push(`Style guide extracted from references:\n${stylePrompt}`);
    }
    if (extraStyleInstruction) {
      styleSectionParts.push(`Optional extra style instruction (pay extra attention if provided):\n${extraStyleInstruction}`);
    }
    if (hasStyleReferenceImage) {
      styleSectionParts.push('Original style reference images:\n[See attached style reference image]');
    }

    styleAuthority = `3. STYLE AUTHORITY — the ONLY source for how anything is drawn. Apply globally to every character, object, background, and detail. The output must read as if made by the same hand as the style references.\n\n${styleSectionParts.join('\n\n')}\n\nMandatory style compliance checklist:\n- Match reference stroke / brush / line quality and edge treatment.\n- Match reference character-design language while preserving the supplied identities.\n- Match reference simplification, object/environment arrangement, and compositional grammar.\n- Match palette, contrast, shading, texture, and rendering density.\n- Reject any generic polished digital-art look that differs from the style reference.\n\nConflict resolution (strict):\n- CONTENT decides what and where.\n- IDENTITY decides who.\n- STYLE decides how everything is drawn — always, with ZERO contribution from content images or character images to rendering.\n- If a character image's look conflicts with the style reference, the style reference wins 100%.`;
  }

  // 4. Misc
  const ratioVal = aspectRatio && aspectRatio !== 'Auto' ? aspectRatio : 'Auto';
  const langVal = textLanguage && textLanguage !== 'Auto' ? textLanguage : 'Auto';
  const miscSection = `4. MISC\n- Ratio: ${ratioVal}\n- Language: ${langVal}`;

  // Build the complete prompt based on schema structure
  const header = `You are compositing ONE final image from three independent authorities. Read this first and treat it as absolute:\n\nSTYLE LOCK — The finished image's rendering (HOW everything is drawn) is dictated SOLELY by the STYLE AUTHORITY in section 3. No other input may influence rendering. The character reference images are IDENTITY DOCUMENTATION ONLY — they may be drawn in a placeholder or unrelated style that you MUST ignore and MUST NOT imitate, sample, or blend. Reconstruct every character from scratch in the target style, as if your only knowledge of them were the written identity text.\n\nFrom the character reference images, do NOT copy any of: linework, stroke/brush quality, edge treatment, palette, color grading, shading model, lighting, texture, rendering density, level of detail, or finish. Extract ONLY identity: silhouette-defining traits, clothing, markings, colors-as-identity (e.g. "red scarf"), accessories, and proportions tied to who they are.\n\nPriority rules:\n\n1. CONTENT / COMPOSITION AUTHORITY — governs what appears, scene layout, framing, camera, and spatial arrangement.\n\n${contentAuthority}`;

  const sections = [header];
  if (characterIdentity) {
    sections.push(characterIdentity);
  }
  if (styleAuthority) {
    sections.push(styleAuthority);
  }
  sections.push(miscSection);

  return sections.join('\n\n');
}
