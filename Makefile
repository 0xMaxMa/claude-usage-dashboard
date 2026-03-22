include .env
export

.PHONY: build up down logs deploy forward-port help

help: ## Show this help message
	@echo "----------------------------------------"
	@echo "\033[0;34mMakefile - Available Commands:\033[0m"
	@echo "----------------------------------------"
	@grep -hE '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

.DEFAULT_GOAL := help

build: ## Build and start with docker compose
	docker compose down
	docker compose up -d --build

up: ## Start application stack
	docker compose up -d

down: ## Stop application stack
	docker compose down

logs: ## Show application logs
	docker compose logs -f claude-usage-dashboard

forward-port: ## Forward local port to the public internet using Cloudflare Tunnel
	cloudflared tunnel --protocol http2 --url http://localhost:${PORT:-3737}

deploy: ## Deploy application to production server
	./run-app.sh push 0xparadin/claude-usage-dashboard:latest amd64
	curl -s -X POST -H "Authorization: Bearer $(DEPLOY_WEBHOOK_TOKEN)" http://172.19.0.1:9123/deploy/claude-usage-dashboard
