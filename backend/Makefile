# Perintah harian. Jalankan dari folder backend/.
#   Lokal (tanpa Docker): make dev, make test
#   Docker (laptop/VPS):  make up, make seed, make logs, make backup

COMPOSE := docker compose
PY := $(if $(wildcard venv/bin/python),venv/bin/python,python)

.PHONY: help dev test check up down restart logs ps migrate seed shell psql backup restore deploy prune

help:
	@grep -E '^[a-z-]+:.*?## ' $(MAKEFILE_LIST) | awk -F':.*?## ' '{printf "  %-10s %s\n", $$1, $$2}'

dev: ## runserver lokal di :7860 (SQLite bila DATABASE_URL kosong)
	$(PY) manage.py migrate
	$(PY) manage.py runserver 0.0.0.0:7860

test: ## seluruh tes (selalu SQLite in-memory)
	$(PY) manage.py test

check: ## cek konfigurasi produksi tanpa menjalankan server
	DJANGO_SETTINGS_MODULE=config.settings.production $(PY) manage.py check --deploy

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

migrate: ## jalankan migrasi di container api
	$(COMPOSE) exec api python manage.py migrate

seed: ## isi akun & data demo (idempoten)
	$(COMPOSE) exec api python manage.py seed_demo_data

shell: ## Django shell di container api
	$(COMPOSE) exec api python manage.py shell

psql: ## psql ke basis data
	$(COMPOSE) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

backup: ## pg_dump terkompresi ke backups/
	./deploy/backup.sh

restore: ## pulihkan backup: make restore FILE=backups/thinkpath-xxx.sql.gz
	@test -n "$(FILE)" || (echo "Pakai: make restore FILE=backups/<berkas>.sql.gz" && exit 1)
	gunzip -c "$(FILE)" | $(COMPOSE) exec -T db sh -c 'psql -v ON_ERROR_STOP=1 -U "$$POSTGRES_USER" -d "$$POSTGRES_DB"'

deploy: ## tarik kode terbaru lalu build ulang (dipakai di VPS)
	git pull --ff-only
	$(COMPOSE) up -d --build
	docker image prune -f

prune: ## bersihkan image & build cache yang tidak terpakai
	docker image prune -f
	docker builder prune -f
