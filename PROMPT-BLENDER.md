# Tâche : modéliser les bâtiments du village dans Blender (via Blender MCP)

Avec Blender MCP, modélise des bâtiments de village français pour la scène 3D de ce site (three.js, voir src/landing/world.js).

## À créer (un objet par bâtiment)
- maison-a à maison-e : 5 maisons de bourg différentes, 2 ou 3 étages, murs légèrement biseautés, fenêtres en retrait avec encadrement, volets, porte, toit à deux pans en tuiles avec débord, une cheminée sur certaines.
- boutique-a et boutique-b : même style, mais avec un rez-de-chaussée commercial : grande vitrine, porte vitrée, auvent, et un panneau d'enseigne vide au-dessus de la vitrine.
- eglise : nef + clocher avec flèche.

## Contraintes à respecter exactement
- 1 unité = 1 mètre. Emprise au sol : 4 à 6,5 m de large, 6 à 8 m de profondeur, 6 à 11 m de haut (église plus grande).
- Origine de chaque objet au centre de l'emprise, au niveau du sol.
- Façade principale tournée vers -Y dans Blender (ça donne +Z dans three.js).
- Style stylisé et propre, pas de textures : couleurs unies seulement.
- Moins de 4 000 triangles par bâtiment.
- Noms de matériaux obligatoires : Mur, Toit, Encadrement, Volet, Porte, Fenetre (les carreaux), Vitrine, Enseigne. Le site s'en sert pour allumer les fenêtres et les vitrines.
- Export : un .glb par bâtiment dans assets/models/ (ex : assets/models/maison-a.glb), modificateurs appliqués, axe Y vers le haut, sans caméra ni lumière, avec compression Draco si possible.

## À la fin
Aligne tous les bâtiments côte à côte dans la scène Blender et fais-moi une capture de la vue 3D.
Ne pousse rien sur GitHub tant que je n'ai pas validé.
