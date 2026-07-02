# Requirements — Plateforme interne de suivi de tâches

Version 1.0 — Juillet 2026

## 1. Contexte et objectifs

### 1.1 Contexte

L'équipe suit actuellement ses tâches et actions à travers un tableau Excel partagé. Ces tâches proviennent principalement de comptes rendus de réunion (points de suivi projets, actions à mener avec des prestataires et interlocuteurs internes ou externes). Ce mode de fonctionnement montre ses limites : absence de vue d'ensemble claire, difficulté à suivre les responsabilités et les échéances, pas de collaboration en temps réel, et un rendu visuel peu engageant.

Le projet consiste à concevoir et développer une application web interne, moderne et collaborative, destinée à remplacer ce tableau Excel.

### 1.2 Objectifs du projet

- Centraliser le suivi des tâches et actions issues des réunions dans un outil unique et accessible à toute l'équipe.
- Offrir une visibilité claire sur les responsables, les échéances et l'avancement de chaque action.
- Proposer une expérience visuelle originale, moderne et agréable à utiliser au quotidien.
- Poser une base évolutive : la plateforme est conçue pour accueillir de nouvelles fonctionnalités dans le temps, au-delà du seul suivi de tâches.

## 2. Périmètre du projet

### 2.1 Périmètre de la phase 1 (MVP)

La première version livrable du projet couvre :

- L'authentification par email et mot de passe.
- La gestion complète des tâches (création, modification, suppression, changement de statut).
- Deux modes de visualisation : vue Kanban (par statut) et vue Liste, avec possibilité de basculer de l'une à l'autre.
- Des filtres par responsable et par projet.
- Une navigation par barre latérale (sidebar), pensée pour accueillir les futures fonctionnalités.

### 2.2 Évolutions futures envisagées (hors périmètre phase 1)

Le projet est conçu pour évoluer. Les pistes suivantes ne sont pas développées en phase 1 mais influencent les choix d'architecture et de navigation :

- Notifications et rappels d'échéances.
- Statistiques et tableaux de bord (avancement par projet, par responsable).
- Gestion des rôles et des permissions plus fine (admin, membre, invité).
- Historique et journal des modifications sur chaque tâche.
- Intégration ou import direct de comptes rendus de réunion.

## 3. Utilisateurs cibles

La plateforme est destinée à l'usage exclusif de l'équipe interne, sur poste de travail (ordinateur). Chaque membre dispose d'un compte personnel (email et mot de passe) et peut :

- Consulter l'ensemble des tâches de l'équipe.
- Créer, modifier et mettre à jour des tâches, qu'il en soit responsable ou non.
- Filtrer l'affichage pour se concentrer sur ses propres tâches ou sur un projet donné.

## 4. Fonctionnalités détaillées

### 4.1 Authentification

- Écran de connexion avec email et mot de passe.
- Gestion des sessions utilisateur (maintien de la connexion, déconnexion).
- Récupération de mot de passe oublié.
- Accès à la plateforme réservé aux comptes créés pour l'équipe (pas d'inscription libre).

### 4.2 Gestion des tâches

Chaque tâche est composée des champs suivants :

- Titre et description.
- Projet ou thématique associé(e) (ex. « Sage 100 », « Dealer Business »).
- Un ou plusieurs responsables (interlocuteurs).
- Une échéance, pouvant être une date précise ou une indication libre (ex. « mi-juillet », « semaine prochaine »).
- Un statut : à faire, en cours, en attente, bloqué, terminé.
- Une priorité : basse, moyenne, haute.
- Une source, permettant de rattacher la tâche à la réunion ou au compte rendu d'origine.

Les utilisateurs peuvent créer, modifier, réassigner, changer le statut et supprimer une tâche.

### 4.3 Vue Kanban

- Colonnes correspondant aux différents statuts des tâches.
- Chaque tâche est représentée sous forme de carte affichant titre, projet, responsable(s), échéance et priorité.
- Changement de statut d'une tâche par glisser-déposer (drag & drop) entre les colonnes.

### 4.4 Vue Liste

- Affichage tabulaire de l'ensemble des tâches.
- Tri possible par échéance, priorité, statut ou responsable.
- Mêmes données et actions disponibles que dans la vue Kanban.

### 4.5 Bascule entre les vues

- Un contrôle clairement visible permet à l'utilisateur de choisir sa vue préférée (Kanban ou Liste) à tout moment.

### 4.6 Filtres

- Filtrage des tâches par responsable.
- Filtrage des tâches par projet.
- Ces filtres s'appliquent aussi bien à la vue Kanban qu'à la vue Liste.

### 4.7 Navigation (sidebar)

La barre latérale constitue le point d'entrée principal de la navigation et doit être pensée comme évolutive. En phase 1, elle donne accès a minima à :

- Tableau de bord / accueil.
- Vue Kanban.
- Vue Liste.
- Projets.
- Profil utilisateur et déconnexion.

Elle doit être structurée de sorte à pouvoir accueillir, sans refonte majeure, de nouvelles sections liées aux évolutions futures listées en section 2.2.

## 5. Modèle de données

Les principales entités de la base de données sont les suivantes :

| Table | Description | Champs clés |
|---|---|---|
| `profiles` | Comptes utilisateurs de l'équipe | id, nom, email, avatar |
| `projects` | Projets ou thématiques regroupant des tâches | id, nom, description |
| `tasks` | Tâches à réaliser | id, titre, description, project_id, échéance, statut, priorité, source |
| `task_assignees` | Association entre tâches et responsables (relation multiple) | task_id, user_id |

## 6. Architecture technique

### 6.1 Stack technique retenue

| Composant | Technologie |
|---|---|
| Frontend | Next.js + Tailwind CSS |
| Backend / API | Python (FastAPI) |
| Base de données | Supabase (PostgreSQL) |
| Authentification | Supabase Auth (email / mot de passe, gestion des tokens JWT) |
| Hébergement | Vercel (frontend) — hébergement du backend à confirmer |

### 6.2 Principe de fonctionnement

- L'utilisateur se connecte depuis le frontend Next.js, qui délègue l'authentification à Supabase Auth.
- Une fois connecté, le frontend joint un token JWT à chaque requête envoyée à l'API Python.
- L'API Python vérifie le token, applique la logique métier, puis lit ou écrit dans la base PostgreSQL de Supabase.

## 7. Exigences UI / UX

- Palette de couleurs originale et distinctive, associant une couleur à chaque statut de tâche.
- Cartes de tâches avec un accent visuel selon la priorité ou l'urgence de l'échéance.
- Interface aérée, coins arrondis, sans surcharge visuelle.
- Navigation par sidebar, conçue pour rester lisible à mesure que de nouvelles sections seront ajoutées.
- Expérience optimisée pour un usage sur ordinateur (résolution desktop).

## 8. Exigences non fonctionnelles

- **Sécurité** : mots de passe gérés exclusivement par Supabase Auth (hachage, tokens JWT), aucune donnée sensible stockée en clair.
- **Accès restreint** : seuls les comptes créés pour l'équipe peuvent se connecter.
- **Évolutivité** : architecture (sidebar, modèle de données, API) conçue pour accueillir de nouvelles fonctionnalités sans refonte majeure.
- **Performance** : chargement rapide des vues Kanban et Liste, même avec un volume croissant de tâches.

## 9. Planning indicatif

| Étape | Contenu |
|---|---|
| 1. Design | Maquettes visuelles (sidebar, Kanban, Liste, connexion) et validation de la palette de couleurs |
| 2. Backend | Mise en place du schéma Supabase, de l'authentification et de l'API FastAPI |
| 3. Frontend | Développement du frontend Next.js (sidebar, vues Kanban et Liste, filtres) |
| 4. Intégration | Connexion frontend / API / base de données, tests |
| 5. Mise en production | Déploiement et mise à disposition de l'équipe |

## 10. Critères de succès

- L'équipe abandonne l'usage du tableau Excel au profit de la plateforme.
- Chaque membre de l'équipe peut identifier en un coup d'œil ses tâches en cours et leurs échéances.
- L'ajout d'une nouvelle fonctionnalité future (notifications, statistiques, rôles) ne nécessite pas de refonte de l'architecture existante.