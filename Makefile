PYTHON ?= .venv/bin/python
COVERAGE ?= .venv/bin/coverage
MYPY ?= .venv/bin/mypy
PIP_AUDIT ?= .venv/bin/pip-audit
RUFF ?= .venv/bin/ruff

.PHONY: audit backend-check check coverage e2e eval frontend-check test

test:
	$(PYTHON) backend/manage.py test translator
	npm --prefix frontend test

coverage:
	$(COVERAGE) erase
	$(COVERAGE) run backend/manage.py test translator
	$(COVERAGE) report
	$(COVERAGE) html
	$(COVERAGE) xml
	npm --prefix frontend run test:coverage

eval:
	$(PYTHON) backend/translator/evals.py

backend-check:
	$(RUFF) check backend
	$(RUFF) format --check backend
	DJANGO_SECRET_KEY=typecheck-only $(MYPY) backend

frontend-check:
	npm --prefix frontend run typecheck
	npm --prefix frontend run lint
	npm --prefix frontend run build

e2e:
	npm --prefix frontend run test:e2e

audit:
	$(PIP_AUDIT) -r backend/requirements.txt
	npm --prefix frontend audit --audit-level=high

check: backend-check frontend-check coverage eval e2e
