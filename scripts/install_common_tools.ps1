$ErrorActionPreference="SilentlyContinue"
function Have($c){ (Get-Command $c -ErrorAction SilentlyContinue) -ne $null }
if (Have winget) {
  winget install --silent BurntSushi.ripgrep.Shims
  winget install --silent Python.Python.3.12
  winget install --silent NodeJS.NodeJS
} elseif (Have choco) {
  choco install -y ripgrep git python nodejs
}
npm i -g eslint prettier markdownlint-cli stylelint
pip install black isort flake8 bandit pytest mypy
Write-Host "Done. Install heavier tools separately (Semgrep/ZAP/CodeQL/SonarQube) as needed."