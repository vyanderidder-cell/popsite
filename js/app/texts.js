/* Devanture — textes de prospection et prompt de construction */
import { STYLES, DAYS_FR, slug } from './mockup.js';

const SCHEMA = {
  restaurant: 'Restaurant', pizzeria: 'Restaurant', cafe: 'CafeOrCoffeeShop', bar: 'BarOrPub', fast_food: 'FastFoodRestaurant', ice_cream: 'IceCreamShop', bakery: 'Bakery', pastry: 'Bakery',
  butcher: 'Store', florist: 'Florist', clothes: 'ClothingStore', shoes: 'ShoeStore', books: 'BookStore', hardware: 'HardwareStore', jewelry: 'JewelryStore', pet: 'PetStore', garden: 'GardenStore',
  convenience: 'ConvenienceStore', wine: 'LiquorStore', hairdresser: 'HairSalon', barber: 'HairSalon', beauty: 'BeautySalon', nails: 'NailSalon', tattoo: 'TattooParlor', massage: 'DaySpa', fitness: 'ExerciseGym',
  car_repair: 'AutoRepair', body_shop: 'AutoBodyShop', car: 'AutoDealer', tyres: 'TireShop', bicycle: 'BikeStore', motorcycle: 'MotorcycleRepair', driving_school: 'DrivingSchool', car_wash: 'AutoWash', taxi: 'TaxiService',
  plumber: 'Plumber', electrician: 'Electrician', painter: 'HousePainter', roofer: 'RoofingContractor', builder: 'GeneralContractor', hvac: 'HVACBusiness', locksmith: 'Locksmith', carpenter: 'HomeAndConstructionBusiness',
  winery: 'Winery', brewery: 'Brewery', hotel: 'Hotel', guest_house: 'BedAndBreakfast', gite: 'LodgingBusiness', camp_site: 'Campground', pharmacy: 'Pharmacy', optician: 'Optician', physio: 'Physiotherapy',
  dentist: 'Dentist', doctor: 'MedicalClinic', vet: 'VeterinaryCare', estate_agent: 'RealEstateAgent', accountant: 'AccountingService', lawyer: 'LegalService', notary: 'Notary', laundry: 'DryCleaningOrLaundry',
  travel: 'TravelAgency', funeral: 'LocalBusiness'
};

const eur = n => (Math.round(+n || 0)).toLocaleString('fr-FR') + ' €';

/* ctx : { lead, f (champs maquette), me {prenom, tel, email}, price {creation, mensuel}, info (activité) } */
export function prospect(channel, ctx) {
  const { lead: L, f, me, price, info } = ctx;
  const p = me.prenom || '[Ton prénom]', ville = L.city || '[ville]';
  const where = L.social ? 'votre page sur les réseaux' : 'au mieux une fiche Google';
  const offre = `${eur(price.creation)} pour la création, puis ${eur(price.mensuel)} par mois pour l'hébergement et les mises à jour`;
  const sign = [p, me.tel, me.email].filter(Boolean).join('\n');
  if (channel === 'mail') return {
    subject: `Une maquette de site pour ${L.name}`,
    alt: [`${L.name} : votre site est prêt à être regardé`, `J'ai préparé le site de ${L.name}`],
    body: `Bonjour,

Je m'appelle ${p} et je crée des sites pour les commerces du coin. En cherchant ${L.name} en ligne, je n'ai trouvé que ${where} : rien pour présenter votre ${info.label.toLowerCase()}, vos horaires et ${f.services.length ? 'vos prestations' : 'ce que vous proposez'}.

Je vous ai donc préparé une maquette de site, à votre nom, avec votre adresse, vos horaires et un bouton « ${f.cta} ». Elle est prête, il suffit de la regarder.

Je peux passer vous la montrer cinq minutes cette semaine, au moment qui vous arrange. Si elle vous plaît, le site est en ligne sous huit jours : ${offre}, sans engagement.

Bonne journée,
${sign}

Vous ne souhaitez plus recevoir de message de ma part ? Répondez simplement « stop ».`
  };
  if (channel === 'relance') return {
    subject: `Re : la maquette du site de ${L.name}`,
    alt: [`Toujours partant pour vous montrer la maquette de ${L.name}`],
    body: `Bonjour,

Je reviens vers vous au sujet de la maquette de site que j'ai préparée pour ${L.name}. Je comprends que vous ayez peu de temps : je peux passer à l'heure creuse qui vous arrange, ça prend cinq minutes, sur mon téléphone.

Si ce n'est pas le moment, dites-le-moi et je ne vous relancerai plus.

Bonne journée,
${sign}`
  };
  if (channel === 'telephone') return {
    steps: [
      ['Ouverture', `« Bonjour, ${p}, j'habite à côté de ${ville}. Je ne vous prends qu'une minute : vous êtes bien le ou la responsable de ${L.name} ? »`],
      ['La raison', `« J'ai vu que ${L.name} n'avait pas de site. Je vous en ai préparé une maquette, avec vos horaires et votre adresse. »`],
      ['La demande', `« Je préfère vous la montrer en vrai, ça prend cinq minutes. Quel moment est le plus calme pour vous cette semaine ? »`],
      ['Si non', `« Pas de souci. Je peux vous l'envoyer par mail ou par SMS, vous regarderez quand vous voudrez. »`]
    ]
  };
  // boutique (par défaut)
  return {
    steps: [
      ['Avant d\'entrer', `Ouvre la maquette en mode boutique sur ton téléphone, luminosité à fond. Passe en heure creuse (évite midi, la sortie d'école et le samedi matin). Note le prénom du gérant si tu l'entends.`],
      ['Ouverture', `« Bonjour ! Je m'appelle ${p}, j'habite à côté. J'ai vu que ${L.name} n'avait pas de site, alors je vous en ai préparé un. Je peux vous le montrer ? Ça prend deux minutes. »`],
      ['Montrer', `Tends le téléphone et laisse-le faire défiler. Montre l'enseigne à son nom, le bouton « ${f.cta} », les horaires. Ne parle pas pendant qu'il regarde.`],
      ['Questions', `« Aujourd'hui, comment vos nouveaux clients vous trouvent ? » · « On vous appelle souvent pour demander vos horaires ? » · « Vous auriez une photo de ${info.g === 'artisan' ? 'vos réalisations' : 'la boutique'} que vous aimez ? »`],
      ['Le prix', `« Le site complet, c'est ${offre}. Vous n'avez rien à gérer : je m'occupe de tout. »`],
      ['Conclure', `« Si ça vous va, je vous prends trois photos maintenant et il est en ligne la semaine prochaine. »`],
      ['Après la visite', `Note sa réaction ici, passe le commerce en « Montrée », et prévois une relance dans cinq jours si c'est « je vais réfléchir ».`]
    ],
    objections: [
      ['« J\'ai déjà Facebook. »', `« Très bien, on garde Facebook ! Le site, lui, sort sur Google quand quelqu'un cherche ${info.label.toLowerCase()} à ${ville}, même sans compte Facebook. Et on met un lien vers votre page. »`],
      ['« Mes clients me connaissent déjà. »', `« Vos habitués, oui. Le site, c'est pour ceux qui viennent d'arriver, les touristes, et ceux qui cherchent vos horaires le dimanche soir. »`],
      ['« Je n\'ai pas le temps. »', `« Justement, vous n'avez rien à faire. Trois photos et cinq minutes pour valider les textes, le reste c'est moi. »`],
      ['« C\'est trop cher. »', `« ${eur(price.mensuel)} par mois, c'est moins d'un client gagné. Et c'est sans engagement : si ça ne vous apporte rien, vous arrêtez. »`]
    ]
  };
}

/* prompt pour Claude Code, Codex ou Lovable */
export function buildPrompt(tool, ctx) {
  const { lead: L, f, info } = ctx;
  const P = STYLES[f.style] || STYLES.atelier, s = slug(L.name);
  const T = { claude: 'Claude Code', codex: 'Codex', lovable: 'Lovable' }[tool];
  const hours = f.hours && f.hours.some(Boolean) ? DAYS_FR.map((d, i) => `  - ${d} : ${f.hours[i] || 'Fermé'}`).join('\n') : '  - [À compléter]';
  const tech = tool === 'lovable'
    ? `- Projet React + Tailwind (ce que Lovable génère par défaut). Une page d'accueil et une route /mentions-legales.
- Pas de backend, pas d'authentification, pas de base de données.`
    : `- Site statique en HTML et CSS, sans framework. JavaScript seulement si indispensable.
- Arborescence : index.html, mentions-legales.html, styles.css, assets/ (images), sitemap.xml, robots.txt.`;
  return `Tu es développeur web senior. Construis le vrai site vitrine de « ${L.name} », ${info.label.toLowerCase()}${L.city ? ' à ' + L.city : ''}.

## Contexte
- Le gérant a validé une maquette : je te joins le fichier ${s}-maquette.html. Reprends sa structure, ses textes et sa palette, en plus soigné.
- Clients locaux, surtout sur téléphone. Objectif principal du site : « ${f.cta} ».

## Informations du commerce (n'invente rien d'autre)
- Nom : ${L.name}
- Activité : ${info.label}
- Adresse : ${[L.addr, L.city].filter(Boolean).join(', ') || '[À compléter]'}
- Téléphone : ${L.phone || '[À compléter]'}
- E-mail : ${L.email || '[À compléter]'}
${L.social ? `- Réseaux : ${L.social}\n` : ''}- Horaires :
${hours}
- Accroche : « ${f.tagline} »
- Présentation : ${f.intro}
- Prestations : ${f.services.filter(Boolean).join(' ; ') || '[À compléter]'}
${f.rating ? `- Note Google : ${f.rating} / 5${f.reviews ? ' (' + f.reviews + ' avis)' : ''}. Affiche-la sans inventer de citation d'avis.\n` : ''}${L.lat ? `- Coordonnées GPS : ${L.lat.toFixed(5)}, ${L.lon.toFixed(5)}\n` : ''}
## Direction artistique (style « ${P.label} »)
- Couleurs : fond ${P.bg}, texte ${P.ink}, texte secondaire ${P.soft}, accent ${P.acc}, blocs ${P.box}, filets ${P.rule}. Rayon des angles : ${P.r} px.
- Typographies Google Fonts : ${P.head.split(',')[0].replace(/"/g, '')} pour les titres, ${P.body.split(',')[0].replace(/"/g, '')} pour le texte.
- Garde l'illustration SVG de la devanture tant que le gérant n'a pas envoyé ses photos. Prévois des emplacements photo faciles à remplacer (WebP, lazy-loading, texte alternatif).

## Contenu de la page d'accueil
1. En-tête : nom, menu (Prestations, Horaires, Contact), bouton « ${f.cta} »${L.phone ? ' qui appelle le ' + L.phone : ''}.
2. Accroche, présentation, deux boutons, puis adresse et téléphone en évidence.
3. Prestations en cartes.
4. Horaires dans un tableau lisible.
5. Nous trouver : adresse, téléphone cliquable, e-mail, lien d'itinéraire vers OpenStreetMap (pas d'iframe Google Maps).
6. Bandeau final d'appel à l'action et pied de page avec lien vers les mentions légales.

## Exigences techniques
${tech}
- Mobile d'abord, accessible (contrastes AA, focus visible, textes alternatifs, liens tel: et mailto:).
- SEO local : balise title « ${L.name} — ${info.label}${L.city ? ' à ' + L.city : ''} », meta description, Open Graph, et données structurées JSON-LD schema.org de type ${SCHEMA[L.kind] || 'LocalBusiness'} (adresse, téléphone, horaires en openingHoursSpecification${L.lat ? ', geo' : ''}).
- Aucun cookie ni traceur, donc pas de bannière de consentement.
- Performances : score Lighthouse mobile supérieur à 95.
- Page mentions légales avec des champs visibles à compléter : [Raison sociale], [Forme juridique], [SIRET], [Adresse du siège], [Directeur de la publication], [Hébergeur : nom, adresse, téléphone].

## Livraison
- ${tool === 'lovable' ? 'Publie le projet, puis explique-moi comment brancher un nom de domaine.' : 'Prépare le déploiement sur Netlify (glisser-déposer du dossier ou dépôt Git) et explique-moi comment brancher un nom de domaine comme ' + s + '.fr.'}
- Termine par la liste de ce que le gérant doit me fournir : photos, logo éventuel, SIRET, textes à valider.

Règles : n'invente ni avis, ni chiffres, ni dates, ni distinctions. S'il manque une information, laisse « [À compléter] » bien visible.
${tool === 'claude' ? '\nAvant de coder, résume ton plan en cinq lignes, puis construis tout sans t\'arrêter.' : ''}`;
}
