# Raccourcis (section 14 du cahier). Nécessite Docker pour up/down/migrate/seed/test.
.PHONY: up down logs migrate seed test test-backend test-frontend lint e2e types

up: ## Démarre toute l'application (http://localhost:3000)
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f backend frontend

migrate:
	docker compose exec backend alembic upgrade head

seed:
	docker compose exec backend python scripts/seed.py

test: test-backend test-frontend

test-backend: ## pytest contre une base rdv_test séparée (créée automatiquement)
	docker compose exec backend pytest --cov=app --cov-report=term-missing

test-frontend:
	cd frontend && npm run test

lint:
	docker compose exec backend sh -c "ruff check . && ruff format --check . && mypy app scripts"
	cd frontend && npm run lint && npm run format:check && npm run typecheck

e2e: ## Parcours Playwright contre l'application démarrée (make up)
	cd frontend && npx playwright install chromium && npm run e2e

types: ## Régénère les types TypeScript à partir du schéma OpenAPI de l'API
	docker compose exec backend python scripts/export_openapi.py /tmp/openapi.json
	docker compose cp backend:/tmp/openapi.json frontend/openapi.json
	cd frontend && npm run gen:types
