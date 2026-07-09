.PHONY: build db-down db-logs db-up dev docker-build down install keycloak-logs keycloak-up logs migrate pgadmin-up pgadmin-logs ps test typecheck up

install:
	npm install

build:
	npm run build

typecheck:
	npm run typecheck

test: typecheck

dev:
	npm run dev

migrate:
	npm run migrate

db-up:
	docker compose up -d postgres

pgadmin-up:
	docker compose up -d postgres pgadmin

pgadmin-logs:
	docker compose logs -f pgadmin

keycloak-up:
	docker compose up -d keycloak-db keycloak

keycloak-logs:
	docker compose logs -f keycloak

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

docker-build:
	docker compose build
