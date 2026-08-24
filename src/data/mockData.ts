import { Character, StylePack, Preset } from '../types';

export const DEMO_CHARACTERS: Character[] = [
  {
    id: 'demo-char-1',
    title: 'Cyber Ronin Kaito',
    excerpt: 'Futuristic cyberpunk samurai with glowing neon katana, dark techwear trenchcoat, sleek face visor, and urban night reflections.',
    cover: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
    note: 'Primary character style: cyberpunk warrior'
  },
  {
    id: 'demo-char-2',
    title: 'Ethereal Starlight Priestess',
    excerpt: 'Graceful celestial sorceress with flowing silver hair, obsidian robes embroidered with glowing star constellations, carrying an intricate orb staff.',
    cover: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop',
    note: 'High fantasy arcane caster'
  },
  {
    id: 'demo-char-3',
    title: 'Mecha Pilot Vesper',
    excerpt: 'Tactical mecha engineer wearing industrial exosuit, orange utility trim, hologram HUD glasses, and heavy mechanical gauntlets.',
    cover: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop',
    note: 'Sci-fi pilot and mechanic'
  },
  {
    id: 'demo-char-4',
    title: 'Ancient Forest Warden',
    excerpt: 'Woodland guardian deity with antler headpiece, moss-patterned cloak, glowing golden eyes, and bioluminescent flora around shoulders.',
    cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
    note: 'Nature elemental champion'
  }
];

export const DEMO_STYLES: StylePack[] = [
  {
    id: 'demo-style-1',
    title: 'Neon Cyberpunk Noir',
    style_prompt_raindrop_id: '990001',
    style_prompt: 'Cinematic cyberpunk atmospheric lighting, rain-slicked pavement reflections, high contrast neon pink and cyan tones, anamorphic lens flare.',
    extra_style_instruction: 'Emphasize deep shadows with vibrant accent lights and wet reflection details.',
    preview_cover: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop',
    style_reference_links: [
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1519501025264-65ba15a82390?q=80&w=800&auto=format&fit=crop'
    ]
  },
  {
    id: 'demo-style-2',
    title: 'Painterly Anime Dreamscape',
    style_prompt_raindrop_id: '990002',
    style_prompt: 'Lush hand-painted watercolor anime aesthetic, vibrant golden hour sunlight, voluminous cotton-candy clouds, soft hand-drawn linework.',
    extra_style_instruction: 'Apply soft bloom effects, warm nostalgia atmosphere, and organic painterly textures.',
    preview_cover: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?q=80&w=800&auto=format&fit=crop',
    style_reference_links: [
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=800&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop'
    ]
  },
  {
    id: 'demo-style-3',
    title: 'Dark Fantasy Chiaroscuro',
    style_prompt_raindrop_id: '990003',
    style_prompt: 'Atmospheric dark fantasy illustration, dramatic rim lighting, desaturated earth tones with burning ember highlights, oil painting texture.',
    extra_style_instruction: 'Focus on volumetric fog, heavy shadows, and weathered armor/cloth details.',
    preview_cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
    style_reference_links: [
      'https://images.unsplash.com/photo-1514565131-fce0801e5785?q=80&w=800&auto=format&fit=crop'
    ]
  },
  {
    id: 'demo-style-4',
    title: '80s Synthwave Sunset',
    style_prompt_raindrop_id: '990004',
    style_prompt: 'Retro 1980s synthwave aesthetic, laser grid horizon, vibrant purple to magenta sunset, metallic chrome typography lighting.',
    extra_style_instruction: 'Include subtle VHS tape distortion, neon glows, and geometric perspective lines.',
    preview_cover: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=800&auto=format&fit=crop',
    style_reference_links: [
      'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?q=80&w=800&auto=format&fit=crop'
    ]
  }
];

export const DEMO_PRESETS: Preset[] = [
  {
    id: 'demo-preset-1',
    title: 'Neon Cyber Samurai Duel',
    preview_image: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=800&auto=format&fit=crop',
    prompt: 'A cinematic neon-drenched showdown atop a rain-soaked Neo Tokyo skyscraper at midnight. Dual luminous energy blades clashing with holographic sparks illuminating the dense mist and towering billboards.',
    model: 'GPT Image 2',
    aspect_ratio: '16:9',
    text_language: 'English',
    style_pack_name: 'Neon Cyberpunk Noir',
    character_names: ['Cyber Ronin Kaito'],
    raw_note: JSON.stringify({
      prompt: 'A cinematic neon-drenched showdown atop a rain-soaked Neo Tokyo skyscraper at midnight. Dual luminous energy blades clashing with holographic sparks illuminating the dense mist and towering billboards.',
      model: 'GPT Image 2',
      aspect_ratio: '16:9',
      text_language: 'English',
      style_pack_name: 'Neon Cyberpunk Noir',
      character_names: ['Cyber Ronin Kaito']
    }, null, 2)
  },
  {
    id: 'demo-preset-2',
    title: 'Celestial Shrine Blessing',
    preview_image: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=800&auto=format&fit=crop',
    prompt: 'Floating high above a sea of clouds at twilight, channeling starlight through an arcane orb staff. Golden hour light illuminating floating lanterns and ancient sakura petals swirling in the wind.',
    model: 'Gemini 3.1 Flash',
    aspect_ratio: '3:4',
    text_language: 'Auto',
    style_pack_name: 'Painterly Anime Dreamscape',
    character_names: ['Ethereal Starlight Priestess'],
    raw_note: JSON.stringify({
      prompt: 'Floating high above a sea of clouds at twilight, channeling starlight through an arcane orb staff. Golden hour light illuminating floating lanterns and ancient sakura petals swirling in the wind.',
      model: 'Gemini 3.1 Flash',
      aspect_ratio: '3:4',
      text_language: 'Auto',
      style_pack_name: 'Painterly Anime Dreamscape',
      character_names: ['Ethereal Starlight Priestess']
    }, null, 2)
  },
  {
    id: 'demo-preset-3',
    title: 'Mecha Vanguard Overdrive',
    preview_image: 'https://images.unsplash.com/photo-1563089145-599997674d42?q=80&w=800&auto=format&fit=crop',
    prompt: 'Retro-futuristic tactical repair station in outer orbit. Neon laser grids in the background, cockpit diagnostics in vivid orange and purple glows, intricate mechanical armor assembly.',
    model: 'GPT Image 2',
    aspect_ratio: '1:1',
    text_language: 'No text',
    style_pack_name: '80s Synthwave Sunset',
    character_names: ['Mecha Pilot Vesper'],
    raw_note: JSON.stringify({
      prompt: 'Retro-futuristic tactical repair station in outer orbit. Neon laser grids in the background, cockpit diagnostics in vivid orange and purple glows, intricate mechanical armor assembly.',
      model: 'GPT Image 2',
      aspect_ratio: '1:1',
      text_language: 'No text',
      style_pack_name: '80s Synthwave Sunset',
      character_names: ['Mecha Pilot Vesper']
    }, null, 2)
  },
  {
    id: 'demo-preset-4',
    title: 'Ancient Guardian Grove Council',
    preview_image: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop',
    prompt: 'Deep primordial forest clearing under an ancient colossal tree. Bioluminescent mushrooms and glowing moss casting dramatic green and gold chiaroscuro lighting on two guardians convening in quiet reverence.',
    model: 'Gemini 3.1 Flash Lite',
    aspect_ratio: '16:9',
    text_language: 'Auto',
    style_pack_name: 'Dark Fantasy Chiaroscuro',
    character_names: ['Ancient Forest Warden', 'Ethereal Starlight Priestess'],
    raw_note: JSON.stringify({
      prompt: 'Deep primordial forest clearing under an ancient colossal tree. Bioluminescent mushrooms and glowing moss casting dramatic green and gold chiaroscuro lighting on two guardians convening in quiet reverence.',
      model: 'Gemini 3.1 Flash Lite',
      aspect_ratio: '16:9',
      text_language: 'Auto',
      style_pack_name: 'Dark Fantasy Chiaroscuro',
      character_names: ['Ancient Forest Warden', 'Ethereal Starlight Priestess']
    }, null, 2)
  }
];

