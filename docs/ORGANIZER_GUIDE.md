# Guide de l'organisateur

Ce guide explique comment utiliser l'application pour organiser et gérer un tournoi de **Terraforming Mars** de A à Z.

> Rôles : **Admin** (droits complets, validation finale), **Organisateur** (gère les tournois au jour le jour), **Joueur** (scanne un QR code, saisit ses scores).

---

## 1. Se connecter

1. Ouvrir l'application dans un navigateur.
2. Se connecter avec vos identifiants organisateur fournis par l'administrateur.
3. Vous arrivez sur le **Tableau de bord** listant tous les tournois existants.

Chaque tournoi affiche son statut :

- **Brouillon** (orange) — en cours de création, aucune ronde jouée.
- **En cours** (bleu) — tournoi démarré, des rondes sont en cours.
- **Fini** (vert) — tournoi terminé, les résultats sont figés.

---

## 2. Créer un tournoi

1. Cliquer sur **Créer un tournoi** en haut à droite du tableau de bord.
2. Remplir le formulaire :
   - **Nom du tournoi** (ex. « CdF Régionale Lyon »).
   - **Date de l'événement**.
   - **Logo du tournoi** (optionnel) — PNG/SVG, max 800 ko, fond transparent recommandé. Ce logo apparaîtra sur la page publique, sur les écrans des joueurs et sur les affiches imprimées.
3. Ajouter les joueurs un par un :
   - Prénom, Nom, Email, Téléphone.
   - Les informations servent pour l'export et la communication post-tournoi.
4. Choisir l'action :
   - **Enregistrer comme brouillon** — permet de revenir ajouter/modifier des joueurs plus tard.
   - **Démarrer le tournoi** — génère automatiquement la **Ronde 1** et passe le statut à *En cours*.

> Le format (Swiss ou élimination) et le nombre de rondes sont déterminés automatiquement selon le nombre de joueurs.

---

## 3. Gérer les joueurs avant le démarrage (statut *Brouillon*)

Tant que le tournoi est en brouillon, vous pouvez :

- Ajouter de nouveaux joueurs.
- Supprimer des joueurs.
- Modifier le logo, le nom, la date.

Une fois le tournoi démarré, certaines modifications sont restreintes (voir §7).

---

## 4. Distribuer le QR code aux tables

Une fois la ronde générée, chaque **table** peut accueillir ses joueurs via un QR code unique.

1. Ouvrir le tournoi depuis le tableau de bord.
2. À côté de la ronde courante, cliquer sur **Voir le QR code**.
3. Deux options :
   - **Afficher à l'écran** — les joueurs peuvent scanner directement depuis votre écran.
   - **Imprimer (A4)** — bouton dans la modale. Ouvre une page A4 prête à imprimer contenant :
     - Le logo CdF
     - Le logo du tournoi
     - Le nom du tournoi
     - La date
     - Le QR code
   Le navigateur ouvre automatiquement la boîte de dialogue d'impression. Idéal pour poser une affiche sur chaque table.

Chaque joueur scanne le QR code, choisit sa table, et saisit ses scores détaillés.

---

## 5. Valider les scores remontés par les joueurs

Dès qu'une table soumet ses scores, sa carte sur le tableau de bord passe en statut **En attente** (jaune) avec le détail complet :

- Corporation de chaque joueur
- Points NT, Objectifs, Récompenses, Forêts, Villes, Cartes
- Tiebreaker (mégacrédits)

Trois actions possibles :

### a. Valider
Cliquer sur **Valider** si les scores sont corrects. La table passe en **Validé** (vert) et les points de placement sont ajoutés au score global des joueurs.

### b. Modifier
Cliquer sur **Modifier** pour corriger des erreurs de saisie sans rejeter toute la carte.

- Les champs de tous les joueurs deviennent éditables.
- Ajustez les valeurs nécessaires (NT, Objectifs, Tiebreaker, etc.).
- Cliquer sur **Valider les modifications** : les points de placement sont recalculés automatiquement et la table est validée.
- **Annuler** pour sortir sans sauvegarder.

### c. Ne rien faire pour l'instant
La table reste en attente. Vous pourrez y revenir plus tard.

> Le bouton **Générer Ronde N+1** n'est disponible **qu'une fois toutes les tables de la ronde courante validées**.

---

## 6. Passer à la ronde suivante

Quand toutes les tables sont validées :

1. Cliquer sur **Générer Ronde N+1** en haut du bloc Rondes & Tables.
2. L'application génère automatiquement :
   - Les nouveaux appariements (Swiss : par score ; élimination : selon le tableau).
   - Les nouveaux QR codes.
3. Distribuer à nouveau les QR codes (voir §4).

---

## 7. Gestion en cours de tournoi (statut *En cours*)

- **Ajouter un joueur** : désactivé après démarrage.
- **Retirer un joueur** (Admin uniquement) : possible, à condition que le nombre restant reste jouable. Les appariements de la ronde courante sont régénérés si nécessaire.
- **Corriger un score déjà validé** : voir §8.

---

## 8. Corriger un score déjà validé

Si une erreur est détectée **après** validation d'une table, contactez un **Admin** : seule une intervention admin permet actuellement de rouvrir une table validée.

> Astuce : dans la mesure du possible, toujours vérifier le détail de la carte (corporation + NT) **avant** de cliquer sur Valider.

---

## 9. Fin de tournoi

Lorsque **toutes les tables de la dernière ronde** sont validées :

- Le statut passe automatiquement à **Fini** (vert).
- La bannière **Joueurs Qualifiés** apparaît avec la liste des qualifiés (selon le format).
- Deux actions disponibles :
  - **Exporter le top N (CSV)** — télécharge la liste des qualifiés (nom, email, téléphone, score). Utile pour la communication post-tournoi.
  - **Planifier la Finale CdF** (Admin uniquement) — crée automatiquement un tournoi « CdF Finale 2026 » en brouillon contenant les qualifiés.

---

## 10. Bonnes pratiques

- **Imprimez le QR code A4** à l'avance pour chaque table : évite les problèmes de charge écran/batterie.
- **Vérifiez le détail** de chaque carte avant de valider (corporation saisie, tiebreaker renseigné en cas d'égalité).
- **Ne générez pas la ronde suivante** tant qu'une table en attente n'est pas tranchée.
- **Rafraîchissez** le tableau de bord (bouton *Refresh* en haut à droite) en cas de doute sur l'état en temps réel — utile si plusieurs organisateurs travaillent en parallèle.
- **Gardez la liste des joueurs à jour** : emails et téléphones servent à l'export et à la communication.

---

## 11. Dépannage rapide

| Problème | Solution |
| --- | --- |
| Un joueur ne peut pas scanner le QR code | Vérifier la connexion Wi-Fi, régénérer et réimprimer le QR. |
| Les scores d'un joueur sont faux | **Modifier** (§5.b) pour corriger avant validation. Après validation, contacter un Admin. |
| Le logo du tournoi ne s'affiche pas | Vérifier la taille (< 800 ko) et le format (PNG/SVG). Re-téléverser si besoin. |
| *Générer Ronde N+1* est grisé | Une ou plusieurs tables de la ronde courante ne sont pas encore **Validé**. |
| La page semble figée | Cliquer sur **Refresh** en haut à droite du tournoi. |

---

## 12. Glossaire

- **Ronde** : un tour d'appariements. Chaque tournoi a un nombre fixe de rondes.
- **Table** : un match de 3 ou 4 joueurs dans une ronde.
- **Scorecard** : carte détaillée contenant les points NT, Objectifs, etc.
- **Points de placement** : 5/3/2/1 selon le classement de la table (3/2 pour une table de 3 joueurs), +1 bonus si le joueur est à ≤ 5 pts du vainqueur.
- **Tiebreaker** : mégacrédits, utilisés pour départager les joueurs à égalité de score NT.
- **Qualifié** : joueur qui accède à la finale CdF, selon les règles du format.

---

_Dernière mise à jour : avril 2026._
