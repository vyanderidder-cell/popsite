/* Devanture — images et vidéo de la ville (générées puis stockées sur le site) */
const B = 'https://wlkibywdgsyqn93x.public.blob.vercel-storage.com/media/';
const small = Math.min(window.innerWidth, window.innerHeight) < 700 || window.innerWidth < 900;
const save = !!(navigator.connection && (navigator.connection.saveData || /2g/.test(navigator.connection.effectiveType || '')));
const img = n => B + n + (small ? '-m' : '') + '.webp';
export const MEDIA = {
  heroVideo: save ? '' : B + 'hero.mp4',
  heroPoster: img('aerial'),
  street: img('street'), shop: img('shop'), aerial: img('aerial'), blue: img('blue')
};
/* repères des commerces sans site, en coordonnées relatives de l'image (0 à 1) */
export const PINS = {
  aerial: {
    center: [0.58, 0.46],
    shops: [
      { x: 0.30, y: 0.62, cat: 'auto', label: 'GARAGE PERRIN', sub: 'MÉCANIQUE · AUCUN SITE' },
      { x: 0.40, y: 0.74, cat: 'resto', label: 'PIZZA NINO' },
      { x: 0.70, y: 0.52, cat: 'beaute', label: 'COIFFURE MYLÈNE' },
      { x: 0.17, y: 0.42, cat: 'commerce' }, { x: 0.86, y: 0.43, cat: 'artisan' }, { x: 0.46, y: 0.33, cat: 'commerce' },
      { x: 0.63, y: 0.63, cat: 'resto' }, { x: 0.52, y: 0.82, cat: 'artisan' }, { x: 0.23, y: 0.74, cat: 'beaute' },
      { x: 0.79, y: 0.66, cat: 'commerce' }, { x: 0.36, y: 0.47, cat: 'auto' }, { x: 0.92, y: 0.56, cat: 'artisan' }
    ]
  },
  street: { shops: [{ x: 0.672, y: 0.70, cat: 'auto' }] }
};
