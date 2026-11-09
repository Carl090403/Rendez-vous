# Rendez-vous — réservation en ligne pour petits commerces

Application web où un client réserve un rendez-vous chez un commerce de services (salon, tuteur, clinique) en moins de deux minutes, sans téléphoner. Le propriétaire gère ses services, ses heures d'ouverture, ses congés et ses réservations depuis un tableau de bord.

**Démo en ligne :** _à ajouter après le déploiement_ · **API documentée :** `/docs` (Swagger)

> Captures d'écran / GIF du parcours de réservation et du tableau de bord : _à ajouter_.

## Fonctionnalités

- **Clients** : inscription, connexion, mot de passe oublié (lien à usage unique valide 1 h), catalogue des services, calendrier des créneaux libres, réservation en 4 étapes, « Mes rendez-vous » (à venir / passés), annulation jusqu'à 24 h avant, profil, suppression du compte (Loi 25).
- **Administrateur** : tableau de bord du jour et de la semaine, liste filtrable des réservations (date, statut, service) avec annulation motivée, gestion des services, heures d'ouverture (plusieurs plages par jour), congés avec signalement des réservations touchées.
- **Courriels** : confirmation, annulation (client ou commerce), nouvelle réservation pour l'administrateur, réinitialisation du mot de passe.
- **Aucune double réservation possible**, même avec deux clics simultanés.

## Stack et pourquoi

| Couche | Outil | Pourquoi |
| --- | --- | --- |
| API | Python 3.12, FastAPI, Pydantic 2 | Validation stricte des entrées et documentation OpenAPI générée automatiquement. |
| Données | PostgreSQL 16, SQLAlchemy 2, Alembic | Contrainte d'exclusion `btree_gist` contre les chevauchements; migrations versionnées. |
| Sécurité | Argon2id, JWT (PyJWT) en cookie `HttpOnly` | Mots de passe robustes; jeton inaccessible au JavaScript (XSS). |
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | Pages rapides, typage de bout en bout. |
| Données côté client | TanStack Query, React Hook Form + Zod, date-fns-tz | Cache et rafraîchissement des appels; mêmes règles de validation que l'API; fuseau America/Toronto. |
| Courriels | Mailpit (dev), Resend (prod), gabarits Jinja2 | Envoi après le commit, en arrière-plan. |
| Tests | pytest, Vitest + Testing Library, Playwright | Unitaires, intégration sur vraie base PostgreSQL, parcours dans un navigateur. |
| DevOps | Docker Compose, GitHub Actions, Dependabot | Même environnement partout; CI qui bloque la fusion si un test échoue. |

## Architecture

```text
 Navigateur ──pages──▶ Frontend Next.js (Vercel)
     │
     └──── appels JSON + cookie de session ────▶ API FastAPI (Render / Fly.io) ──SQL──▶ PostgreSQL 16
                                                     │                                 (contrainte no_overlap)
                                                     └── après le commit ──▶ Courriels (Resend / Mailpit)
```

Le backend suit trois couches : les **routeurs** gèrent le HTTP, les **services** portent la logique métier, les **modèles** accèdent aux données. Le frontend n'invente aucune règle : il affiche ce que l'API autorise, et les types TypeScript sont générés depuis le schéma OpenAPI de l'API (`frontend/src/types/api.d.ts`).

```text
backend/   app/{routers,services,models,schemas,templates}, alembic/, scripts/, tests/
frontend/  src/{app,components,hooks,lib,types}, tests/{unit,e2e}
```

## Décisions techniques

1. **La base de données interdit les doubles réservations.** Afficher les créneaux libres ne suffit pas : deux clients peuvent cliquer en même temps. La table `bookings` porte une contrainte d'exclusion PostgreSQL :
   ```sql
   CONSTRAINT no_overlap EXCLUDE USING gist (tstzrange(start_at, end_at) WITH &&)
     WHERE (status = 'confirmed')
   ```
   L'API vérifie d'abord le créneau (pour un message précis), puis insère; si la contrainte est violée, elle répond `409 SLOT_TAKEN`. Un test lance deux requêtes simultanées et vérifie qu'une seule réussit; un test Playwright fait de même avec deux navigateurs.
2. **Fuseaux horaires.** Tout est stocké en UTC (`timestamptz`); les heures d'ouverture sont des heures locales converties jour par jour, ce qui gère les journées de 23 h et 25 h. Des tests couvrent les deux dimanches de changement d'heure (8 mars et 1er novembre 2026). Le frontend affiche toujours l'heure de Toronto, quel que soit le fuseau du navigateur.
3. **Cookie `HttpOnly` plutôt que `localStorage`.** Le jeton n'est pas lisible par du JavaScript injecté. Complété par `SameSite=Lax`, une vérification de l'en-tête `Origin` sur les requêtes qui modifient des données, et un CORS limité au frontend.
4. **Horloge injectée.** Les règles de délai (préavis de 2 h, annulation 24 h, horizon de 60 jours, expiration des jetons) sont testées sans attendre, en remplaçant « maintenant » dans les tests.
5. **Autres protections** : 5 échecs de connexion en 15 minutes (par IP et par courriel) → `429`; message identique pour un courriel inconnu et un mauvais mot de passe; « mot de passe oublié » répond toujours la même chose; jetons de réinitialisation stockés hachés (SHA-256); journaux sans mot de passe, jeton ni courriel complet.

## Lancer le projet en local

Prérequis : [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
git clone <url-du-depot> rendez-vous && cd rendez-vous
cp .env.example .env
docker compose up --build
```

Les migrations et les données de départ (administrateur, 3 services, horaires du lundi au vendredi) sont appliquées automatiquement au démarrage.

- Application : http://localhost:3000
- API (Swagger) : http://localhost:8000/docs
- Courriels envoyés (Mailpit) : http://localhost:8025

### Comptes de démonstration (valeurs de `.env.example`)

| Rôle | Courriel | Mot de passe |
| --- | --- | --- |
| Administrateur | `admin@exemple.com` | `Admin-Demo-2026` |
| Client | `alex@exemple.com` | `Client-Demo-2026` |

## Lancer les tests

```bash
make test-backend   # pytest : 83 tests sur une base rdv_test séparée, couverture ≈ 98 %
make test-frontend  # Vitest : composants et utilitaires de dates
make e2e            # Playwright : 4 parcours complets, écran de 375 px (application démarrée)
make lint           # Ruff, mypy, ESLint, Prettier, tsc
```

Sans Docker : `cd backend && pip install -e ".[dev]" && pytest` (avec `DATABASE_URL` vers un PostgreSQL 16), et `cd frontend && npm ci && npm test`.

## Déploiement

1. **Base** : PostgreSQL géré (Render, Neon ou Supabase) avec sauvegardes automatiques.
2. **API** : Render ou Fly.io depuis `backend/Dockerfile`. Au démarrage, le conteneur applique les migrations puis crée l'administrateur et les données de départ si `ADMIN_PASSWORD` est défini (sans doublon). Variables : celles de `.env.example`, avec un `JWT_SECRET` aléatoire, `COOKIE_SECURE=true`, `FRONTEND_ORIGIN=<url du frontend>`, `RESEND_API_KEY`, `ADMIN_PASSWORD` fort. Les URL `postgres://` ou `postgresql://` fournies par l'hébergeur sont acceptées telles quelles.
3. **Frontend** : Vercel, dossier `frontend/`, avec `NEXT_PUBLIC_API_URL`. Si le frontend et l'API sont sur des domaines différents, préférez `API_PROXY_TARGET=<url de l'API>` et `NEXT_PUBLIC_API_URL=/api/v1` : le cookie devient « first-party » (Safari bloque les cookies tiers).
4. **Courriels** : domaine vérifié chez Resend (SPF, DKIM).
5. **Surveillance** : `GET /health` (teste la base) branché sur UptimeRobot.
6. **CI/CD** : à chaque push sur `main`, si tout est vert, la CI appelle les hooks de déploiement définis dans les secrets GitHub `RENDER_DEPLOY_HOOK_URL` et `VERCEL_DEPLOY_HOOK_URL`.

> Les offres gratuites mettent parfois l'API en veille : le premier appel peut prendre quelques secondes.

## API

21 endpoints sous `/api/v1` (+ `DELETE /users/me` pour le droit à l'effacement, + `GET /health`). Erreurs au format `{"error": {"code": "SLOT_TAKEN", "message": "Ce créneau vient d'être réservé."}}`. Documentation interactive : `/docs`.

## Feuille de route

- **v1.1** : rappels 24 h avant (Celery + Redis), paiement Stripe en mode test et factures PDF, prédiction d'achalandage (scikit-learn), assistant de questions-réponses (RAG avec pgvector), bot Discord ou Slack, statistiques.
- **v2** : plusieurs commerces, plusieurs employés, réservations récurrentes, synchronisation Google Calendar, application mobile.

## Ce que j'ai appris

_À compléter à partir du journal de bord._
