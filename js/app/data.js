/* PopSite — catalogue des activités, groupes et village de démonstration */

export const GROUPS = [
  { id: 'resto', label: 'Restauration' },
  { id: 'commerce', label: 'Commerces' },
  { id: 'beaute', label: 'Beauté & forme' },
  { id: 'artisan', label: 'Artisans' },
  { id: 'auto', label: 'Auto & vélo' },
  { id: 'hebergement', label: 'Hébergement' },
  { id: 'sante', label: 'Santé' },
  { id: 'services', label: 'Services' }
];
export const GROUP_LABEL = Object.fromEntries(GROUPS.map(g => [g.id, g.label]));

/* k : activité ; g : groupe ; cta : bouton principal ; svc : prestations de départ ; hook : accroche ;
   reg : profession réglementée (site informatif seulement) */
const K = (label, g, cta, hook, svc, reg) => ({ label, g, cta, hook, svc, reg: !!reg });
export const KINDS = {
  restaurant: K('Restaurant', 'resto', 'Réserver une table', 'Une table où l\'on revient.', ['Menu du jour', 'Carte de saison', 'Produits locaux', 'Groupes et repas de famille', 'Vente à emporter']),
  pizzeria: K('Pizzeria', 'resto', 'Commander', 'La pizza du quartier, au feu de bois.', ['Pizzas maison', 'À emporter', 'Pâte fraîche du jour', 'Desserts maison']),
  cafe: K('Café', 'resto', 'Nous trouver', 'Le café du coin, depuis le matin.', ['Petit-déjeuner', 'Boissons chaudes', 'Terrasse', 'Pâtisseries']),
  bar: K('Bar', 'resto', 'Nous trouver', 'Le rendez-vous du soir.', ['Bières pression', 'Vins au verre', 'Planches à partager', 'Soirées']),
  fast_food: K('Restauration rapide', 'resto', 'Commander', 'Vite fait, bien fait.', ['Burgers', 'Sandwichs', 'Menus', 'À emporter']),
  ice_cream: K('Glacier', 'resto', 'Nous trouver', 'Des glaces faites ici.', ['Glaces artisanales', 'Sorbets', 'Cornets et pots', 'Gâteaux glacés']),
  bakery: K('Boulangerie', 'commerce', 'Commander', 'Le pain du matin, cuit sur place.', ['Pains au levain', 'Viennoiseries', 'Pâtisseries', 'Commandes pour vos fêtes']),
  pastry: K('Pâtisserie', 'commerce', 'Commander un gâteau', 'Des gâteaux qui font les fêtes.', ['Entremets', 'Gâteaux sur commande', 'Macarons', 'Chocolats']),
  butcher: K('Boucherie', 'commerce', 'Commander', 'La viande choisie, coupée devant vous.', ['Viandes de la région', 'Charcuterie maison', 'Plats cuisinés', 'Colis et barbecues']),
  cheese: K('Fromagerie', 'commerce', 'Nous rendre visite', 'Des fromages affinés avec patience.', ['Fromages affinés', 'Plateaux sur commande', 'Crèmerie', 'Vins assortis']),
  deli: K('Traiteur', 'commerce', 'Demander un devis', 'Vos réceptions, préparées ici.', ['Plats du jour', 'Buffets', 'Mariages et fêtes', 'Plateaux repas']),
  seafood: K('Poissonnerie', 'commerce', 'Commander', 'L\'arrivage du jour.', ['Poissons frais', 'Fruits de mer', 'Plateaux sur commande', 'Conseils cuisson']),
  greengrocer: K('Primeur', 'commerce', 'Nous rendre visite', 'Des fruits et légumes de saison.', ['Fruits et légumes', 'Producteurs locaux', 'Paniers', 'Épicerie fine']),
  wine: K('Cave à vins', 'commerce', 'Nous rendre visite', 'Le bon vin, bien conseillé.', ['Vins de la région', 'Spiritueux', 'Dégustations', 'Coffrets cadeaux']),
  chocolate: K('Chocolatier', 'commerce', 'Commander', 'Du chocolat fait main.', ['Bonbons de chocolat', 'Tablettes', 'Coffrets', 'Créations de saison']),
  farm: K('Produits de la ferme', 'commerce', 'Nous rendre visite', 'De la ferme à votre table.', ['Vente directe', 'Produits de saison', 'Paniers', 'Visite de la ferme']),
  convenience: K('Épicerie', 'commerce', 'Nous trouver', 'L\'épicerie du village, ouverte pour vous.', ['Épicerie', 'Produits frais', 'Produits locaux', 'Dépannage']),
  florist: K('Fleuriste', 'commerce', 'Commander un bouquet', 'Des bouquets pour chaque occasion.', ['Bouquets', 'Mariages', 'Deuil', 'Plantes', 'Livraison locale']),
  clothes: K('Boutique de vêtements', 'commerce', 'Nous rendre visite', 'Des vêtements choisis un par un.', ['Femme', 'Homme', 'Accessoires', 'Retouches']),
  shoes: K('Chaussures', 'commerce', 'Nous rendre visite', 'Des chaussures pour chaque pas.', ['Ville', 'Confort', 'Enfant', 'Entretien']),
  books: K('Librairie', 'commerce', 'Commander un livre', 'Des livres conseillés par des lecteurs.', ['Romans', 'Jeunesse', 'Commandes', 'Rencontres d\'auteurs']),
  gift: K('Boutique cadeaux', 'commerce', 'Nous rendre visite', 'L\'idée cadeau, trouvée ici.', ['Décoration', 'Créateurs locaux', 'Papeterie', 'Paquets cadeaux']),
  hardware: K('Quincaillerie', 'commerce', 'Nous trouver', 'La bonne pièce et le bon conseil.', ['Outillage', 'Bricolage', 'Jardin', 'Reproduction de clés']),
  decoration: K('Décoration', 'commerce', 'Nous rendre visite', 'Des intérieurs qui vous ressemblent.', ['Mobilier', 'Linge de maison', 'Luminaires', 'Conseil déco']),
  antiques: K('Antiquaire', 'commerce', 'Nous rendre visite', 'Des objets qui ont une histoire.', ['Mobilier ancien', 'Objets d\'art', 'Estimation', 'Débarras']),
  newsagent: K('Tabac-presse', 'commerce', 'Nous trouver', 'Votre journal, chaque matin.', ['Presse', 'Papeterie', 'Jeux', 'Services de proximité']),
  pet: K('Animalerie', 'commerce', 'Nous rendre visite', 'Tout pour vos animaux.', ['Alimentation', 'Accessoires', 'Conseils', 'Toilettage']),
  garden: K('Jardinerie', 'commerce', 'Nous rendre visite', 'Votre jardin commence ici.', ['Plantes', 'Semences', 'Outillage', 'Conseils']),
  jewelry: K('Bijouterie', 'commerce', 'Prendre rendez-vous', 'Des bijoux pour les grands jours.', ['Bijoux', 'Montres', 'Réparations', 'Créations sur mesure']),
  computer: K('Informatique', 'commerce', 'Demander un dépannage', 'Votre informatique entre de bonnes mains.', ['Dépannage', 'Vente', 'Réparation', 'Installation']),
  sewing: K('Mercerie', 'commerce', 'Nous rendre visite', 'Le fil, l\'aiguille et le conseil.', ['Laines', 'Tissus', 'Mercerie', 'Ateliers']),
  shop: K('Boutique', 'commerce', 'Nous rendre visite', 'Votre boutique de quartier.', ['Nos produits', 'Conseils', 'Commandes', 'Cartes cadeaux']),
  hairdresser: K('Salon de coiffure', 'beaute', 'Prendre rendez-vous', 'La coupe qui vous va.', ['Coupe femme', 'Coupe homme', 'Couleur', 'Brushing', 'Enfants']),
  barber: K('Barbier', 'beaute', 'Prendre rendez-vous', 'Coupe nette, barbe soignée.', ['Coupe', 'Taille de barbe', 'Rasage', 'Soins']),
  beauty: K('Institut de beauté', 'beaute', 'Prendre rendez-vous', 'Un moment pour vous.', ['Soins du visage', 'Épilation', 'Manucure', 'Massages']),
  nails: K('Onglerie', 'beaute', 'Prendre rendez-vous', 'Des ongles impeccables.', ['Pose', 'Semi-permanent', 'Nail art', 'Beauté des pieds']),
  tattoo: K('Salon de tatouage', 'beaute', 'Prendre rendez-vous', 'Votre projet, dessiné pour vous.', ['Projets sur mesure', 'Flash', 'Retouches', 'Conseils soins']),
  massage: K('Massage et bien-être', 'beaute', 'Prendre rendez-vous', 'Relâchez la pression.', ['Massages', 'Relaxation', 'Bons cadeaux', 'Forfaits']),
  pet_grooming: K('Toilettage', 'beaute', 'Prendre rendez-vous', 'Votre animal, tout beau.', ['Bain', 'Coupe', 'Griffes', 'Toutes races']),
  fitness: K('Salle de sport', 'beaute', 'Réserver une séance', 'Venez vous entraîner près de chez vous.', ['Musculation', 'Cours collectifs', 'Coaching', 'Abonnements']),
  car_repair: K('Garage', 'auto', 'Prendre rendez-vous', 'Votre voiture, entre de bonnes mains.', ['Révision', 'Pneus', 'Freins', 'Climatisation', 'Contrôle avant vente']),
  body_shop: K('Carrosserie', 'auto', 'Demander un devis', 'Comme neuve, sans détour.', ['Carrosserie', 'Peinture', 'Pare-brise', 'Prise en charge assurance']),
  car: K('Vente automobile', 'auto', 'Voir les véhicules', 'Votre prochaine voiture est ici.', ['Véhicules d\'occasion', 'Reprise', 'Financement', 'Garantie']),
  tyres: K('Pneus', 'auto', 'Prendre rendez-vous', 'Les bons pneus, montés vite.', ['Pneus', 'Équilibrage', 'Géométrie', 'Stockage']),
  bicycle: K('Vélos', 'auto', 'Prendre rendez-vous', 'Remettez-vous en selle.', ['Réparation', 'Vente', 'Vélos électriques', 'Location']),
  motorcycle: K('Motos', 'auto', 'Prendre rendez-vous', 'Votre moto, bien entretenue.', ['Entretien', 'Vente', 'Équipement', 'Pneus']),
  driving_school: K('Auto-école', 'auto', 'S\'inscrire', 'Votre permis, sereinement.', ['Permis B', 'Conduite accompagnée', 'Code', 'Stages']),
  car_wash: K('Lavage auto', 'auto', 'Nous trouver', 'Votre voiture, comme au premier jour.', ['Lavage', 'Intérieur', 'Rénovation', 'Abonnements']),
  taxi: K('Taxi', 'auto', 'Réserver un taxi', 'On vous emmène, à l\'heure.', ['Gares et aéroports', 'Transport médical', 'Longue distance', 'Réservation']),
  carpenter: K('Menuisier', 'artisan', 'Demander un devis', 'Du bois travaillé sur mesure.', ['Fenêtres et portes', 'Escaliers', 'Agencement', 'Rénovation']),
  plumber: K('Plombier', 'artisan', 'Demander un devis', 'Une fuite ? On arrive.', ['Dépannage', 'Salle de bains', 'Chauffe-eau', 'Rénovation']),
  electrician: K('Électricien', 'artisan', 'Demander un devis', 'Votre installation, aux normes.', ['Dépannage', 'Mise aux normes', 'Rénovation', 'Bornes de recharge']),
  painter: K('Peintre', 'artisan', 'Demander un devis', 'Des murs comme neufs.', ['Peinture intérieure', 'Façades', 'Papier peint', 'Revêtements']),
  roofer: K('Couvreur', 'artisan', 'Demander un devis', 'Un toit solide au-dessus de vous.', ['Couverture', 'Zinguerie', 'Réparation', 'Isolation']),
  builder: K('Maçon', 'artisan', 'Demander un devis', 'Construire et rénover, dans les règles.', ['Maçonnerie', 'Rénovation', 'Extensions', 'Murets et dallages']),
  gardener: K('Paysagiste', 'artisan', 'Demander un devis', 'Des jardins qu\'on a envie de vivre.', ['Création de jardins', 'Entretien', 'Taille', 'Terrasses']),
  hvac: K('Chauffagiste', 'artisan', 'Demander un devis', 'Au chaud tout l\'hiver.', ['Chaudières', 'Pompes à chaleur', 'Entretien', 'Dépannage']),
  locksmith: K('Serrurier', 'artisan', 'Appeler', 'Porte claquée ? On ouvre.', ['Ouverture de porte', 'Serrures', 'Blindage', 'Clés']),
  shoemaker: K('Cordonnier', 'artisan', 'Nous trouver', 'Des chaussures qui durent.', ['Ressemelage', 'Clés', 'Maroquinerie', 'Entretien']),
  tailor: K('Couturière', 'artisan', 'Prendre rendez-vous', 'Ajusté à vous.', ['Retouches', 'Sur mesure', 'Ameublement', 'Réparations']),
  photographer: K('Photographe', 'artisan', 'Prendre rendez-vous', 'Vos moments, bien cadrés.', ['Portraits', 'Mariages', 'Photos d\'identité', 'Entreprises']),
  winery: K('Domaine viticole', 'artisan', 'Venir déguster', 'Nos vins, de la vigne au verre.', ['Dégustation', 'Vente au domaine', 'Visites', 'Expédition']),
  brewery: K('Brasserie artisanale', 'artisan', 'Nous rendre visite', 'Des bières brassées ici.', ['Bières maison', 'Vente sur place', 'Visites', 'Événements']),
  beekeeper: K('Apiculteur', 'artisan', 'Nous rendre visite', 'Le miel de nos ruches.', ['Miels', 'Pollen', 'Pain d\'épices', 'Coffrets']),
  cabinet_maker: K('Ébéniste', 'artisan', 'Demander un devis', 'Des meubles faits pour durer.', ['Meubles sur mesure', 'Restauration', 'Agencement', 'Marqueterie']),
  metal: K('Ferronnier', 'artisan', 'Demander un devis', 'Le métal, travaillé à la main.', ['Portails', 'Garde-corps', 'Escaliers', 'Réparations']),
  pottery: K('Potier', 'artisan', 'Visiter l\'atelier', 'Des pièces tournées à la main.', ['Vaisselle', 'Pièces uniques', 'Cours', 'Commandes']),
  craft: K('Artisan', 'artisan', 'Demander un devis', 'Un savoir-faire près de chez vous.', ['Réalisations', 'Devis gratuit', 'Rénovation', 'Conseil']),
  hotel: K('Hôtel', 'hebergement', 'Réserver', 'Une nuit au calme, au cœur du village.', ['Chambres', 'Petit-déjeuner', 'Parking', 'Séjours']),
  guest_house: K('Chambres d\'hôtes', 'hebergement', 'Réserver', 'Une maison où l\'on se sent reçu.', ['Chambres', 'Petit-déjeuner maison', 'Table d\'hôtes', 'Jardin']),
  gite: K('Gîte', 'hebergement', 'Réserver', 'Votre maison de vacances.', ['Location à la semaine', 'Week-ends', 'Équipements', 'Activités alentour']),
  camp_site: K('Camping', 'hebergement', 'Réserver', 'Des vacances au grand air.', ['Emplacements', 'Locations', 'Animations', 'Services']),
  pharmacy: K('Pharmacie', 'sante', 'Nous trouver', 'Votre pharmacie de proximité.', ['Conseil', 'Ordonnances', 'Parapharmacie', 'Matériel médical'], true),
  optician: K('Opticien', 'sante', 'Prendre rendez-vous', 'Voir bien, en toute simplicité.', ['Lunettes', 'Lentilles', 'Examen de la vue', 'Solaires']),
  physio: K('Kinésithérapeute', 'sante', 'Prendre rendez-vous', 'Retrouver le mouvement.', ['Rééducation', 'Massages', 'Sport', 'Domicile'], true),
  doctor: K('Cabinet médical', 'sante', 'Prendre rendez-vous', 'Votre cabinet de proximité.', ['Consultations', 'Horaires', 'Accès', 'Informations pratiques'], true),
  dentist: K('Dentiste', 'sante', 'Prendre rendez-vous', 'Votre cabinet dentaire.', ['Consultations', 'Horaires', 'Accès', 'Urgences'], true),
  vet: K('Vétérinaire', 'sante', 'Prendre rendez-vous', 'Prendre soin de vos animaux.', ['Consultations', 'Vaccins', 'Chirurgie', 'Urgences'], true),
  osteo: K('Ostéopathe', 'sante', 'Prendre rendez-vous', 'Soulager, rééquilibrer.', ['Adultes', 'Enfants', 'Sportifs', 'Femmes enceintes']),
  estate_agent: K('Agence immobilière', 'services', 'Faire estimer mon bien', 'Vendre, acheter, louer près de chez vous.', ['Estimation', 'Vente', 'Location', 'Gestion']),
  accountant: K('Expert-comptable', 'services', 'Prendre rendez-vous', 'Vos comptes, en confiance.', ['Comptabilité', 'Création d\'entreprise', 'Social', 'Fiscalité'], true),
  lawyer: K('Avocat', 'services', 'Prendre rendez-vous', 'Défendre vos intérêts.', ['Conseil', 'Contentieux', 'Famille', 'Travail'], true),
  notary: K('Notaire', 'services', 'Prendre rendez-vous', 'Vos actes, sécurisés.', ['Immobilier', 'Famille', 'Successions', 'Entreprises'], true),
  architect: K('Architecte', 'services', 'Prendre rendez-vous', 'Dessiner vos projets.', ['Maisons', 'Rénovation', 'Permis de construire', 'Suivi de chantier']),
  laundry: K('Pressing', 'services', 'Nous trouver', 'Vos vêtements, impeccables.', ['Nettoyage à sec', 'Repassage', 'Couettes', 'Retouches']),
  printing: K('Imprimerie', 'services', 'Demander un devis', 'Vos impressions, prêtes vite.', ['Cartes de visite', 'Flyers', 'Faire-part', 'Grand format']),
  travel: K('Agence de voyages', 'services', 'Prendre rendez-vous', 'Partez, on s\'occupe du reste.', ['Séjours', 'Circuits', 'Groupes', 'Billetterie']),
  funeral: K('Pompes funèbres', 'services', 'Nous contacter', 'À vos côtés, avec respect.', ['Organisation d\'obsèques', 'Prévoyance', 'Marbrerie', 'Fleurs']),
  service: K('Service', 'services', 'Nous contacter', 'À votre service, près de chez vous.', ['Prestations', 'Devis', 'Conseil', 'Rendez-vous'])
};

/* tags OSM -> activité */
const SHOP = {
  bakery: 'bakery', pastry: 'pastry', confectionery: 'chocolate', chocolate: 'chocolate', butcher: 'butcher', cheese: 'cheese', dairy: 'cheese', deli: 'deli', seafood: 'seafood', greengrocer: 'greengrocer', farm: 'farm',
  wine: 'wine', alcohol: 'wine', beverages: 'wine', convenience: 'convenience', supermarket: 'convenience', general: 'convenience', florist: 'florist', clothes: 'clothes', boutique: 'clothes', fashion: 'clothes',
  shoes: 'shoes', books: 'books', gift: 'gift', art: 'gift', craft: 'gift', hardware: 'hardware', doityourself: 'hardware', interior_decoration: 'decoration', furniture: 'decoration', houseware: 'decoration',
  antiques: 'antiques', second_hand: 'antiques', newsagent: 'newsagent', tobacco: 'newsagent', pet: 'pet', garden_centre: 'garden', jewelry: 'jewelry', watches: 'jewelry', computer: 'computer', electronics: 'computer', mobile_phone: 'computer',
  sewing: 'sewing', fabric: 'sewing', hairdresser: 'hairdresser', beauty: 'beauty', cosmetics: 'beauty', perfumery: 'beauty', tattoo: 'tattoo', massage: 'massage', pet_grooming: 'pet_grooming',
  car_repair: 'car_repair', car: 'car', car_parts: 'car_repair', tyres: 'tyres', bicycle: 'bicycle', motorcycle: 'motorcycle', optician: 'optician', hearing_aids: 'optician', dry_cleaning: 'laundry', laundry: 'laundry',
  copyshop: 'printing', travel_agency: 'travel', funeral_directors: 'funeral', photo: 'photographer', frame: 'gift', toys: 'gift', sports: 'clothes', music: 'gift', kitchen: 'decoration', bed: 'decoration', stationery: 'books',
  tea: 'gift', coffee: 'gift', spices: 'gift', health_food: 'greengrocer', organic: 'greengrocer', variety_store: 'shop', kiosk: 'newsagent'
};
const AMENITY = {
  restaurant: 'restaurant', cafe: 'cafe', bar: 'bar', pub: 'bar', biergarten: 'bar', fast_food: 'fast_food', ice_cream: 'ice_cream', pharmacy: 'pharmacy', doctors: 'doctor', clinic: 'doctor', dentist: 'dentist',
  veterinary: 'vet', driving_school: 'driving_school', car_wash: 'car_wash', taxi: 'taxi'
};
const CRAFT = {
  carpenter: 'carpenter', joiner: 'carpenter', window_construction: 'carpenter', plumber: 'plumber', electrician: 'electrician', painter: 'painter', roofer: 'roofer', builder: 'builder', stonemason: 'builder',
  tiler: 'builder', plasterer: 'painter', gardener: 'gardener', landscaper: 'gardener', hvac: 'hvac', heating_engineer: 'hvac', locksmith: 'locksmith', key_cutter: 'locksmith', shoemaker: 'shoemaker',
  tailor: 'tailor', dressmaker: 'tailor', upholsterer: 'tailor', photographer: 'photographer', winery: 'winery', brewery: 'brewery', beekeeper: 'beekeeper', cabinet_maker: 'cabinet_maker',
  metal_construction: 'metal', blacksmith: 'metal', pottery: 'pottery', caterer: 'deli', confectionery: 'chocolate', bakery: 'bakery', hairdresser: 'hairdresser', car_repair: 'car_repair'
};
const OFFICE = { estate_agent: 'estate_agent', accountant: 'accountant', tax_advisor: 'accountant', lawyer: 'lawyer', notary: 'notary', architect: 'architect', travel_agent: 'travel', insurance: 'service' };
const TOURISM = { hotel: 'hotel', motel: 'hotel', guest_house: 'guest_house', chalet: 'gite', apartment: 'gite', camp_site: 'camp_site', hostel: 'hotel' };
const HEALTH = { physiotherapist: 'physio', osteopath: 'osteo', alternative: 'osteo', optometrist: 'optician', dentist: 'dentist', doctor: 'doctor' };

export function kindOf(t) {
  if (t.shop === 'hairdresser' && /barb/i.test(t.name || '')) return 'barber';
  if (t.amenity === 'restaurant' && /pizz/i.test((t.cuisine || '') + ' ' + (t.name || ''))) return 'pizzeria';
  if (t.shop === 'car_repair' && /carross/i.test(t.name || '')) return 'body_shop';
  if (t.shop === 'beauty' && t.beauty === 'nails') return 'nails';
  if (t.tourism === 'guest_house' && /g[iî]te/i.test(t.name || '')) return 'gite';
  if (t.leisure === 'fitness_centre') return 'fitness';
  if (t.craft && CRAFT[t.craft]) return CRAFT[t.craft];
  if (t.shop && SHOP[t.shop]) return SHOP[t.shop];
  if (t.amenity && AMENITY[t.amenity]) return AMENITY[t.amenity];
  if (t.healthcare && HEALTH[t.healthcare]) return HEALTH[t.healthcare];
  if (t.office && OFFICE[t.office]) return OFFICE[t.office];
  if (t.tourism && TOURISM[t.tourism]) return TOURISM[t.tourism];
  if (t.craft) return 'craft';
  if (t.shop) return 'shop';
  if (t.office) return 'service';
  return null;
}
export const kindInfo = k => KINDS[k] || KINDS.service;

/* ---------- village de démonstration (aperçu sans réseau) ---------- */
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const DEMO_NONE = [
  ['Garage Perrin', 'car_repair', 'Mo-Fr 08:00-12:00,14:00-18:30; Sa 09:00-12:00'], ['Chez Lucette', 'bar', 'Mo-Sa 07:00-20:00; Su 08:00-13:00'], ['Coiffure Mylène', 'hairdresser', 'Tu-Fr 09:00-12:00,14:00-19:00; Sa 08:30-16:00'],
  ['Boucherie Vasseur', 'butcher', 'Tu-Sa 07:30-12:30,15:00-19:00; Su 08:00-12:00'], ['Le Fournil d\'Élise', 'bakery', 'Tu-Sa 06:30-13:00,15:30-19:30; Su 07:00-12:30'], ['Fleurs & Saisons', 'florist', 'Tu-Sa 09:00-12:30,14:30-19:00; Su 09:00-12:30'],
  ['Cordonnerie Bastien', 'shoemaker', 'Tu-Sa 09:00-12:00,14:00-18:30'], ['Pizza Nino', 'pizzeria', 'Tu-Su 18:00-22:00'], ['L\'Atelier du Cycle', 'bicycle', 'Tu-Sa 09:00-12:00,14:00-18:00'],
  ['Plomberie Girard', 'plumber', 'Mo-Fr 08:00-18:00'], ['Au Fil d\'Agathe', 'sewing', 'Tu-Sa 09:30-12:00,14:00-18:30'], ['Le Petit Zinc', 'bar', 'Mo-Sa 08:00-21:00'],
  ['Toilettage Câlin', 'pet_grooming', 'Tu-Sa 09:00-18:00'], ['Menuiserie Roche', 'carpenter', 'Mo-Fr 08:00-12:00,13:30-17:30'], ['Épicerie Colette', 'convenience', 'Mo-Sa 08:00-12:30,15:00-19:30; Su 09:00-12:00'],
  ['Barbier Malo', 'barber', 'Tu-Sa 09:00-19:00'], ['Carrosserie Duval', 'body_shop', 'Mo-Fr 08:00-12:00,14:00-18:00'], ['La Table d\'Odile', 'restaurant', 'Tu-Sa 12:00-14:00,19:00-21:30; Su 12:00-14:00'],
  ['Pressing du Centre', 'laundry', 'Mo-Fr 09:00-12:00,14:00-19:00; Sa 09:00-12:00'], ['Électricité Brun', 'electrician', 'Mo-Fr 08:00-18:00'], ['Institut Maëlle', 'beauty', 'Tu-Fr 09:30-19:00; Sa 09:00-17:00'],
  ['Fromagerie Lacombe', 'cheese', 'Tu-Sa 08:30-12:30,15:00-19:00'], ['Taxi Fabre', 'taxi', 'Mo-Su 06:00-22:00']
];
const DEMO_SITE = [
  ['Pharmacie Lemoine', 'pharmacy'], ['Boulangerie Martin', 'bakery'], ['Café du Commerce', 'cafe'], ['Librairie Vauban', 'books'], ['Optique Garnier', 'optician'], ['Crêperie du Lavoir', 'restaurant'],
  ['Quincaillerie Morel', 'hardware'], ['Brasserie de la Place', 'restaurant'], ['Le Bon Grain', 'greengrocer'], ['Primeur Rossi', 'greengrocer'], ['Auto-École Leroy', 'driving_school'], ['Bijouterie Faure', 'jewelry'],
  ['Pâtisserie Moreau', 'pastry'], ['Laverie du Pont', 'laundry'], ['Maison de la Presse', 'newsagent'], ['Chocolaterie Ravel', 'chocolate'], ['Agence Delmas Immobilier', 'estate_agent'], ['Pizzeria Bella', 'pizzeria'],
  ['Droguerie Payet', 'hardware'], ['Salon de Thé Rose', 'cafe'], ['Boucherie Girard', 'butcher'], ['Épicerie Fine Odette', 'deli'], ['Herboristerie Sauge', 'beauty'], ['Le Comptoir', 'bar'],
  ['Restaurant Le Lion', 'restaurant'], ['Bistrot Chez Paul', 'restaurant'], ['Caviste Bernard', 'wine'], ['Poissonnerie Marée', 'seafood'], ['Papeterie Lefèvre', 'books'], ['Coiffure Élodie', 'hairdresser'],
  ['Hôtel du Commerce', 'hotel'], ['Domaine des Coteaux', 'winery'], ['Gîte des Tilleuls', 'gite'], ['Cabinet Kiné Rivière', 'physio'], ['Vétérinaire des Prés', 'vet'], ['Garage Central', 'car_repair'],
  ['Fitness Club 71', 'fitness'], ['Studio Photo Lumière', 'photographer']
];

const DEMO_CENTER = { lat: 46.5641, lon: 4.6720 };
export const DEMO_LABEL = 'Saint-Pop, village de démo';
export const DEMO_CITY = 'Saint-Pop';

function demoRoads(r) {
  const R = rng(7), roads = [];
  const toLL = (x, y) => [DEMO_CENTER.lat - y / 110540, DEMO_CENTER.lon + x / (111320 * Math.cos(DEMO_CENTER.lat * Math.PI / 180))];
  const line = (pts, cls) => roads.push({ c: cls, p: pts.map(p => toLL(p[0], p[1])) });
  // grandes routes qui traversent le village
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + R() * .5, pts = [];
    let x = 0, y = 0, d = a;
    for (let s = 0; s < 40; s++) { pts.push([x, y]); d += (R() - .5) * .18; x += Math.cos(d) * r * .045; y += Math.sin(d) * r * .045; }
    line(pts, k < 2 ? 1 : 2);
  }
  // rues du bourg : quadrillage déformé, plus serré au centre
  const N = 7;
  for (let i = -N; i <= N; i++) {
    const a = [], b = [];
    for (let j = -N; j <= N; j++) {
      const w = (u, v) => { const x = u * 48 + Math.sin(v * .8 + u * .3) * 12, y = v * 48 + Math.cos(u * .6 + v * .4) * 12; return [x, y]; };
      a.push(w(i, j)); b.push(w(j, i));
    }
    const cut = Math.abs(i) > 4 ? 3 : Math.abs(i) > 2 ? 1 : 0;
    line(a.slice(cut + (R() * 2 | 0), a.length - cut - (R() * 2 | 0)), Math.abs(i) === 0 ? 2 : 3);
    line(b.slice(cut + (R() * 2 | 0), b.length - cut - (R() * 2 | 0)), Math.abs(i) === 0 ? 2 : 3);
  }
  // hameaux et chemins
  for (let k = 0; k < 44; k++) {
    const a = R() * Math.PI * 2, d0 = r * (.3 + R() * .6), pts = [];
    let x = Math.cos(a) * d0, y = Math.sin(a) * d0, dir = a + Math.PI / 2 + (R() - .5);
    for (let s = 0; s < 8; s++) { pts.push([x, y]); dir += (R() - .5) * .5; x += Math.cos(dir) * 60; y += Math.sin(dir) * 60; }
    line(pts, 3);
  }
  return roads;
}

export function demoScan(radius) {
  const R = rng(1234), items = [], r = Math.min(radius, 1500);
  const place = (k, n) => {
    const d = (k < 10 ? 60 + R() * 300 : 120 + Math.pow(R(), 1.15) * r * .88), a = R() * Math.PI * 2;
    const x = Math.cos(a) * d, y = Math.sin(a) * d;
    return { lat: DEMO_CENTER.lat - y / 110540, lon: DEMO_CENTER.lon + x / (111320 * Math.cos(DEMO_CENTER.lat * Math.PI / 180)), dist: Math.round(d) };
  };
  const streets = ['rue des Tanneurs', 'place de l\'Église', 'Grande Rue', 'rue du Lavoir', 'rue de la Poste', 'chemin des Vignes', 'rue du Moulin', 'place du Marché', 'rue des Écoles', 'route de Cluny'];
  DEMO_NONE.forEach((n, k) => {
    const p = place(k), tags = { name: n[0], opening_hours: n[2], phone: '03 53 73 ' + String(10 + k * 3).padStart(2, '0') + ' ' + String(20 + k * 7 % 80).padStart(2, '0') };
    if (k % 5 === 1) tags['contact:facebook'] = 'https://www.facebook.com/';
    if (k % 4 === 2) tags.email = 'contact@exemple.fr';
    items.push({ id: 'd' + (k + 1), name: n[0], kind: n[1], tags, lat: p.lat, lon: p.lon, dist: k === 0 ? 350 : p.dist, addr: (k === 0 ? 12 : 1 + (k * 7) % 40) + ' ' + streets[k % streets.length], city: DEMO_CITY, web: tags['contact:facebook'] ? 'social' : 'none' });
  });
  DEMO_SITE.forEach((n, k) => {
    const p = place(k + 23);
    items.push({ id: 'd' + (k + 100), name: n[0], kind: n[1], tags: { name: n[0], website: 'https://exemple.fr' }, lat: p.lat, lon: p.lon, dist: p.dist, addr: (3 + k * 5 % 50) + ' ' + streets[(k + 3) % streets.length], city: DEMO_CITY, web: 'site' });
  });
  return { center: DEMO_CENTER, label: DEMO_LABEL, items, roads: demoRoads(r) };
}
