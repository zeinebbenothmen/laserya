# Laserya.tn

Laserya.tn est une boutique en ligne consacrée aux objets personnalisés, à la gravure laser et à l’impression 3D. Le projet réunit un espace client pour découvrir et commander des créations, ainsi qu’un espace d’administration pour gérer les ventes et la production.

## Fonctionnalités pour les clients

- **Découvrir la boutique** : parcourir les produits, collections et catégories, rechercher des articles et consulter des idées cadeaux.
- **Personnaliser une création** : décrire un projet sur mesure et transmettre des références pour demander une fabrication adaptée.
- **Estimer une impression 3D** : coller le lien public d’un modèle trouvé sur MakerWorld, Printables, Thingiverse ou un autre site, indiquer les dimensions souhaitées en centimètres et choisir la quantité. L’analyse assistée par IA contribue à produire une estimation globale du prix, sans afficher le détail des coûts.
- **Commander en ligne** : ajouter des articles au panier, vérifier la commande, saisir les informations de livraison et suivre la confirmation.
- **Retrouver ses choix** : gérer une liste de souhaits et conserver des créations enregistrées.
- **Contacter Laserya** : envoyer une demande ou une question depuis la page de contact.

L’estimation d’impression 3D est indicative. Elle s’appuie sur les dimensions saisies et un profil de fabrication moyen; le lien du modèle aide à évaluer sa complexité, mais le fichier 3D lui-même n’est pas téléchargé ni analysé géométriquement.

## Fonctionnalités d’administration

- Gérer le catalogue, les produits et leur disponibilité.
- Consulter les commandes, leurs montants et leurs statuts.
- Traiter les demandes de personnalisation et les demandes d’impression 3D.
- Organiser le travail avec le tableau de production.
- Suivre les stocks de filament et gérer les imprimantes enregistrées.
- Consulter les indicateurs de vente, les statistiques et les produits les plus commandés.

Le suivi en direct des imprimantes Bambu Lab utilise leur connexion MQTT sur le réseau local de l’atelier.

## Technologies

- **Interface** : HTML, CSS, Tailwind CSS et JavaScript.
- **Serveur et API** : Node.js et Express.
- **Données** : SQLite avec sql.js.
- **Estimation 3D assistée par IA** : API OpenAI Responses avec recherche Web pour consulter les liens publics de modèles.
- **Suivi des imprimantes** : MQTT pour les appareils Bambu Lab accessibles sur le réseau local.
