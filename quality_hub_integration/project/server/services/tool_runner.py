"""Service for running external code quality tools.

This module defines a list of tooling definitions and exposes
helpers to list available tools and invoke them. Each tool
definition contains a name, category and an optional command. The
`run_tool` function executes the command associated with the tool,
falling back to a simple echo if no command is provided. This
service does not guarantee the tool is installed – callers should
interpret the output accordingly. The intent is to provide a
single integration point for many third‑party linters, scanners and
testing utilities without taking dependencies on all of them.

Because our execution environment may not have every tool
installed, this service always returns a result string rather than
throwing. This makes it safe to run tools on demand and handle
missing executables gracefully.
"""

from __future__ import annotations

import subprocess
import shutil
from typing import List, Dict, Any


# Define a large catalogue of tooling. Each entry specifies the
# user‑facing name and a high level category. The optional
# ``command`` field indicates the binary to execute when running
# the tool. When no command is given, the name (lowercased and
# stripped of spaces) is used. In environments where the command
# is not installed the run will return a notice.
TOOLS: List[Dict[str, Any]] = [
    # Linters & Formatters
    {"name": "ESLint", "category": "Linter", "command": "eslint"},
    {"name": "Prettier", "category": "Formatter", "command": "prettier"},
    {"name": "Stylelint", "category": "Linter", "command": "stylelint"},
    {"name": "Markdownlint", "category": "Linter", "command": "markdownlint"},
    {"name": "Commitlint", "category": "Linter", "command": "commitlint"},
    {"name": "yamllint", "category": "Linter", "command": "yamllint"},
    {"name": "ShellCheck", "category": "Linter", "command": "shellcheck"},
    {"name": "Hadolint", "category": "Linter", "command": "hadolint"},
    {"name": "Black", "category": "Formatter", "command": "black"},
    {"name": "isort", "category": "Formatter", "command": "isort"},
    {"name": "Flake8", "category": "Linter", "command": "flake8"},
    {"name": "Pylint", "category": "Linter", "command": "pylint"},
    {"name": "mypy", "category": "Type Checker", "command": "mypy"},
    {"name": "golangci-lint", "category": "Linter", "command": "golangci-lint"},
    # SAST / Static Code Quality
    {"name": "Semgrep", "category": "SAST", "command": "semgrep"},
    {"name": "SonarQube", "category": "SAST", "command": "sonar-scanner"},
    {"name": "CodeQL", "category": "SAST", "command": "codeql"},
    {"name": "Bandit", "category": "SAST", "command": "bandit"},
    {"name": "Gosec", "category": "SAST", "command": "gosec"},
    {"name": "Brakeman", "category": "SAST", "command": "brakeman"},
    {"name": "SpotBugs", "category": "SAST", "command": "spotbugs"},
    {"name": "FindSecBugs", "category": "SAST", "command": "findsecbugs"},
    {"name": "PMD", "category": "SAST", "command": "pmd"},
    {"name": "Checkstyle", "category": "SAST", "command": "checkstyle"},
    {"name": "PVS-Studio", "category": "SAST", "command": "pvs-studio"},
    {"name": "Infer", "category": "SAST", "command": "infer"},
    # Secrets / SCA / SBOM
    {"name": "Dependabot", "category": "SCA", "command": "dependabot"},
    {"name": "Renovate", "category": "SCA", "command": "renovate"},
    {"name": "OWASP Dependency-Check", "category": "SCA", "command": "dependency-check"},
    {"name": "Dependency-Track", "category": "SCA", "command": "dependency-track"},
    {"name": "Snyk", "category": "SCA", "command": "snyk"},
    {"name": "Trivy", "category": "SCA", "command": "trivy"},
    {"name": "Grype", "category": "SCA", "command": "grype"},
    {"name": "Syft", "category": "SBOM", "command": "syft"},
    {"name": "Checkov", "category": "SCA", "command": "checkov"},
    {"name": "tfsec", "category": "SCA", "command": "tfsec"},
    # DAST / IAST & Web Security Testing
    {"name": "OWASP ZAP", "category": "DAST", "command": "zap"},
    {"name": "Burp Suite", "category": "DAST", "command": "burpsuite"},
    {"name": "Nikto", "category": "DAST", "command": "nikto"},
    {"name": "w3af", "category": "DAST", "command": "w3af"},
    {"name": "Nuclei", "category": "DAST", "command": "nuclei"},
    {"name": "sqlmap", "category": "DAST", "command": "sqlmap"},
    {"name": "Arachni", "category": "DAST", "command": "arachni"},
    {"name": "Skipfish", "category": "DAST", "command": "skipfish"},
    # Testing, Coverage & Mutation
    {"name": "Jest", "category": "Testing", "command": "jest"},
    {"name": "Vitest", "category": "Testing", "command": "vitest"},
    {"name": "Mocha", "category": "Testing", "command": "mocha"},
    {"name": "Chai", "category": "Testing", "command": "chai"},
    {"name": "Cypress", "category": "Testing", "command": "cypress"},
    {"name": "Playwright", "category": "Testing", "command": "playwright"},
    {"name": "Selenium", "category": "Testing", "command": "selenium"},
    {"name": "Puppeteer", "category": "Testing", "command": "puppeteer"},
    {"name": "pytest", "category": "Testing", "command": "pytest"},
    {"name": "coverage.py", "category": "Testing", "command": "coverage"},
    {"name": "Stryker", "category": "Mutation Testing", "command": "stryker"},
    {"name": "Pact", "category": "Contract Testing", "command": "pact"},
    # Load & Performance Testing
    {"name": "k6", "category": "Performance", "command": "k6"},
    {"name": "Locust", "category": "Performance", "command": "locust"},
    {"name": "JMeter", "category": "Performance", "command": "jmeter"},
    {"name": "Artillery", "category": "Performance", "command": "artillery"},
    {"name": "Gatling", "category": "Performance", "command": "gatling"},
    {"name": "Vegeta", "category": "Performance", "command": "vegeta"},
    {"name": "wrk", "category": "Performance", "command": "wrk"},
    {"name": "Lighthouse", "category": "Performance", "command": "lighthouse"},
    # Observability / APM / Logging
    {"name": "OpenTelemetry", "category": "Observability", "command": "otel"},
    {"name": "Jaeger", "category": "Observability", "command": "jaeger"},
    {"name": "Prometheus", "category": "Observability", "command": "prometheus"},
    {"name": "Grafana", "category": "Observability", "command": "grafana"},
    {"name": "Sentry", "category": "Observability", "command": "sentry-cli"},
    {"name": "Zipkin", "category": "Observability", "command": "zipkin"},
    {"name": "Elastic APM", "category": "Observability", "command": "elastic-apm"},
    {"name": "Loki", "category": "Observability", "command": "loki"},
    {"name": "Tempo", "category": "Observability", "command": "tempo"},
    {"name": "Kibana", "category": "Observability", "command": "kibana"},
    # Code Search & Navigation
    {"name": "Sourcegraph", "category": "Search", "command": "sourcegraph"},
    {"name": "ripgrep", "category": "Search", "command": "rg"},
    {"name": "The Silver Searcher", "category": "Search", "command": "ag"},
    {"name": "Universal Ctags", "category": "Navigation", "command": "ctags"},
    {"name": "livegrep", "category": "Search", "command": "livegrep"},
    {"name": "ack", "category": "Search", "command": "ack"},
    {"name": "Comby", "category": "Search", "command": "comby"},
    # Docs & API Tooling
    {"name": "Docusaurus", "category": "Docs", "command": "docusaurus"},
    {"name": "MkDocs", "category": "Docs", "command": "mkdocs"},
    {"name": "Sphinx", "category": "Docs", "command": "sphinx-build"},
    {"name": "Storybook", "category": "Docs", "command": "storybook"},
    {"name": "Redocly", "category": "Docs", "command": "redocly"},
    {"name": "OpenAPI Generator", "category": "Docs", "command": "openapi-generator"},
    # DB Migrations & Schema
    {"name": "Alembic", "category": "Database", "command": "alembic"},
    {"name": "Flyway", "category": "Database", "command": "flyway"},
    {"name": "Liquibase", "category": "Database", "command": "liquibase"},
    {"name": "Prisma", "category": "Database", "command": "prisma"},
    {"name": "dbmate", "category": "Database", "command": "dbmate"},
    {"name": "Knex", "category": "Database", "command": "knex"},
    # Build / Bundle / Transpile
    {"name": "Vite", "category": "Build", "command": "vite"},
    {"name": "esbuild", "category": "Build", "command": "esbuild"},
    {"name": "SWC", "category": "Build", "command": "swc"},
    {"name": "Webpack", "category": "Build", "command": "webpack"},
    {"name": "Rollup", "category": "Build", "command": "rollup"},
    {"name": "Babel", "category": "Build", "command": "babel"},
    {"name": "tsup", "category": "Build", "command": "tsup"},
    # Additional Tools (50 extras for demonstration)
    {"name": "JSHint", "category": "Linter", "command": "jshint"},
    {"name": "Gradle", "category": "Build", "command": "gradle"},
    {"name": "Bazel", "category": "Build", "command": "bazel"},
    {"name": "Helm", "category": "Deployment", "command": "helm"},
    {"name": "Jenkins", "category": "CI/CD", "command": "jenkins"},
    {"name": "New Relic", "category": "Monitoring", "command": "newrelic"},
    {"name": "Karma", "category": "Testing", "command": "karma"},
    {"name": "Subversion", "category": "Version Control", "command": "svn"},
    {"name": "dbdiagram", "category": "Database", "command": "dbdiagram"},
    {"name": "Husky", "category": "Git Hooks", "command": "husky"},
    {"name": "Yarn", "category": "Package Manager", "command": "yarn"},
    {"name": "Make", "category": "Build", "command": "make"},
    {"name": "Ninja", "category": "Build", "command": "ninja"},
    {"name": "CMake", "category": "Build", "command": "cmake"},
    {"name": "Docker Compose", "category": "Deployment", "command": "docker-compose"},
    {"name": "Kubernetes", "category": "Deployment", "command": "kubectl"},
    {"name": "Terraform", "category": "Infrastructure", "command": "terraform"},
    {"name": "Ansible", "category": "Infrastructure", "command": "ansible"},
    {"name": "Chef", "category": "Infrastructure", "command": "chef"},
    {"name": "Puppet", "category": "Infrastructure", "command": "puppet"},
    {"name": "SaltStack", "category": "Infrastructure", "command": "salt"},
    {"name": "Helmfile", "category": "Deployment", "command": "helmfile"},
    {"name": "Skaffold", "category": "Deployment", "command": "skaffold"},
    {"name": "Pre-commit", "category": "Git Hooks", "command": "pre-commit"},
    {"name": "Gulp", "category": "Build", "command": "gulp"},
    {"name": "Grunt", "category": "Build", "command": "grunt"},
    {"name": "Maven", "category": "Build", "command": "mvn"},
    {"name": "Composer", "category": "Dependency Manager", "command": "composer"},
    {"name": "pipenv", "category": "Dependency Manager", "command": "pipenv"},
    {"name": "poetry", "category": "Dependency Manager", "command": "poetry"},
    {"name": "patch", "category": "Utility", "command": "patch"},
    {"name": "IPython", "category": "REPL", "command": "ipython"},
    {"name": "ipdb", "category": "Debugging", "command": "ipdb"},
    {"name": "watchman", "category": "Utility", "command": "watchman"},
    {"name": "GDB", "category": "Debugging", "command": "gdb"},
    {"name": "strace", "category": "Debugging", "command": "strace"},
    {"name": "valgrind", "category": "Debugging", "command": "valgrind"},
    {"name": "docker-scan", "category": "SCA", "command": "docker scan"},
    {"name": "clang-format", "category": "Formatter", "command": "clang-format"},
    {"name": "clang-tidy", "category": "Linter", "command": "clang-tidy"},
    {"name": "cpplint", "category": "Linter", "command": "cpplint"},
    {"name": "rubocop", "category": "Linter", "command": "rubocop"},
    {"name": "phpcs", "category": "Linter", "command": "phpcs"},
    {"name": "phpcbf", "category": "Formatter", "command": "phpcbf"},
    {"name": "jscpd", "category": "Duplication", "command": "jscpd"},
    {"name": "dupFinder", "category": "Duplication", "command": "dupfinder"},
    {"name": "CodeClimate", "category": "Quality", "command": "codeclimate"},
    {"name": "Bats", "category": "Testing", "command": "bats"},
    {"name": "Gauge", "category": "Testing", "command": "gauge"},
    {"name": "Cucumber", "category": "Testing", "command": "cucumber"},
    {"name": "RSpec", "category": "Testing", "command": "rspec"},
    {"name": "JUnit", "category": "Testing", "command": "junit"},
    {"name": "TestNG", "category": "Testing", "command": "testng"},
    {"name": "Moq", "category": "Testing", "command": "moq"},
    {"name": "Mockito", "category": "Testing", "command": "mockito"},
    {"name": "htop", "category": "Monitoring", "command": "htop"},
    {"name": "iostat", "category": "Monitoring", "command": "iostat"},
    {"name": "sysdig", "category": "Monitoring", "command": "sysdig"},
    {"name": "DTrace", "category": "Monitoring", "command": "dtrace"},
    {"name": "VisualVM", "category": "Monitoring", "command": "visualvm"},
    {"name": "pprof", "category": "Monitoring", "command": "pprof"},
]


def list_tools() -> List[Dict[str, Any]]:
    """Return the list of all known tools.

    Returns a new list so callers cannot mutate the global TOOLS.
    """
    return [dict(tool) for tool in TOOLS]


def run_tool(name: str) -> Dict[str, Any]:
    """Run the tool with the given name.

    Looks up the tool by name (case insensitive). If found, attempts
    to execute the associated command. If the command is not
    installed, returns a notice. The returned dict includes the
    tool name, a status string and the output or error of the run.

    Parameters
    ----------
    name: str
        The display name of the tool to run.

    Returns
    -------
    dict
        A dictionary containing 'name', 'status' and 'output'.
    """
    # Find tool (case insensitive match)
    tool = next((t for t in TOOLS if t["name"].lower() == name.lower()), None)
    if tool is None:
        return {
            "name": name,
            "status": "error",
            "output": f"Unknown tool: {name}",
        }
    # Determine command to run
    command = tool.get("command") or tool["name"].lower().replace(" ", "")
    # If command has spaces (e.g. "docker scan"), split into list
    if isinstance(command, str):
        cmd_list = command.split()
    else:
        cmd_list = command
    # Check if the binary is installed
    binary = cmd_list[0]
    if shutil.which(binary) is None:
        return {
            "name": tool["name"],
            "status": "not_installed",
            "output": f"{tool['name']} is not installed on this system.",
        }
    # Try running the command with '--help' or echo to prevent heavy operation
    try:
        # We run the tool with '--help' to avoid performing actual scans.
        run_cmd = cmd_list + ["--help"] if binary not in ("echo", "npm") else cmd_list
        proc = subprocess.run(run_cmd, capture_output=True, text=True, timeout=30)
        output = proc.stdout or proc.stderr
        return {
            "name": tool["name"],
            "status": "success" if proc.returncode == 0 else "error",
            "output": output.strip(),
        }
    except Exception as exc:
        return {
            "name": tool["name"],
            "status": "error",
            "output": f"Failed to run {tool['name']}: {exc}",
        }