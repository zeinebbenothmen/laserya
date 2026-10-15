# Rapport de comparaison — Laserya en ligne et projet local

**Date du relevé : 14 octobre 2026**  
**Site de référence :** [laserya.fr](https://www.laserya.fr/)  
**Catalogue observé :** [Nouveautés / catalogue](https://www.laserya.fr/collections/nouveautes)

## Résumé

Le projet local est une boutique sur mesure pour Laserya, développée en Node.js/Express avec pages HTML et une base SQLite locale. Le site en ligne est la boutique Shopify actuellement exploitée. Le projet local offre déjà des outils internes qui vont au-delà d'une simple vitrine, en particulier pour les commandes personnalisées, l'impression 3D et le suivi de production.

Le catalogue public a été réimporté depuis Shopify pendant ce relevé. Shopify a renvoyé **269 fiches**; l'importeur en a **ajouté 42 et actualisé 227**. La base locale contient maintenant **266 produits actifs**, tous avec une image et une galerie enregistrée. La page publique « Nouveautés » affichait **267 articles** au moment de la consultation. Les comptages n'étant pas identiques, une réconciliation par identifiant Shopify/handle reste nécessaire avant de considérer le catalogue local comme une copie exacte.

## Comparaison fonctionnelle

| Domaine | Site actuel en ligne | Projet local après import | Écart / suite utile |
|---|---|---|---|
| Catalogue | Shopify, environ 267 articles dans la collection consultée; filtres de disponibilité et de prix, tri par popularité, nom, prix et date. | 266 produits actifs, recherche/filtrage par catégories, pages boutique et fiche produit, données enregistrées localement. | Les articles sont présents, mais le projet ne reprend pas les collections Shopify telles que « Shop By Anime », « Packs & offres » et les univers thématiques. Les 6 catégories calculées localement sont très larges. |
| Mise en avant | Nouveautés, collections anime, univers gaming/auto/cadeau, produits vedettes. | Accueil avec produits mis en avant et pages d'idées cadeaux/recherche. | Réorganiser l'accueil autour des collections et nouveautés réellement utilisées en ligne. |
| Offres | Promotions par produit et remises visibles selon quantité (jusqu'à 20 % sur certaines offres). | Les prix barrés sont importés; la boutique peut afficher un prix promotionnel. | Les remises de panier par quantité et les packs doivent être reproduits côté panier/commande si l'on veut une parité commerciale. |
| Fiche produit | Variantes et choix de modèle/couleur, galeries, avis affichés sur certaines fiches, ajout au panier. | Galerie, modèles importés pour des produits à variantes, options de personnalisation nom/date et aperçu sur l'image. | Le configurateur local peut mieux gérer la gravure personnalisée; il faut vérifier que chaque variante Shopify est bien exploitable au panier et que les options requises correspondent au bon produit. |
| Panier et paiement | Parcours Shopify; le site met en avant la livraison en Tunisie et le paiement à la livraison. | Panier et tunnel local en plusieurs étapes; le code prévoit le paiement à la livraison. | Comparer et aligner frais, délais, choix de livraison, remises, e-mails et confirmations avec les règles réelles de la boutique. |
| Commandes et suivi | Commandes gérées par Shopify; espace client et notifications Shopify. | Commandes dans la base locale, espace admin, e-mail de confirmation prévu et recherche de commande par code de suivi. | Le suivi est un avantage local; il faudra définir le processus opérationnel si les commandes arrivent aussi sur Shopify. |
| Personnalisation / impression 3D | Le site invite à contacter Laserya pour les demandes sur mesure; vente de produits finis. | Formulaires de demande personnalisée, téléversement de fichiers 3D, demandes de devis, estimation, gestion des imprimantes et filaments, tableau de production. | C'est le principal avantage fonctionnel du projet local. Il faut raccorder clairement ces parcours depuis la navigation et vérifier les e-mails de réception/réponse. |
| Administration | Administration Shopify, non publique. | Tableau de bord, catalogue, commandes, analyses, demandes, atelier, bobines et imprimantes. | L'admin local est plus adapté à la fabrication; il lui manque une synchronisation robuste avec Shopify pour éviter deux catalogues et deux files de commandes divergents. |
| Confiance et contenu | Bandeaux de livraison, paiement à la livraison, fabrication, avis, FAQ, politiques et inscription e-mail. | Pages de contact, FAQ/contenu et politiques à vérifier; certaines pages plus anciennes utilisent encore des textes ou visuels de démonstration. | Compléter les preuves de confiance, les coordonnées, politiques et contenus, puis retirer/mettre à jour les pages de démonstration. |

## État du catalogue local

Répartition actuelle des **266 produits actifs** (catégories attribuées automatiquement par le script d'import) :

- Lampes LED : 187
- Porte-clés : 28
- Accessoires : 19
- Autres : 13
- Figurines 3D : 12
- Cadeaux : 7

Le déséquilibre « 187 lampes LED » indique que cette classification par mots-clés est trop simpliste pour la navigation actuelle, qui est organisée autour d'anime, packs, gaming, cadeaux, lampes et objets déco. L'importeur conserve les URL d'images Shopify et ne télécharge pas les fichiers image dans le projet.

## Écarts techniques à traiter avant une mise en ligne

1. **Réconciliation du catalogue** — comparer les fiches par identifiant Shopify/handle plutôt que par nom; l'import utilise le nom comme clé, et les totaux 269/267/266 ne concordent pas.
2. **Synchronisation** — l'import est un script manuel, pas une synchronisation; il ajoute/actualise des fiches mais ne retire pas les produits supprimés ou dépubliés de Shopify.
3. **Stock** — lorsque Shopify ne fournit pas de quantité, le script attribue un stock local de secours à 10. Ne pas utiliser ces quantités pour promettre une disponibilité réelle avant vérification.
4. **Collections et promos** — importer les collections/tags de façon structurée, puis mettre en place les mêmes remises par quantité que celles visibles sur le site.
5. **Commandes** — choisir une source de vérité (Shopify ou projet local) et éviter le double traitement des commandes; préciser le fonctionnement des confirmations, annulations et statuts.
6. **Contenu et design** — aligner accueil, navigation, fiches produits, français, TND, livraison et messages de confiance; remplacer les illustrations placeholders des anciennes pages.
7. **Vérification avant publication** — parcourir les parcours boutique, panier, paiement à la livraison, suivi, formulaire sur mesure et demande de devis 3D, sur mobile et ordinateur.

## Ordre de travail recommandé

**Priorité 1 — Catalogue fiable :** réconciliation par identifiant, collections, variantes, état actif et stock réel.  
**Priorité 2 — Vente :** accueil/nav alignés, fiches complètes, promotions de quantité, panier et livraison cohérents.  
**Priorité 3 — Opérations :** décision de synchronisation des commandes et validation des e-mails/statuts.  
**Priorité 4 — Finition :** contenus et politiques, pages de démonstration, responsive et vérification de bout en bout.

