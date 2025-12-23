# Simple HTTP server for CVR DataFeed OBS Overlay
# This script starts a local web server to serve the overlay files
# Use this to avoid CORS issues when accessing the DataFeed API

$Port = 8000
$OverlayPath = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " CVR DataFeed OBS Overlay Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting HTTP server on port $Port..." -ForegroundColor Green
Write-Host "Serving files from: $OverlayPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Use this URL in OBS Browser Source:" -ForegroundColor White
Write-Host "  http://localhost:$Port/index.html" -ForegroundColor Cyan
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Python is available
$pythonCmd = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonCmd = "python"
} elseif (Get-Command python3 -ErrorAction SilentlyContinue) {
    $pythonCmd = "python3"
} else {
    Write-Host "ERROR: Python is not installed or not in PATH" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Python from https://www.python.org/" -ForegroundColor Yellow
    Write-Host "Or use Node.js: npx http-server -p $Port" -ForegroundColor Yellow
    pause
    exit 1
}

# Start the server
try {
    & $pythonCmd -m http.server $Port
} catch {
    Write-Host "ERROR: Failed to start HTTP server" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    pause
    exit 1
}
