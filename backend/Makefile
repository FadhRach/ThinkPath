# Jalankan dari backend/. Lokal: dev, test, seed-local. VPS: sisanya.

COMPOSE := docker compose
# Di Mac, .env dipakai runserver; Docker memakai .env.docker bila ada. Di VPS hanya ada .env.
export COMPOSE_ENV_FILES := $(if $(wildcard .env.docker),.env.docker,.env)
PY := $(if $(wildcard venv/bin/python),venv/bin/python,python)

.PHONY: help dev test seed-local up down restart logs ps migrate seed shell psql backup restore deploy prune

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  %-11s %s\n", $$1, $$2}'

# --- Lokal --------------------------------------------------------------------
dev: ## migrate + runserver :7860 (Postgres lokal)
	$(PY) manage.py migrate
	$(PY) manage.py runserver 127.0.0.1:7860

test: ## seluruh tes (selalu SQLite in-memory)
	$(PY) manage.py test

seed-local: ## akun & data demo di DB lokal
	$(PY) manage.py seed_demo_data

# --- VPS (Docker) -------------------------------------------------------------
up: ## build + jalankan db, api, caddy
	$(COMPOSE) up -d --build

down: ## hentikan container (data tetap di volume)
	$(COMPOSE) down

restart: ## restart api saja
	$(COMPOSE) restart api

logs: ## ikuti log api
	$(COMPOSE) logs -f --tail=100 api

ps: ## status + healthcheck tiap container
	$(COMPOSE) ps

migrate: ## migrasi di container api
	$(COMPOSE) exec api python manage.py migrate

seed: ## akun & data demo di container
	$(COMPOSE) exec api python manage.py seed_demo_data

shell: ## Django shell di container api
	$(COMPOSE) exec api python manage.py shell

psql: ## psql ke DB container
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

backup: ## pg_dump terkompresi ke backups/
	./deploy/backup.sh

restore: ## make restore FILE=backups/thinkpath-xxx.sql.gz
	@test -n "$(FILE)" || (echo "Pakai: make restore FILE=backups/<berkas>.sql.gz" && exit 1)
	gunzip -c "$(FILE)" | $(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

deploy: ## tarik kode terbaru, build ulang, muat ulang Caddy, buang image lama
	git pull --ff-only
	$(COMPOSE) up -d --build
	$(COMPOSE) exec -T caddy caddy reload --config /etc/caddy/Caddyfile
	docker image prune -f

prune: ## bersihkan image & build cache
	docker image prune -f
	docker builder prune -f
