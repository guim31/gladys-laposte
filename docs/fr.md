# La Poste

Suivez vos colis La Poste dans Gladys : Colissimo, Chronopost et lettres suivies, par l'API officielle de suivi de
La Poste (« Suivi » v2).

> **Développée sans le matériel** (ici : sans clé d'API La Poste) : vos retours sont les bienvenus sur le
> [forum Gladys](https://community.gladysassistant.com/). Les réponses de l'API ont été simulées d'après sa
> documentation.

## Ce que fait l'intégration

- Vous ajoutez un colis par son numéro de suivi (et un nom si vous voulez), depuis la configuration ou depuis une
  scène.
- L'intégration lit son statut chez La Poste toutes les 30 minutes (réglable), et s'arrête une fois le colis livré.
- Un appareil « Colis La Poste » donne les compteurs (en cours, en cours de livraison, à retirer, problèmes, livrés
  récemment) et une phrase de résumé.
- Le widget « Mes colis » liste vos colis avec leur statut, leur dernière étape et sa date.
- Quatre déclencheurs de scène : en cours de livraison, livré, à retirer, problème. Deux actions de scène : suivre un
  colis, lire l'état de mes colis.
- Un colis livré quitte la liste tout seul au bout de 7 jours (réglable).

## Prérequis

- Gladys 5.1.0 ou plus récent.
- Une clé d'API La Poste, gratuite :
  1. créez un compte sur [developer.laposte.fr](https://developer.laposte.fr/) ;
  2. ouvrez l'[API Suivi](https://developer.laposte.fr/products/suivi/latest) et abonnez-vous à son offre gratuite ;
  3. copiez la clé de l'abonnement (la `X-Okapi-Key`, 64 caractères).
- Gladys doit accéder à Internet (`api.laposte.fr`).

## Configuration

Installez l'intégration depuis **Intégrations → Installer depuis GitHub** avec l'adresse
`https://github.com/guim31/gladys-laposte`, puis ouvrez sa configuration.

| Réglage                 | Défaut        | Rôle                                                                                                     |
| ----------------------- | ------------- | -------------------------------------------------------------------------------------------------------- |
| Clé d'API               | (obligatoire) | La clé de votre abonnement « Suivi ». Elle n'apparaît jamais dans les journaux.                          |
| Intervalle de lecture   | 30 minutes    | Fréquence de lecture de chaque colis en cours (15 minutes à 4 heures). Un colis livré n'est plus lu.     |
| Garder les colis livrés | 7 jours       | Un colis livré ou retourné quitte la liste après ce délai (1 à 30 jours).                                |
| Langue                  | Français      | Noms des fonctionnalités du nouvel appareil, langue des textes de La Poste, des messages et des phrases. |

L'état de connexion de l'écran de configuration indique si La Poste accepte la clé.

Actions de l'écran de configuration :

- **Ajouter un colis** : numéro de suivi (11 à 15 lettres et chiffres, espaces acceptées) et nom facultatif. Un
  numéro déjà suivi garde son colis, et prend le nouveau nom si vous en donnez un. Le colis est lu tout de suite.
- **Retirer un colis** : par son nom ou son numéro.
- **Relire les colis maintenant** : lit chaque colis en cours sans attendre l'intervalle, et vérifie la clé.

## L'appareil

Créez l'appareil **Colis La Poste** dans l'onglet **Découverte**. C'est un seul appareil pour tous vos colis : un
colis ne vit que quelques jours, et un appareil par colis laisserait un appareil mort après chaque livraison.

| Fonctionnalité        | Type     | Contenu                                                                                 |
| --------------------- | -------- | --------------------------------------------------------------------------------------- |
| Colis en cours        | Compteur | Colis pas encore livrés                                                                 |
| En cours de livraison | Compteur | Colis dans la tournée du jour du facteur ou du livreur                                  |
| À retirer             | Compteur | Colis qui attendent en bureau de poste ou en point retrait                              |
| Problèmes             | Compteur | Colis retardés, retenus en douane, non distribuables ou renvoyés à l'expéditeur         |
| Livrés récemment      | Compteur | Colis livrés encore dans la liste                                                       |
| Résumé                | Texte    | « Vous avez 2 colis en cours : Chaussures, en cours de livraison ; Livre, en transit. » |

Les compteurs gardent leur historique et servent dans les conditions de scène.

## Le widget

**Mes colis** (Tableau de bord → Éditer → ajouter un widget de l'intégration) liste jusqu'à 8 colis, ceux qui
vous attendent d'abord (en cours de livraison, à retirer, problème), puis les autres. Chaque ligne montre le nom, un
badge de statut, la dernière étape et sa date. Un toucher ouvre le détail : transporteur, numéro, date prévue ou de
livraison, point de retrait, dernières étapes, et un lien vers la page de suivi de laposte.fr. Une ligne prévient
quand la clé manque ou est refusée, ou quand La Poste ne répond pas.

## Déclencheurs de scène

| Déclencheur                        | Quand                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------- |
| Un colis est en cours de livraison | Le colis est dans la tournée du jour                                                         |
| Un colis est livré                 | La Poste l'indique livré (pas pour un colis déjà livré quand vous l'ajoutez)                 |
| Un colis est à retirer             | Le colis attend en bureau de poste ou en point retrait, après un passage manqué ou par choix |
| Un colis a un problème             | Retard, adresse incomplète, douane, non distribuable ou retour à l'expéditeur                |

Chaque déclencheur part une fois quand le colis entre dans le statut, avec ces variables : nom du colis, numéro de
suivi, statut, dernière étape (texte de La Poste), transporteur, point de retrait, page de suivi.

## Actions de scène

- **Suivre un colis** : ajoute un colis à la liste. Le champ numéro accepte aussi un texte entier, comme l'objet
  d'un mail : son premier numéro de suivi est retenu. Sorties : numéro, nom, statut, nouveau colis (1 ou 0). Sans
  numéro dans le texte, l'action échoue et la scène le note.
- **Lire l'état de mes colis** : donne une phrase qui liste les colis en cours (« Vous avez 2 colis en cours : … »),
  et les nombres de colis en cours, en cours de livraison et à retirer.

## Exemples de scènes

- **Livraison aujourd'hui** : déclencheur « Un colis est en cours de livraison » → envoyer un message « … arrive
  aujourd'hui », avec la variable « Nom du colis » du déclencheur.
- **Ne pas oublier le retrait** : déclencheur « Un colis est à retirer » → message avec le point de retrait.
- **Point du matin** : chaque jour à 8 h → « Lire l'état de mes colis » → dire la phrase sur une enceinte,
  seulement si « Colis en cours » est supérieur à 0 (étape « Condition sur variables »).
- **Suivi depuis les mails** : avec une intégration qui transforme les mails reçus en déclencheurs (IMAP),
  déclencheur « mail reçu de Colissimo » → « Suivre un colis » avec l'objet du mail comme numéro.

## Dépannage

- **« La Poste refuse la clé d'API »** : vérifiez que vous avez copié la clé de l'abonnement « Suivi », sans espace,
  et que l'abonnement est actif sur developer.laposte.fr. Les lectures reprennent dès que la clé change.
- **Un colis reste « Pas encore connu »** : La Poste ne connaît un colis qu'une fois remis par l'expéditeur. Le
  numéro est gardé et relu ; au bout de 30 jours sans réponse, il est retiré.
- **« Quota La Poste atteint »** ou **« ne répond pas »** : les lectures font une pause (une heure, ou le délai donné
  par La Poste ; 10 minutes pour une panne), puis reprennent seules.
- **Aucune valeur sur l'appareil** : créez l'appareil dans l'onglet Découverte ; ses valeurs sont envoyées aussitôt.
- Journaux détaillés : `LOG_LEVEL=debug` sur le conteneur.

## Limites

- **Développée sans le matériel** : sans clé d'API, les tests ont tourné sur des réponses simulées d'après la
  documentation de l'API. Les premiers utilisateurs diront si chaque statut est bien lu.
- 50 colis au plus. Les colis des autres transporteurs (DHL, UPS, Mondial Relay…) ne sont pas couverts.
- Le quota de l'offre gratuite est indiqué sur developer.laposte.fr (10 requêtes par seconde à l'écriture de ces
  lignes) : avec une requête par colis toutes les 30 minutes, l'intégration reste très en dessous. L'usage de l'API
  suit ses conditions d'utilisation sur developer.laposte.fr.
- Les textes des étapes viennent de La Poste, dans la langue de la configuration (anglais, français, allemand ou
  espagnol).
- Les noms des fonctionnalités sont donnés à la création de l'appareil : changer la langue ensuite ne les renomme
  pas.
- Sans lien avec La Poste. La Poste, Colissimo et Chronopost sont des marques de leurs propriétaires.
