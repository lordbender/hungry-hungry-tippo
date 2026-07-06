.PHONY: build db-down db-logs db-up dev docker-build down install logs migrate ps test typecheck up

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

db-down:
	docker compose down

db-logs:
	docker compose logs -f postgres

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f

ps:
	docker compose ps

docker-build:
	docker compose build
